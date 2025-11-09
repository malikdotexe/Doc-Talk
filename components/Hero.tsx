'use client';

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import LoginButton from "@/components/LoginButton";

export default function Hero({ useOCR, setUseOCR }: { useOCR: boolean; setUseOCR: (value: boolean) => void }){
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
    });
  }, []);

  const handleUploadClick = () => {
    document.getElementById('pdfInput')?.click();
  };

  const handleStartClick = () => {
    document.getElementById('startButton')?.click();
  };

  async function logout() {
    await supabase.auth.signOut();
    setUser(null);
  }
  return (
    <section className="relative min-h-screen bg-gradient-to-br from-[#0f0f23] via-[#1a1a2e] to-[#16213e] text-white overflow-hidden">
      {/* Background Pattern */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute top-20 left-10 w-72 h-72 bg-[#4a00e0] rounded-full blur-3xl"></div>
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-[#8e2de2] rounded-full blur-3xl"></div>
      </div>

      <div className="relative z-10 text-center py-32 px-5 max-w-4xl mx-auto">
        <div className="mb-8">
          <div className="inline-flex items-center px-4 py-2 bg-white/10 backdrop-blur-sm rounded-full border border-white/20 mb-6">
            <span className="text-sm font-medium">🚀 AI-Powered Document Intelligence</span>
          </div>
          <h1 className="text-6xl md:text-7xl font-bold mb-6 bg-gradient-to-r from-white via-blue-100 to-purple-200 bg-clip-text text-transparent">
            Talk to Your
            <br />
            <span className="bg-gradient-to-r from-[#4a00e0] to-[#8e2de2] bg-clip-text text-transparent">
              Documents
            </span>
          </h1>
          <p className="text-xl md:text-2xl text-gray-300 mb-12 max-w-3xl mx-auto leading-relaxed">
            Upload PDFs, ask questions, and get instant answers powered by advanced AI.
            <br className="hidden md:block" />
            No more scrolling through pages – just talk naturally.
          </p>
        </div>

        {user ? (
          <div className="space-y-8">
            <div className="glass rounded-2xl p-8 max-w-md mx-auto">
              <p className="text-xl text-white mb-6">
                Welcome back, <span className="font-semibold bg-gradient-to-r from-[#4a00e0] to-[#8e2de2] bg-clip-text text-transparent">{user.user_metadata.full_name || user.email}</span> 👋
              </p>
              
              <div className="space-y-4">
                <button
                  onClick={handleUploadClick}
                  className="w-full bg-gradient-to-r from-[#4a00e0] to-[#8e2de2] hover:from-[#5a10f0] hover:to-[#9e3df2] text-white py-4 px-8 rounded-xl font-semibold text-lg shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 transition-all duration-200 flex items-center justify-center space-x-3"
                >
                  <span>📄</span>
                  <span>Upload a PDF</span>
                </button>

                {/* OCR Toggle */}
                <div className="flex items-center justify-center space-x-4 p-4 bg-white/5 rounded-xl border border-white/10">
                  <span className="text-sm text-gray-300 font-medium">PDF contains images</span>
                  <button
                    onClick={() => setUseOCR(!useOCR)}
                    className={`relative inline-flex h-7 w-14 items-center rounded-full transition-all duration-300 ${
                      useOCR ? "bg-gradient-to-r from-[#4a00e0] to-[#8e2de2]" : "bg-gray-600"
                    }`}
                  >
                    <span
                      className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-lg transition-transform duration-300 ${
                        useOCR ? "translate-x-8" : "translate-x-1"
                      }`}
                    />
                  </button>
                  <span className="text-sm text-gray-300">Enable OCR</span>
                </div>
              </div>
            </div>

            <button
              onClick={logout}
              className="text-gray-400 hover:text-white transition-colors text-sm underline-offset-4 hover:underline"
            >
              Sign out
            </button>
          </div>
        ) : (
          <div className="glass rounded-2xl p-8 max-w-md mx-auto">
            <p className="text-xl text-gray-300 mb-8">
              Ready to talk to your documents?
            </p>
            <LoginButton />
          </div>
        )}
      </div>
    </section>
  );
}
