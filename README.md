# Doc-Talk

Don't just chat with your documents—talk to them. Upload a PDF, report, or research paper, and have a real-time voice-to-voice conversation powered by **Gemini Live + LlamaIndex(RAG)**.  
Ask questions out loud, get instant spoken answers, and dive deeper without ever typing. It's like giving your documents a voice.

---

## 🚀 Features
- 🎙️ **Voice-first Experience**: Talk naturally with your PDFs in real time.  
- ⚡ **Instant Answers**: Powered by Gemini Live + LangChain for contextual insights.  
- 📄 **PDF Understanding**: Upload any PDF (reports, contracts, notes) and query instantly.  

---

## 🛠️ Tech Stack

### Frontend
- **Next.js 14** (App Router)
- **TypeScript**
- **Tailwind CSS**
- **React Hooks**

### Backend
- **Python 3.13**
- **websockets**
- **google-genai**
- **LlamaIndex/ LangChain**

---

## 🔧 Setup

### Prerequisites
- Node.js 18+ and npm/yarn
- Python 3.13+
- Google Gemini API Key

### Frontend Setup

1. Install dependencies:
```bash
npm install
```

2. Create a `.env.local` file (optional - defaults to production WebSocket):
```bash
NEXT_PUBLIC_WS_URL=ws://localhost:9084  # For local development
```

3. Run the development server:
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Backend Setup

1. Create a virtual environment:
```bash
python3 -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate
```

2. Install Python dependencies:
```bash
pip install -r requirements.txt
```

3. Create a `.env` file:
```bash
GOOGLE_API_KEY=your_google_gemini_api_key_here
```

4. Run the backend WebSocket server:
```bash
python main.py
```

By default, it binds to `ws://localhost:9084`

---

## 📦 Project Structure

```
Doc-Talk/
├── app/                    # Next.js app directory
│   ├── layout.tsx         # Root layout
│   ├── page.tsx           # Home page
│   └── globals.css        # Global styles
├── components/            # React components
│   ├── Header.tsx
│   ├── Hero.tsx
│   ├── MainContent.tsx
│   ├── Features.tsx
│   ├── Demo.tsx
│   └── Footer.tsx
├── hooks/                 # Custom React hooks
│   └── useAudioWebSocket.ts
├── public/                # Static files
│   └── pcm-processor.js   # AudioWorklet processor
├── main.py               # Python WebSocket server
├── requirements.txt      # Python dependencies
└── package.json          # Node.js dependencies
```

---

## 🚀 Deployment

### Frontend (Next.js)
Deploy to Vercel, Netlify, or any platform that supports Next.js:
```bash
npm run build
npm start
```

### Backend (Python)
Deploy the Python server to Render, Railway, or any platform that supports Python WebSocket servers.

Set the `GOOGLE_API_KEY` environment variable in your deployment platform.

Update `NEXT_PUBLIC_WS_URL` in your frontend environment variables to point to your deployed backend.

---

## 📝 Environment Variables

### Frontend (.env.local)
- `NEXT_PUBLIC_WS_URL` - WebSocket server URL (optional, defaults to production)

### Backend (.env)
- `GOOGLE_API_KEY` - Your Google Gemini API key (required)

---

## 📚 Development

### Building for Production
```bash
npm run build
```

### Running Production Build
```bash
npm start
```

### Linting
```bash
npm run lint
```

---

## 📸 Screenshot
<img width="1440" height="900" alt="Screenshot 2025-09-26 at 12 28 08 PM" src="https://github.com/user-attachments/assets/d154feb8-5c35-4a69-92bf-a682a3a56b48" />
