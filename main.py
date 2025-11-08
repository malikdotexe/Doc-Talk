import asyncio
import json
import os
import websockets
from google import genai
import base64
from dotenv import load_dotenv

# Supabase + OCR + Vector
from supabase import create_client
import fitz
from google.cloud import vision
from llama_index.core.node_parser import SimpleNodeParser
from llama_index.embeddings.gemini import GeminiEmbedding
from llama_index.llms.gemini import Gemini
from llama_index.core import Document

load_dotenv()

# === Environment ===
MODEL = "gemini-2.0-flash-exp"
gemini_api_key = os.getenv('GOOGLE_API_KEY')
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
vision_client = vision.ImageAnnotatorClient()
parser = SimpleNodeParser(chunk_size=500)

gemini_embedding_model = GeminiEmbedding(api_key=gemini_api_key, model_name="models/text-embedding-004")
llm = Gemini(api_key=gemini_api_key, model_name="models/gemini-2.0-flash-exp")

client = genai.Client(http_options={ 'api_version': 'v1alpha' })

# === Text Extraction ===
def extract_text_no_ocr(path):
    doc = fitz.open(path)
    text = ""
    for page in doc:
        text += page.get_text()
    return text

def extract_text_with_ocr(path):
    with open(path, "rb") as f:
        content = f.read()
    image = vision.Image(content=content)
    response = vision_client.document_text_detection(image=image)
    return response.full_text_annotation.text

# === Chunk + Embedding Storage ===

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
def delete_document(user_id, filename):
    # 1. Delete embedding chunks
    supabase.table("document_chunks").delete().match({
        "user_id": user_id,
        "filename": filename
    }).execute()

    # 2. Delete metadata
    supabase.table("user_documents").delete().match({
        "user_id": user_id,
        "filename": filename
    }).execute()

    # 3. Delete the file from Storage
    storage_path = f"{user_id}/{filename}"
    supabase.storage.from_("pdfs").remove([storage_path])

    print(f"🗑️ Deleted document {filename} for {user_id}")
    return f"Deleted {filename}"

# === Query ===
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

    chunks = [row["chunk"] for row in response.data]
    context = "\n\n".join(chunks)

    answer = llm.complete(
        f"Context:\n{context}\n\nQuestion: {query}\nAnswer:"
    )

    return str(answer)


tool_query_docs = {
    "function_declarations": [
        {
            "name": "query_docs",
            "description": "Query per-user vector database.",
            "parameters": {
                "type": "OBJECT",
                "properties": {
                    "query": {"type": "STRING"}
                },
                "required": ["query"]
            }
        }
    ]
}
tool_delete_doc = {
    "function_declarations": [
        {
            "name": "delete_document",
            "description": "Delete a document and its embeddings",
            "parameters": {
                "type": "OBJECT",
                "properties": {
                    "filename": {"type": "STRING"}
                },
                "required": ["filename"]
            }
        }
    ]
}



async def gemini_session_handler(client_websocket):
    try:
        config_message = await client_websocket.recv()
        config = json.loads(config_message)["setup"]
        user_id = config["user_id"]  # REQUIRED

        config["system_instruction"] = "You MUST use query_docs for all answers."
        config["tools"] = [tool_query_docs, tool_delete_doc]

        async with client.aio.live.connect(model=MODEL, config=config) as session:
            print("Connected")

            async def send_to_gemini():
                async for message in client_websocket:
                    data = json.loads(message)

                    if "realtime_input" in data:
                        for chunk in data["realtime_input"]["media_chunks"]:
                            if chunk["mime_type"] == "audio/pcm":
                                await session.send(input=chunk)

                            elif chunk["mime_type"] == "application/pdf":
                                pdf_bytes = base64.b64decode(chunk["data"])
                                filename = chunk.get("filename", "file.pdf")
                                use_ocr = chunk.get("ocr", False)

                                storage_path = f"{user_id}/{filename}"
                                supabase.storage.from_("pdfs").upload(
                                    storage_path,
                                    pdf_bytes,
                                    file_options={"content-type": "application/pdf", "upsert": True}
                                )

                                supabase.table("user_documents").insert({
                                    "user_id": user_id,
                                    "filename": filename,
                                    "original_path": storage_path
                                }).execute()

                                os.makedirs("./tmp", exist_ok=True)
                                tmp_path = f"./tmp/{filename}"

                                try:
                                    with open(tmp_path, "wb") as f:
                                        f.write(pdf_bytes)

                                    text = extract_text_with_ocr(tmp_path) if use_ocr else extract_text_no_ocr(tmp_path)

                                    store_chunks_and_embeddings(user_id, filename, text)

                                finally:
                                    if os.path.exists(tmp_path):
                                        os.remove(tmp_path)

                                await client_websocket.send(json.dumps({
                                    "text": f"✅ '{filename}' uploaded & indexed"
                                }))


            async def receive_from_gemini():
                async for response in session.receive():

                    if response.tool_call:
                        calls = response.tool_call.function_calls
                        results = []

                        for call in calls:
                            fn = call.name
                            args = call.args

                            # Handle query_docs
                            if fn == "query_docs":
                                result = query_docs(args["query"], user_id)

                            # Handle delete_document
                            elif fn == "delete_document":
                                result = delete_document(user_id, args["filename"])

                            else:
                                result = f"Unknown tool call: {fn}"

                            results.append({
                                "name": fn,
                                "response": {"result": result},
                                "id": call.id
                            })

                        # Return tool results to Gemini model
                        await session.send(input=results)
                        continue

                    # ======= HANDLE MODEL OUTPUT (unchanged) =======
                    if response.server_content:
                        for part in response.server_content.model_turn.parts:
                            if hasattr(part, "text"):
                                await client_websocket.send(json.dumps({"text": part.text}))
                            elif hasattr(part, "inline_data"):
                                await client_websocket.send(json.dumps({
                                    "audio": base64.b64encode(part.inline_data.data).decode()
                                }))


            await asyncio.gather(
                asyncio.create_task(send_to_gemini()),
                asyncio.create_task(receive_from_gemini())
            )

    except Exception as e:
        print("Error:", e)


async def main():
    PORT = int(os.environ.get("PORT", 9084))
    async with websockets.serve(gemini_session_handler, "0.0.0.0", PORT):
        print("Running on port", PORT)
        await asyncio.Future()

if __name__ == "__main__":
    asyncio.run(main())
