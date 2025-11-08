'use client';
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function AuthCallback() {
  const router = useRouter();

  useEffect(() => {
    supabase.auth.getSession().then(() => {
      router.replace("/");
    });
  }, []);

  return <p>Signing you in…</p>;
}

