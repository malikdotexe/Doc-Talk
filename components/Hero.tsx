'use client';

export default function Hero() {
  const handleUploadClick = () => {
    const pdfInput = document.getElementById('pdfInput') as HTMLInputElement;
    pdfInput?.click();
  };

  const handleStartClick = () => {
    const startButton = document.getElementById('startButton') as HTMLButtonElement;
    startButton?.click();
  };

  return (
    <section className="text-center py-20 px-5 bg-gradient-to-br from-[#fdfbfb] to-[#ebedee]">
      <h1 className="text-5xl mb-4">Doc-Talk</h1>
      <p className="text-xl text-[#555] mb-6">
        Upload PDFs. Ask questions. Get instant answers with Gemini Live + LangChain.
      </p>
      <div className="flex gap-2.5 justify-center flex-wrap">
        <button
          onClick={handleUploadClick}
          className="bg-[#4a00e0] text-white py-3.5 px-6 border-none rounded-lg text-base cursor-pointer hover:opacity-90 transition-opacity"
        >
          Upload a PDF
        </button>
        <button
          onClick={handleStartClick}
          className="bg-[#4a00e0] text-white py-3.5 px-6 border-none rounded-lg text-base cursor-pointer hover:opacity-90 transition-opacity"
        >
          Start Talking
        </button>
        <a
          href="#demo"
          className="bg-[#4a00e0] text-white py-3.5 px-6 border-none rounded-lg text-base cursor-pointer hover:opacity-90 transition-opacity no-underline inline-block"
        >
          Watch Demo
        </a>
      </div>
    </section>
  );
}
