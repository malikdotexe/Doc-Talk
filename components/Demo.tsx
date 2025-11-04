export default function Demo() {
  return (
    <section
      id="demo"
      className="text-center py-20 px-5 bg-gradient-to-br from-[#fdfbfb] to-[#ebedee]"
    >
      <h2 className="text-4xl mb-4 font-bold text-gray-800">🎥 See Doc-Talk in Action</h2>
      <p className="text-lg text-[#555] mb-8">
        Watch how easily you can talk to your PDFs in real-time.
      </p>
      <div className="relative pb-[56.25%] h-0 overflow-hidden max-w-full rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.12)]">
        <iframe
          src="https://www.youtube.com/embed/B1NTSGHPxjo"
          title="Doc-Talk Demo"
          frameBorder="0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
          className="absolute top-0 left-0 w-full h-full rounded-2xl"
        />
      </div>
    </section>
  );
}
