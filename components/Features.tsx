export default function Features() {
  return (
    <section className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-6 py-16 px-16 text-center">
      <div>
        <div className="text-[32px]">🎙️</div>
        <h3 className="mt-3 text-lg font-semibold">Voice-first Experience</h3>
        <p className="text-gray-600 mt-2">Talk naturally with your documents in real time.</p>
      </div>
      <div>
        <div className="text-[32px]">⚡</div>
        <h3 className="mt-3 text-lg font-semibold">Instant Answers</h3>
        <p className="text-gray-600 mt-2">Powered by Gemini Live + LangChain for contextual insights.</p>
      </div>
      <div>
        <div className="text-[32px]">📄</div>
        <h3 className="mt-3 text-lg font-semibold">PDF Understanding</h3>
        <p className="text-gray-600 mt-2">Upload reports, contracts, or notes and query instantly.</p>
      </div>
    </section>
  );
}
