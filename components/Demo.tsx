export default function Demo() {
  return (
    <section className="py-24 px-8 bg-gradient-to-b from-[#1a1a2e] to-[#0f0f23]">
      <div className="max-w-4xl mx-auto text-center">
        <div className="mb-12">
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
            🎥 See DocTalk in Action
          </h2>
          <p className="text-xl text-gray-400 max-w-2xl mx-auto">
            Watch how easily you can talk to your PDFs in real-time with our intuitive interface.
          </p>
        </div>

        <div className="relative glass rounded-2xl p-2 shadow-2xl">
          <div className="relative pb-[56.25%] h-0 overflow-hidden rounded-xl">
            <iframe
              src="https://www.youtube.com/embed/IX8uNB4tOP4"
              title="DocTalk Demo"
              frameBorder="0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
              className="absolute top-0 left-0 w-full h-full rounded-xl"
            />
          </div>
        </div>

        <div className="mt-8 text-center">
          <p className="text-gray-500 text-sm">
            Experience the power of AI-driven document interaction
          </p>
        </div>
      </div>
    </section>
  );
}