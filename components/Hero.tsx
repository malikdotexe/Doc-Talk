'use client';

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import LoginButton from "@/components/LoginButton";

export default function Hero() {
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

            <button
              onClick={handleStartClick}
              className="bg-[#4a00e0] text-white py-3.5 px-6 rounded-lg hover:opacity-90 transition-opacity"
            >
              Start Talking
            </button>

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
