import asyncio
import json
import os
import websockets
import base64
from dotenv import load_dotenv
from google import genai

from supabase import create_client
import fitz
from google.cloud import vision
from llama_index.core import Document
from llama_index.core.node_parser import SimpleNodeParser
from llama_index.embeddings.gemini import GeminiEmbedding
from llama_index.llms.gemini import Gemini

load_dotenv()

MODEL = "gemini-2.0-flash-exp"
gemini_api_key = os.getenv("GOOGLE_API_KEY")
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
vision_client = vision.ImageAnnotatorClient()
parser = SimpleNodeParser(chunk_size=500)

gemini_embedding_model = GeminiEmbedding(api_key=gemini_api_key, model_name="models/text-embedding-004")
llm = Gemini(api_key=gemini_api_key, model_name=MODEL)

client = genai.Client(http_options={'api_version': 'v1alpha'})


def log(message: str):
    print(f"[DOC-TALK] {message}")


def extract_text_no_ocr(path):
    doc = fitz.open(path)
    return "\n".join([p.get_text() for p in doc])


def extract_text_with_ocr(path):
    with open(path, "rb") as f:
        content = f.read()
    image = vision.Image(content=content)
    response = vision_client.document_text_detection(image=image)
    return response.full_text_annotation.text


def store_chunks_and_embeddings(user_id, filename, text):
    doc = Document(text=text)
    nodes = parser.get_nodes_from_documents([doc])

    for node in nodes:
        embedding = gemini_embedding_model.get_text_embedding(node.text)
        supabase.table("document_chunks").insert({
            "user_id": user_id,
            "filename": filename,
            "chunk": node.text,
            "embedding": embedding
        }).execute()

    log(f"Indexed {filename} for user {user_id} ({len(nodes)} chunks)")


def delete_document(user_id, filename):
    supabase.table("document_chunks").delete().match({
        "user_id": user_id,
        "filename": filename
    }).execute()

    supabase.table("user_documents").delete().match({
        "user_id": user_id,
        "filename": filename
    }).execute()

    supabase.storage.from_("pdfs").remove([f"{user_id}/{filename}"])

    log(f"Deleted {filename} for user {user_id}")
    return f"Deleted {filename}"


def query_docs(query, user_id):
    query_embedding = gemini_embedding_model.get_text_embedding(query)

    response = supabase.rpc(
        "match_document_chunks",
        {
            "query_embedding": query_embedding,
            "match_user_id": user_id,
            "match_count": 5
        }
    ).execute()

    chunks = [row["chunk"] for row in response.data] if response.data else []
    context = "\n\n".join(chunks) if chunks else "No matching document information found."

    answer = llm.complete(f"Context:\n{context}\n\nQuestion: {query}\nAnswer:")
    return str(answer)


tool_query_docs = {
    "function_declarations": [
        {"name": "query_docs", "parameters": {"type": "OBJECT", "properties": {"query": {"type": "STRING"}}, "required": ["query"]}}
    ]
}

tool_delete_doc = {
    "function_declarations": [
        {"name": "delete_document", "parameters": {"type": "OBJECT", "properties": {"filename": {"type": "STRING"}}, "required": ["filename"]}}
    ]
}


async def process_request(path, request_headers):
    if "upgrade" not in request_headers.get("Connection", "").lower():
        return 200, [("Content-Type", "text/plain")], b"DocTalk server running\n"
    return None


async def gemini_session_handler(ws):
    try:
        setup_data = json.loads(await ws.recv())
        user_id = setup_data["setup"]["user_id"]

        log(f"WebSocket Connected (User: {user_id})")

        config = setup_data["setup"]
        config["system_instruction"] = "You MUST always use query_docs for answering questions."
        config["tools"] = [tool_query_docs, tool_delete_doc]

        async with client.aio.live.connect(model=MODEL, config=config) as session:

            async def send_loop():
                async for raw in ws:
                    data = json.loads(raw)
                    if "realtime_input" not in data:
                        continue

                    for chunk in data["realtime_input"]["media_chunks"]:

                        if chunk["mime_type"] == "audio/pcm":
                            await session.send(input=chunk)

                        elif chunk["mime_type"] == "application/pdf":
                            filename = chunk.get("filename", "file.pdf")
                            use_ocr = chunk.get("ocr", False)
                            pdf_bytes = base64.b64decode(chunk["data"])

                            path = f"{user_id}/{filename}"
                            supabase.storage.from_("pdfs").upload(path, pdf_bytes, file_options={"upsert": True})

                            supabase.table("user_documents").insert({
                                "user_id": user_id,
                                "filename": filename,
                                "original_path": path
                            }).execute()

                            os.makedirs("./tmp", exist_ok=True)
                            tmp = f"./tmp/{filename}"

                            try:
                                with open(tmp, "wb") as f:
                                    f.write(pdf_bytes)

                                text = extract_text_with_ocr(tmp) if use_ocr else extract_text_no_ocr(tmp)
                                store_chunks_and_embeddings(user_id, filename, text)

                            finally:
                                if os.path.exists(tmp):
                                    os.remove(tmp)

                            await ws.send(json.dumps({"text": f"✅ '{filename}' uploaded & indexed"}))

            async def receive_loop():
                async for response in session.receive():
                    if response.tool_call:
                        results = []
                        for call in response.tool_call.function_calls:
                            if call.name == "query_docs":
                                result = query_docs(call.args["query"], user_id)
                            elif call.name == "delete_document":
                                result = delete_document(user_id, call.args["filename"])
                            else:
                                result = "Unknown tool"

                            results.append({"name": call.name, "response": {"result": result}, "id": call.id})

                        await session.send(input=results)
                        continue

                    if response.server_content:
                        for part in response.server_content.model_turn.parts:
                            if hasattr(part, "text"):
                                await ws.send(json.dumps({"text": part.text}))
                            elif hasattr(part, "inline_data"):
                                await ws.send(json.dumps({"audio": base64.b64encode(part.inline_data.data).decode()}))

            await asyncio.gather(send_loop(), receive_loop())

    except Exception as e:
        log(f"ERROR: {e}")


async def main():
    PORT = int(os.getenv("PORT", 9084))
    log(f"Server Running on Port {PORT}")

    async with websockets.serve(
        gemini_session_handler,
        "0.0.0.0",
        PORT,
        process_request=process_request
    ):
        await asyncio.Future()


if __name__ == "__main__":
    asyncio.run(main())
