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

# Verify embedding dimension on startup
def verify_embedding_dimension():
    """Check and print the embedding dimension to ensure database compatibility."""
    try:
        test_embedding = gemini_embedding_model.get_text_embedding("test")
        dimension = len(test_embedding)
        print(f"✅ Embedding dimension: {dimension} (ensure your Supabase vector column matches this)")
        return dimension
    except Exception as e:
        print(f"⚠️ Warning: Could not verify embedding dimension: {e}")
        return None

# Verify on module load
EMBEDDING_DIMENSION = verify_embedding_dimension()

# === Text Extraction ===
def extract_text_no_ocr(path):
    """Extract text from PDF using PyMuPDF (fitz) - works for text-based PDFs."""
    try:
        doc = fitz.open(path)
        text = ""
        for page_num in range(len(doc)):
            page = doc[page_num]
            text += page.get_text()
        doc.close()
        return text
    except Exception as e:
        print(f"Error extracting text without OCR: {e}")
        raise

def extract_text_with_ocr(path):
    """Extract text from PDF using OCR - converts PDF pages to images first."""
    try:
        doc = fitz.open(path)
        full_text = ""
        
        for page_num in range(len(doc)):
            page = doc[page_num]
            
            # Convert PDF page to image (PNG)
            # Use a higher zoom factor for better OCR accuracy
            zoom = 2.0
            mat = fitz.Matrix(zoom, zoom)
            pix = page.get_pixmap(matrix=mat)
            img_bytes = pix.tobytes("png")
            
            # Use Google Cloud Vision to extract text from image
            image = vision.Image(content=img_bytes)
            response = vision_client.document_text_detection(image=image)
            
            if response.full_text_annotation:
                full_text += response.full_text_annotation.text + "\n"
            else:
                # Fallback to regular text extraction if OCR fails
                full_text += page.get_text() + "\n"
        
        doc.close()
        return full_text
    except Exception as e:
        print(f"Error extracting text with OCR: {e}")
        # Fallback to non-OCR extraction if OCR fails
        print("Falling back to non-OCR text extraction...")
        return extract_text_no_ocr(path)

# === Chunk + Embedding Storage ===

def store_chunks_and_embeddings(user_id, filename, text):
    """Chunk text and store embeddings in Supabase."""
    try:
        if not text or not text.strip():
            print(f"Warning: Empty text extracted from {filename}")
            return
        
        doc = Document(text=text)
        nodes = parser.get_nodes_from_documents([doc])
        
        if not nodes:
            print(f"Warning: No chunks created from {filename}")
            return

        print(f"Processing {len(nodes)} chunks for {filename}...")
        
        # Delete existing chunks for this document first (in case of re-indexing)
        supabase.table("document_chunks").delete().match({
            "user_id": user_id,
            "filename": filename
        }).execute()
        
        for i, node in enumerate(nodes):
            try:
                # Generate embedding
                embedding = gemini_embedding_model.get_text_embedding(node.text)
                
                # Insert chunk with embedding
                result = supabase.table("document_chunks").insert({
                    "user_id": user_id,
                    "filename": filename,
                    "chunk": node.text,
                    "embedding": embedding
                }).execute()
                
                if i % 10 == 0:
                    print(f"  Stored {i+1}/{len(nodes)} chunks...")
                    
            except Exception as e:
                print(f"Error storing chunk {i} for {filename}: {e}")
                continue
        
        print(f"✅ Successfully indexed {len(nodes)} chunks for {filename}")
        
    except Exception as e:
        print(f"Error in store_chunks_and_embeddings for {filename}: {e}")
        raise

def delete_document(user_id, filename):
    """Delete a document and all its associated data."""
    try:
        print(f"🗑️ Deleting document {filename} for user {user_id}")
        
        # 1. Delete embedding chunks
        chunks_result = supabase.table("document_chunks").delete().match({
            "user_id": user_id,
            "filename": filename
        }).execute()
        print(f"  Deleted chunks: {len(chunks_result.data) if chunks_result.data else 0}")

        # 2. Delete metadata
        metadata_result = supabase.table("user_documents").delete().match({
            "user_id": user_id,
            "filename": filename
        }).execute()
        print(f"  Deleted metadata")

        # 3. Delete the file from Storage
        storage_path = f"{user_id}/{filename}"
        storage_result = supabase.storage.from_("pdfs").remove([storage_path])
        print(f"  Deleted file from storage")

        print(f"✅ Successfully deleted {filename}")
        return f"Deleted {filename}"
        
    except Exception as e:
        error_msg = f"Error deleting document {filename}: {str(e)}"
        print(f"❌ {error_msg}")
        import traceback
        traceback.print_exc()
        return error_msg

# === Query ===
def query_docs(query, user_id):
    """Query document chunks using vector similarity search."""
    try:
        print(f"🔍 Querying documents for user {user_id}: {query}")
        
        # Generate query embedding
        query_embedding = gemini_embedding_model.get_text_embedding(query)
        print(f"  Generated query embedding (dim: {len(query_embedding)})")

        # Call Supabase RPC function for vector similarity search
        response = supabase.rpc(
            "match_document_chunks",
            {
                "query_embedding": query_embedding,
                "match_user_id": user_id,
                "match_count": 5
            }
        ).execute()

        if not response.data:
            return "No relevant documents found. Please upload and index documents first."

        chunks = [row["chunk"] for row in response.data]
        context = "\n\n".join(chunks)
        
        print(f"  Found {len(chunks)} relevant chunks")

        # Generate answer using LLM
        answer = llm.complete(
            f"Context:\n{context}\n\nQuestion: {query}\nAnswer:"
        )

        return str(answer)
        
    except Exception as e:
        error_msg = f"Error querying documents: {str(e)}"
        print(f"❌ {error_msg}")
        import traceback
        traceback.print_exc()
        return f"Error: {error_msg}. Make sure the 'match_document_chunks' function exists in your Supabase database."


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

                    # Handle direct tool_call from client (e.g., delete_document)
                    if "realtime_input" in data and "tool_call" in data["realtime_input"]:
                        tool_call_data = data["realtime_input"]["tool_call"]
                        if "function_calls" in tool_call_data:
                            for call in tool_call_data["function_calls"]:
                                fn = call.get("name")
                                args = call.get("args", {})
                                
                                try:
                                    # Handle delete_document directly
                                    if fn == "delete_document":
                                        result = delete_document(user_id, args.get("filename", ""))
                                        # Send confirmation back to client
                                        await client_websocket.send(json.dumps({
                                            "text": f"✅ {result}"
                                        }))
                                    # Handle query_docs directly if needed
                                    elif fn == "query_docs":
                                        result = query_docs(args.get("query", ""), user_id)
                                        await client_websocket.send(json.dumps({
                                            "text": f"🔍 {result}"
                                        }))
                                    else:
                                        await client_websocket.send(json.dumps({
                                            "text": f"❌ Unknown function: {fn}"
                                        }))
                                except Exception as e:
                                    error_msg = f"Error executing {fn}: {str(e)}"
                                    print(f"❌ {error_msg}")
                                    import traceback
                                    traceback.print_exc()
                                    await client_websocket.send(json.dumps({
                                        "text": f"❌ {error_msg}"
                                    }))
                        continue

                    if "realtime_input" in data:
                        for chunk in data["realtime_input"].get("media_chunks", []):
                            if chunk["mime_type"] == "audio/pcm":
                                await session.send(input=chunk)

                            elif chunk["mime_type"] == "application/pdf":
                                filename = chunk["filename"]
                                use_ocr = chunk.get("ocr", False)
                                storage_path = chunk["storage_path"]  # Already uploaded from frontend

                                try:
                                    print(f"📄 Processing PDF: {filename} (OCR: {use_ocr})")
                                    
                                    # 1) Download raw PDF bytes directly from Supabase
                                    try:
                                        download_response = supabase.storage.from_("pdfs").download(storage_path)
                                        
                                        # Handle different response types from Supabase Python client
                                        if isinstance(download_response, bytes):
                                            pdf_bytes = download_response
                                        elif hasattr(download_response, 'data'):
                                            pdf_bytes = download_response.data
                                        elif hasattr(download_response, 'content'):
                                            pdf_bytes = download_response.content
                                        else:
                                            # Try to read as bytes if it's a file-like object
                                            pdf_bytes = download_response.read() if hasattr(download_response, 'read') else download_response
                                        
                                        if not pdf_bytes:
                                            raise Exception(f"Download returned empty data for {storage_path}")
                                    except Exception as download_error:
                                        raise Exception(f"Failed to download PDF from Supabase: {str(download_error)}")
                                    
                                    print(f"  Downloaded {len(pdf_bytes)} bytes")

                                    # 2) Insert metadata if not exists (avoid duplicates)
                                    metadata_result = supabase.table("user_documents").upsert({
                                        "user_id": user_id,
                                        "filename": filename,
                                        "original_path": storage_path
                                    }, on_conflict="user_id,filename").execute()
                                    print(f"  Metadata stored/updated")

                                    # 3) Write to a temporary file
                                    os.makedirs("./tmp", exist_ok=True)
                                    # Sanitize filename to avoid path issues
                                    safe_filename = filename.replace("/", "_").replace("\\", "_")
                                    tmp_path = f"./tmp/{safe_filename}"

                                    try:
                                        with open(tmp_path, "wb") as f:
                                            f.write(pdf_bytes)
                                        print(f"  Saved to temporary file: {tmp_path}")

                                        # 4) OCR or normal extract
                                        print(f"  Extracting text...")
                                        if use_ocr:
                                            text = extract_text_with_ocr(tmp_path)
                                        else:
                                            text = extract_text_no_ocr(tmp_path)
                                        
                                        if not text or not text.strip():
                                            raise Exception("No text extracted from PDF")
                                        
                                        print(f"  Extracted {len(text)} characters")

                                        # 5) Store chunk embeddings
                                        store_chunks_and_embeddings(user_id, filename, text)

                                        # 6) Send success acknowledgment back to UI
                                        await client_websocket.send(json.dumps({
                                            "text": f"✅ '{filename}' uploaded & indexed successfully"
                                        }))
                                        print(f"✅ Successfully processed {filename}")

                                    except Exception as e:
                                        error_msg = f"Error processing PDF {filename}: {str(e)}"
                                        print(f"❌ {error_msg}")
                                        await client_websocket.send(json.dumps({
                                            "text": f"❌ Error indexing '{filename}': {str(e)}"
                                        }))
                                    
                                    finally:
                                        # Clean up temporary file
                                        if os.path.exists(tmp_path):
                                            try:
                                                os.remove(tmp_path)
                                            except:
                                                pass

                                except Exception as e:
                                    error_msg = f"Failed to process PDF {filename}: {str(e)}"
                                    print(f"❌ {error_msg}")
                                    import traceback
                                    traceback.print_exc()
                                    await client_websocket.send(json.dumps({
                                        "text": f"❌ Error: {error_msg}"
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
    async with websockets.serve(
        gemini_session_handler,
        "0.0.0.0",
        PORT,
        max_size=50 * 1024 * 1024  # 50MB
    ):
        print("Running on port", PORT)
        await asyncio.Future()

if __name__ == "__main__":
    asyncio.run(main())
