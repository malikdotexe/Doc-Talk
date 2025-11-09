export default function Footer() {
  return (
    <footer className="bg-[#0f0f23] border-t border-white/10 py-12 px-8">
      <div className="max-w-6xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
          <div>
            <div className="flex items-center space-x-3 mb-4">
              <div className="w-8 h-8 bg-gradient-to-br from-[#4a00e0] to-[#8e2de2] rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">📄</span>
              </div>
              <span className="text-xl font-bold text-white">DocTalk</span>
            </div>
            <p className="text-gray-400 text-sm">
              AI-powered document assistant for natural conversations with your PDFs.
            </p>
          </div>

          <div>
            <h4 className="text-white font-semibold mb-4">Technology</h4>
            <ul className="space-y-2 text-sm text-gray-400">
              <li>Gemini Live API</li>
              <li>LangChain</li>
              <li>Supabase</li>
              <li>WebRTC</li>
            </ul>
          </div>

          <div>
            <h4 className="text-white font-semibold mb-4">Connect</h4>
            <p className="text-gray-400 text-sm">
              Built with ❤️ by Piyush Malik
            </p>
          </div>
        </div>

        <div className="border-t border-white/10 pt-8 text-center">
          <p className="text-gray-500 text-sm">
            © 2025 DocTalk. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}