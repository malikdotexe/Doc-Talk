export default function Features() {
  return (
    <section className="py-24 px-8 bg-gradient-to-b from-[#16213e] to-[#1a1a2e]">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold text-white mb-4">Why Choose DocTalk?</h2>
          <p className="text-xl text-gray-400 max-w-2xl mx-auto">
            Experience the future of document interaction with our cutting-edge AI technology
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="glass rounded-2xl p-8 text-center hover:bg-white/15 transition-all duration-300 transform hover:-translate-y-2">
            <div className="w-16 h-16 bg-gradient-to-br from-[#4a00e0] to-[#8e2de2] rounded-2xl flex items-center justify-center mx-auto mb-6 text-2xl">
              🎙️
            </div>
            <h3 className="text-xl font-bold text-white mb-4">Voice-First Experience</h3>
            <p className="text-gray-400 leading-relaxed">
              Talk naturally with your documents in real time using advanced speech recognition and AI.
            </p>
          </div>

          <div className="glass rounded-2xl p-8 text-center hover:bg-white/15 transition-all duration-300 transform hover:-translate-y-2">
            <div className="w-16 h-16 bg-gradient-to-br from-[#667eea] to-[#764ba2] rounded-2xl flex items-center justify-center mx-auto mb-6 text-2xl">
              ⚡
            </div>
            <h3 className="text-xl font-bold text-white mb-4">Instant Answers</h3>
            <p className="text-gray-400 leading-relaxed">
              Powered by Gemini Live + LangChain for lightning-fast contextual insights and responses.
            </p>
          </div>

          <div className="glass rounded-2xl p-8 text-center hover:bg-white/15 transition-all duration-300 transform hover:-translate-y-2">
            <div className="w-16 h-16 bg-gradient-to-br from-[#f093fb] to-[#f5576c] rounded-2xl flex items-center justify-center mx-auto mb-6 text-2xl">
              📄
            </div>
            <h3 className="text-xl font-bold text-white mb-4">Smart PDF Understanding</h3>
            <p className="text-gray-400 leading-relaxed">
              Upload reports, contracts, or notes and query instantly with advanced document parsing.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}