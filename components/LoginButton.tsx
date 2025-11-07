"use client";
import { supabase } from "@/lib/supabaseClient";

export default function LoginButton() {
  async function login() {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: window.location.href
      }
    });
  }

  return (
    <button
      onClick={login}
      className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition"
    >
      Sign in with Google
    </button>
  );
}
