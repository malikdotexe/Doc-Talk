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
    <section className="text-center py-20 px-5 bg-gradient-to-br from-[#fdfbfb] to-[#ebedee]">
      <h1 className="text-5xl mb-4">Doc-Talk</h1>

      {user ? (
        <p className="text-xl text-[#555] mb-6">
          Hi, <span className="font-semibold">{user.user_metadata.full_name || user.email}</span> 👋
        </p>
      ) : (
        <p className="text-xl text-[#555] mb-6">
          Upload PDFs. Ask questions. Get instant answers.
        </p>
      )}

      <div className="flex gap-2.5 justify-center flex-wrap">
        {user ? (
          <>
            <button
              onClick={handleUploadClick}
              className="bg-[#4a00e0] text-white py-3.5 px-6 rounded-lg hover:opacity-90 transition-opacity"
            >
              Upload a PDF
            </button>

            {/* OCR Toggle */}
            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-600">PDF has Images</span>
              <button
                onClick={() => setUseOCR(!useOCR)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${
                  useOCR ? "bg-[#4a00e0]" : "bg-gray-300"
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
                    useOCR ? "translate-x-5" : "translate-x-1"
                  }`}
                />
              </button>
            </div>

            <button
              onClick={logout}
              className="bg-red-500 text-white py-3.5 px-6 rounded-lg hover:bg-red-600 transition"
            >
              Logout
            </button>
          </>
        ) : (
          <LoginButton />
        )}

      </div>
    </section>
  );
}
