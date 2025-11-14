import asyncio
import json
import os
import websockets
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

from google.cloud import speech

load_dotenv()

# === Environment ===
MODEL = "models/gemini-2.0-flash-exp"
gemini_api_key = os.getenv('GOOGLE_API_KEY')
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
vision_client = vision.ImageAnnotatorClient()
parser = SimpleNodeParser(chunk_size=500)

gemini_embedding_model = GeminiEmbedding(api_key=gemini_api_key, model_name="models/text-embedding-004")
llm = Gemini(api_key=gemini_api_key, model_name="models/gemini-2.5-flash")


speech_client = speech.SpeechClient()

# Verify embedding dimension on startup
def verify_embedding_dimension():
    try:
        test_embedding = gemini_embedding_model.get_text_embedding("test")
        dimension = len(test_embedding)
        print(f"✅ Embedding dimension: {dimension}")
        return dimension
    except Exception as e:
        print(f"⚠️ Warning: Could not verify embedding dimension: {e}")
        return None

EMBEDDING_DIMENSION = verify_embedding_dimension()

# === Text Extraction (keep your existing functions) ===
def extract_text_no_ocr(path):
    try:
        doc = fitz.open(path)
        text = "".join(page.get_text() for page in doc)
        doc.close()
        return text
    except Exception as e:
        print(f"Error extracting text without OCR: {e}")
        raise

def extract_text_with_ocr(path):
    try:
        doc = fitz.open(path)
        full_text = ""
        for page in doc:
            zoom = 2.0
            mat = fitz.Matrix(zoom, zoom)
            pix = page.get_pixmap(matrix=mat)
            img_bytes = pix.tobytes("png")
            image = vision.Image(content=img_bytes)
            response = vision_client.document_text_detection(image=image)
            if response.full_text_annotation:
                full_text += response.full_text_annotation.text + "\n"
            else:
                full_text += page.get_text() + "\n"
        doc.close()
        return full_text
    except Exception as e:
        print(f"Error with OCR: {e}, falling back")
        return extract_text_no_ocr(path)

def transcribe_audio(audio_data):
    """Transcribe base64 PCM audio to text"""
    try:
        # Decode base64 to bytes
        audio_bytes = base64.b64decode(audio_data)
        
        # Create speech recognition request
        audio = speech.RecognitionAudio(content=audio_bytes)
        config = speech.RecognitionConfig(
            encoding=speech.RecognitionConfig.AudioEncoding.LINEAR16,
            sample_rate_hertz=16000,
            language_code="en-US",
            enable_automatic_punctuation=True,
        )
        
        # Transcribe
        response = speech_client.recognize(config=config, audio=audio)
        
        # Extract transcript
        if response.results:
            return response.results[0].alternatives[0].transcript
        return ""
    except Exception as e:
        print(f"Transcription error: {e}")
        return ""

def store_chunks_and_embeddings(user_id, filename, text):
    try:
        if not text or not text.strip():
            print(f"Warning: Empty text from {filename}")
            return
        doc = Document(text=text)
        nodes = parser.get_nodes_from_documents([doc])
        if not nodes:
            print(f"Warning: No chunks from {filename}")
            return
        print(f"Processing {len(nodes)} chunks for {filename}...")
        supabase.table("document_chunks").delete().match({
            "user_id": user_id, "filename": filename
        }).execute()
        for i, node in enumerate(nodes):
            try:
                embedding = gemini_embedding_model.get_text_embedding(node.text)
                supabase.table("document_chunks").insert({
                    "user_id": user_id,
                    "filename": filename,
                    "chunk": node.text,
                    "embedding": embedding
                }).execute()
                if i % 10 == 0:
                    print(f"  Stored {i+1}/{len(nodes)} chunks...")
            except Exception as e:
                print(f"Error storing chunk {i}: {e}")
                continue
        print(f"✅ Successfully indexed {len(nodes)} chunks for {filename}")
    except Exception as e:
        print(f"Error in store_chunks_and_embeddings: {e}")
        raise

def delete_document(user_id, filename):
    try:
        print(f"🗑️ Deleting {filename}")
        supabase.table("document_chunks").delete().match({
            "user_id": user_id, "filename": filename
        }).execute()
        supabase.table("user_documents").delete().match({
            "user_id": user_id, "filename": filename
        }).execute()
        storage_path = f"{user_id}/{filename}"
        supabase.storage.from_("pdfs").remove([storage_path])
        print(f"✅ Deleted {filename}")
        return f"Deleted {filename}"
    except Exception as e:
        print(f"❌ Error deleting: {e}")
        return str(e)

def query_docs(query, user_id):
    try:
        print(f"🔍 Query: {query}")
        query_embedding = gemini_embedding_model.get_text_embedding(query)
        response = supabase.rpc("match_document_chunks", {
            "query_embedding": query_embedding,
            "match_user_id": user_id,
            "match_count": 5
        }).execute()
        if not response.data:
            return "No relevant documents found."
        chunks = [row["chunk"] for row in response.data]
        context = "\n\n".join(chunks)
        print(f"  Found {len(chunks)} chunks")
        answer = llm.complete(f"Context:\n{context}\n\nQuestion: {query}\nAnswer:")
        return str(answer)
    except Exception as e:
        print(f"❌ Query error: {e}")
        return f"Error: {str(e)}"

# Tool declarations for Gemini
tool_query_docs = {
    "function_declarations": [{
        "name": "query_docs",
        "description": "Query per-user vector database.",
        "parameters": {
            "type": "OBJECT",
            "properties": {"query": {"type": "STRING"}},
            "required": ["query"]
        }
    }]
}

tool_delete_doc = {
    "function_declarations": [{
        "name": "delete_document",
        "description": "Delete a document and its embeddings",
        "parameters": {
            "type": "OBJECT",
            "properties": {"filename": {"type": "STRING"}},
            "required": ["filename"]
        }
    }]
}


async def gemini_session_handler(client_websocket):
    """
    Handle a WebSocket connection from the frontend client.
    This acts as a proxy between the client and Google's Gemini Live API.
    """
    gemini_ws = None
    user_id = None
    
    try:
        print("🔌 New client connection")
        
        # 1. Receive setup message from client
        config_message = await client_websocket.recv()
        config_data = json.loads(config_message)
        user_id = config_data.get("setup", {}).get("user_id")
        
        if not user_id:
            await client_websocket.send(json.dumps({"text": "❌ user_id required"}))
            return
        
        print(f"👤 User: {user_id}")
        
        # 2. Connect to Gemini Live API
        gemini_uri = f"wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key={gemini_api_key}"
        
        gemini_ws = await websockets.connect(
            gemini_uri,
            additional_headers={"Content-Type": "application/json"}
        )
        print("✅ Connected to Gemini Live API")
        
        # 3. Send setup to Gemini
        gemini_setup = {
            "setup": {
                "model": MODEL,
                "system_instruction": {
                    "parts": [{"text": "You MUST use query_docs for all answers."}]
                },
                "tools": [tool_query_docs, tool_delete_doc]
            }
        }
        await gemini_ws.send(json.dumps(gemini_setup))
        
        # 4. Wait for setup response
        setup_response = await gemini_ws.recv()
        print("✅ Gemini setup complete")
        
        user_transcript = ""
        transcription_chunks = []  # ← MOVED INSIDE the handler function

        # 5. Create bidirectional message relay
        async def client_to_gemini():
            """Forward messages from client to Gemini"""
            nonlocal transcription_chunks  # ← Allow modification of outer variable
            
            try:
                async for message in client_websocket:
                    data = json.loads(message)
                    
                    # Handle direct tool calls from client (delete operations)
                    if "realtime_input" in data and "tool_call" in data["realtime_input"]:
                        tool_call = data["realtime_input"]["tool_call"]
                        if "function_calls" in tool_call:
                            for call in tool_call["function_calls"]:
                                fn = call.get("name")
                                args = call.get("args", {})
                                
                                if fn == "delete_document":
                                    result = delete_document(user_id, args.get("filename", ""))
                                    await client_websocket.send(json.dumps({"text": f"✅ {result}"}))
                                elif fn == "query_docs":
                                    result = query_docs(args.get("query", ""), user_id)
                                    await client_websocket.send(json.dumps({"text": f"🔍 {result}"}))
                        continue
                    
                    # Handle PDF uploads (don't send to Gemini)
                    if "realtime_input" in data:
                        chunks = data["realtime_input"].get("media_chunks", [])
                        for chunk in chunks:
                            if chunk.get("mime_type") == "application/pdf":
                                # Process PDF locally
                                await process_pdf(client_websocket, user_id, chunk)
                                continue
                            
                            # Handle audio
                            if chunk.get("mime_type") == "audio/pcm":
                                print(f"🎤 Audio chunk ({len(chunk.get('data', ''))} bytes)")
                                
                                # Transcribe this chunk
                                transcript = transcribe_audio(chunk.get('data', ''))
                                if transcript:
                                    transcription_chunks.append(transcript)
                                    user_transcript = " ".join(transcription_chunks)
                                    
                                    # Send partial transcription to frontend
                                    await client_websocket.send(json.dumps({
                                        "user_transcript": user_transcript,
                                        "transcript_partial": True
                                    }))
                                
                                # Forward audio to Gemini
                                await gemini_ws.send(json.dumps(data))
            except websockets.exceptions.ConnectionClosed:
                print("🔌 Client disconnected")
            except Exception as e:
                print(f"❌ client_to_gemini error: {e}")
        
        async def gemini_to_client():
            """Forward messages from Gemini to client"""
            nonlocal transcription_chunks  # ← Allow modification of outer variable
            
            try:
                async for raw_response in gemini_ws:
                    response = json.loads(raw_response)
                    

                    # Handle tool calls from Gemini
                    if "toolCall" in response:
                        print("🔧 Tool call from Gemini")
                        function_calls = response["toolCall"].get("functionCalls", [])
                        function_responses = []
                        
                        for fc in function_calls:
                            name = fc.get("name")
                            args = fc.get("args", {})
                            call_id = fc.get("id")
                            
                            if name == "query_docs":
                                try:
                                    result = query_docs(args.get("query", ""), user_id)
                                    function_responses.append({
                                        "name": name,
                                        "response": {"result": result},
                                        "id": call_id
                                    })
                                    print("✅ query_docs executed")
                                except Exception as e:
                                    print(f"❌ query_docs error: {e}")
                                    function_responses.append({
                                        "name": name,
                                        "response": {"error": str(e)},
                                        "id": call_id
                                    })
                            
                            elif name == "delete_document":
                                try:
                                    result = delete_document(user_id, args.get("filename", ""))
                                    function_responses.append({
                                        "name": name,
                                        "response": {"result": result},
                                        "id": call_id
                                    })
                                    print("✅ delete_document executed")
                                except Exception as e:
                                    print(f"❌ delete_document error: {e}")
                                    function_responses.append({
                                        "name": name,
                                        "response": {"error": str(e)},
                                        "id": call_id
                                    })
                        
                        # Send function responses back to Gemini
                        if function_responses:
                            await gemini_ws.send(json.dumps({
                                "tool_response": {"function_responses": function_responses}
                            }))
                        continue
                    
                    # Forward server content to client
                    if "serverContent" in response:
                        server_content = response["serverContent"]
                        print(f"📦 Server content: {json.dumps(server_content, indent=2, default=str)[:500]}...")
                        
                        # Extract text
                        if "modelTurn" in server_content:
                            parts = server_content["modelTurn"].get("parts", [])
                            print(f"📝 Parts found: {len(parts)}")
                            for i, part in enumerate(parts):
                                print(f"🔸 Part {i}: {json.dumps(part, indent=2, default=str)[:200]}...")
                                if "text" in part:
                                    print(f"💬 Text: {part['text'][:50]}...")
                                    await client_websocket.send(json.dumps({"text": part["text"]}))
                                
                                if "inlineData" in part:
                                    print(f"🔊 Audio data found")
                                    await client_websocket.send(json.dumps({
                                        "audio": part["inlineData"]["data"]
                                    }))
                                if "codeExecutionResult" in part:
                                    result_text = part["codeExecutionResult"].get("output", "").strip()
                                    if result_text:
                                        try:
                                            # Parse the JSON string and extract the result
                                            import ast
                                            result_dict = ast.literal_eval(result_text)
                                            clean_result = result_dict.get('result', result_text)
                                            # Prefix with DocTalk
                                            formatted_result = f"DocTalk: {clean_result}"
                                            print(f"🔧 Tool result: {formatted_result}")
                                            await client_websocket.send(json.dumps({"text": formatted_result}))
                                        except (ValueError, SyntaxError) as e:
                                            # Fallback if parsing fails
                                            formatted_result = f"DocTalk: {result_text}"
                                            print(f"🔧 Tool result (fallback): {formatted_result}")
                                            await client_websocket.send(json.dumps({"text": formatted_result}))
                        
                        if server_content.get("turnComplete"):
                            print("✅ Turn complete - clearing transcription chunks")
                            # ← CRITICAL FIX: Clear transcription chunks after each complete turn
                            transcription_chunks = []
                    
            except websockets.exceptions.ConnectionClosed:
                print("🔌 Gemini disconnected")
            except Exception as e:
                print(f"❌ gemini_to_client error: {e}")
        
        # Run both relay tasks concurrently
        await asyncio.gather(
            client_to_gemini(),
            gemini_to_client(),
            return_exceptions=True
        )
        
    except Exception as e:
        print(f"❌ Session error: {e}")
        import traceback
        traceback.print_exc()
    finally:
        if gemini_ws:
            await gemini_ws.close()
        print(f"🏁 Session ended for {user_id}")

async def process_pdf(client_websocket, user_id, chunk):
    """Process PDF upload separately"""
    try:
        filename = chunk["filename"]
        storage_path = chunk["storage_path"]
        use_ocr = chunk.get("ocr", False)
        
        print(f"📄 Processing {filename}")
        
        # Download from Supabase
        download_response = supabase.storage.from_("pdfs").download(storage_path)
        if isinstance(download_response, bytes):
            pdf_bytes = download_response
        elif hasattr(download_response, 'data'):
            pdf_bytes = download_response.data
        else:
            pdf_bytes = download_response.read() if hasattr(download_response, 'read') else download_response
        
        # Store metadata
        supabase.table("user_documents").upsert({
            "user_id": user_id,
            "filename": filename,
            "original_path": storage_path
        }, on_conflict="user_id,filename").execute()
        
        # Extract and store
        os.makedirs("./tmp", exist_ok=True)
        tmp_path = f"./tmp/{filename.replace('/', '_')}"
        
        try:
            with open(tmp_path, "wb") as f:
                f.write(pdf_bytes)
            
            text = extract_text_with_ocr(tmp_path) if use_ocr else extract_text_no_ocr(tmp_path)
            store_chunks_and_embeddings(user_id, filename, text)
            
            await client_websocket.send(json.dumps({
                "text": f"✅ '{filename}' uploaded & indexed"
            }))
        finally:
            if os.path.exists(tmp_path):
                os.remove(tmp_path)
                
    except Exception as e:
        print(f"❌ PDF error: {e}")
        await client_websocket.send(json.dumps({"text": f"❌ Error: {str(e)}"}))


async def main():
    PORT = int(os.environ.get("PORT", 9084))
    async with websockets.serve(
        gemini_session_handler,
        "0.0.0.0",
        PORT,
        max_size=50 * 1024 * 1024,
        ping_interval=20,
        ping_timeout=20
    ):
        print(f"🚀 Server running on port {PORT}")
        await asyncio.Future()


if __name__ == "__main__":
    asyncio.run(main())
