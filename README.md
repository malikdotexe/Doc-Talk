# Doc-Talk

Don’t just chat with your documents—talk to them. Upload a PDF, report, or research paper, and have a real-time voice-to-voice conversation powered by **Gemini Live + LangChain**.  
Ask questions out loud, get instant spoken answers, and dive deeper without ever typing. It’s like giving your documents a voice.

---

## 🚀 Features
- 🎙️ **Voice-first Experience**: Talk naturally with your PDFs in real time.  
- ⚡ **Instant Answers**: Powered by Gemini Live + LangChain for contextual insights.  
- 📄 **PDF Understanding**: Upload any PDF (reports, contracts, notes) and query instantly.  

---

## 🔧 Environment Variables

Create a `.env` file in the project root:

```
# .env.example
GOOGLE_API_KEY=your_google_gemini_api_key_here
```
On Render or any deployment platform, set GOOGLE_API_KEY in the service’s Environment Variables.

📦 Installation
Clone the repo:

```
git clone https://github.com/malikdotexe/doc-talk.git
cd doc-talk
```

Create a virtual environment and install dependencies:

```
python3 -m venv .venv
source .venv/bin/activate    # On Windows: .venv\Scripts\activate
pip install -r requirements.txt
```
▶️ Starting the Backend (WebSocket server)
Run locally:

```
python main.py
```
By default, it binds to:
ws://localhost:9084
On Render (or any cloud platform), it binds automatically to:


💻 Running the Frontend
Open index.html in your browser:
```
python -m http.server 8080
```
Then visit:
```
http://localhost:8080/index.html
```

The frontend connects to the backend WebSocket server.
Update the const URL in index.html depending on your environment:

```
// For local development
const URL = "ws://localhost:9084";
```


📚 Tech Stack

Python 3.13
websockets
google-genai
LangChain
Render (deployment)

Screenshot-
<img width="1440" height="900" alt="Screenshot 2025-09-26 at 12 28 08 PM" src="https://github.com/user-attachments/assets/d154feb8-5c35-4a69-92bf-a682a3a56b48" />
