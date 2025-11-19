# DocTalk – Voice-Powered Document Assistant

DocTalk lets you talk to your documents. Upload a PDF, click **Start Talking**, and have a real-time voice conversation powered by **Gemini Live**, **Google Speech/OCR**, **LlamaIndex**, and **Supabase**.

Ask anything like:
- “What certificates does this person have?”
- “When does this document expire?”
- “Summarize the key points.”

DocTalk listens, understands, pulls the right context from your PDFs, and speaks the answer back.

---

## ✨ Features

- 🎙️ **Voice-first experience** – no typing required
- 🔍 **RAG-powered answers** using Gemini 2.0 + LlamaIndex vector search
- 📄 **PDF understanding** with OCR fallback for scanned docs
- 🔐 **Google login** via Supabase Auth
- 🧠 **Document memory** via Supabase storage + embeddings
- 🚀 **Real-time WebSocket bridge** between browser mic and Gemini Live

---

## 🧱 System Architecture

```
┌─────────────┐     mic/audio     ┌─────────────┐    function calls    ┌──────────────┐
│  Browser    │◄────────────────► │ Python WS   │◄────────────────────►│  Gemini Live │
│  (Next.js)  │     chat UI       │  (main.py)  │   Embeddings + OCR   │ (models/g2)  │
└────┬────────┘                   └────┬────────┘                      └────┬─────────┘
     │   Supabase Auth + Storage        │  Supabase vector DB               │
     ▼                                  ▼                                   ▼
┌─────────────┐                 ┌──────────────┐                    ┌──────────────┐
│ Supabase    │◄───────────────►│ LlamaIndex   │◄──────────────────►│ Google Cloud │
│ Auth/Storage│   doc blobs     │ embeddings   │    OCR / STT       │ Vision + STT │
└─────────────┘                 └──────────────┘                    └──────────────┘
```

---

## 🔐 Example Environment Files

Create `.env.local` (for Next.js) and `.env` (for Python). Example values below:

### `.env.local`
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
NEXT_PUBLIC_WS_URL=ws://localhost:9084
```

### `.env` / `.env.local` (for Python)
```env
GOOGLE_API_KEY=your_google_gemini_api_key
GOOGLE_APPLICATION_CREDENTIALS=etc/secrets/gcp-service-key.json
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key  # NEVER expose publicly
PORT=9084
```

> Place your Google service account JSON at `etc/secrets/gcp-service-key.json` (gitignored).

---

## 🧰 Prerequisites

| Tool | Version | Notes |
|------|---------|-------|
| Node.js | 18+ | For Next.js frontend |
| Python | 3.11+ | For backend WS bridge |
| Supabase | account | Auth + storage + Postgres |
| Google Cloud | apis enabled | Gemini, Speech-to-Text, Vision |

Enable these Google APIs:
- Vertex AI / Gemini
- Cloud Speech-to-Text
- Cloud Vision

Create a service account with `aiplatform.user`, `vision.user`, `speech.client` roles and download the JSON key.

---

## 🛠️ Installation & Setup

### 1. Clone repository
```bash
git https://github.com/malikdotexe/doc-Talk/
cd doc-talk
```

### 2. Frontend (Next.js 14)
```bash
npm install
cp .env.local.example .env.local  # create from template
npm run dev
# http://localhost:3000
```

### 3. Backend (Python WebSocket bridge)
```bash
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
python main.py  # starts on ws://0.0.0.0:9084
```

### 4. Supabase
1. Create project
2. Enable Google login (Auth > Providers)
3. Add redirect URLs:
   - Site URL: `http://localhost:3000`
   - Redirect URL: `http://localhost:3000/auth/callback`
4. Create storage bucket `pdfs`
5. Run `supabase_migration.sql` to set up tables + RPC

---

## 📦 Project Structure

```
Doc-Talk/
├── app/                  # Next.js (App Router)
│   ├── page.tsx          # Entry page
│   ├── layout.tsx
│   └── globals.css
├── components/           # UI components
│   ├── MainContent.tsx   # Voice controls + chat
│   ├── UploadedDocuments.tsx
│   └── LoginButton.tsx
├── hooks/
│   └── useAudioWebSocket.ts # Mic capture + WS streaming
├── lib/
│   └── supabaseClient.ts
├── main.py               # Python WS server
├── requirements.txt
├── package.json
├── supabase_migration.sql
└── etc/secrets/
    └── gcp-service-key.json (gitignored)
```

---

## 🔌 Key Components

| File | Description |
|------|-------------|
| `main.py` | WebSocket bridge between browser audio and Gemini Live. Handles speech transcription, OCR, Supabase storage, and function-calling. |
| `components/MainContent.tsx` | UI for voice controls, chat history, PDF viewer, upload progress. |
| `hooks/useAudioWebSocket.ts` | Handles microphone capture, PCM conversion, WebSocket streaming, audio playback. |
| `supabase_migration.sql` | Tables (`user_documents`, `document_chunks`) + stored procedure `match_document_chunks`. |

---

## 🧪 Usage Workflow

1. **Login** via Google OAuth (Supabase)
2. **Upload PDF** – stored in Supabase bucket + chunked via LlamaIndex
3. **Click Start Talking** – send microphone PCM stream to backend
4. **Gemini Live** transcribes + issues `query_docs` tool calls
5. **Supabase RPC** returns relevant chunks
6. **Gemini** answers with contextual voice + text
7. **Frontend** displays conversation + plays audio reply

---

## 🚢 Deployment

### Frontend
- Deploy Next.js to Vercel/Netlify/Render
- Set `NEXT_PUBLIC_WS_URL` to your backend WebSocket URL

### Backend
- Deploy `main.py` service to Render/Railway/Fly.io
- Ensure long-lived WebSocket connections are supported
- Set environment variables (Google/Supabase keys)
- Mount `etc/secrets/gcp-service-key.json` or use secret manager

### Supabase
- Use hosted Supabase or self-host
- Make sure `pdfs` bucket allows authenticated uploads

---

## 🧭 What's Next

### ✅ Completed
- Voice conversation loop (mic → Gemini → audio reply)
- OCR fallback for image-only PDFs
- Multi Document Context Window
- Supabase vector search + RPC
- Conversation UI with live transcription
- Doc upload, listing, and deletion

### 🔜 Roadmap
- 📌 Citation highlights in PDF viewer
- 📝 Export answers as notes/summaries

---

## 🧪 Testing

```bash
# Frontend lint
npm run lint

# Backend manual test
python main.py  # with DEBUG logs
```

Manual test script:
1. Run backend & frontend
2. Login via Google
3. Upload sample PDF (text + scanned)
4. Ask: “What’s the certificate date?”
5. Confirm chat shows both question + DocTalk response
6. Verify Supabase tables updated

---

## 🆘 Troubleshooting

| Issue | Fix |
|-------|-----|
| `401 Request had invalid authentication credentials` | Ensure `GOOGLE_APPLICATION_CREDENTIALS` points to valid service account with Vision/Speech/Gemini access. |
| Gemini returns `executableCode` parts | Live API sometimes sends tool suggestions; we ignore executable code and rely on declared tools. |
| No text extracted from PDFs | Set `useOCR=true` when uploading, ensure Vision API enabled. |
| WebSocket fails in production | Use `wss://` and enable CORS/websocket upgrades on hosting provider. |
| Audio playback silent | Check browser mic permissions, use HTTPS, ensure AudioWorklet registered (`/pcm-processor.js`). |

---

## 🤝 Contributing

1. Fork the repo
2. Create a feature branch
3. Submit PR with description + screenshots/tests

