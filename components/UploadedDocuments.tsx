'use client';

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

interface UploadedDocumentsProps {
  onDelete?: (filename: string) => void;   // optional callback for future use
}

export default function UploadedDocuments({ onDelete }: UploadedDocumentsProps) {
  const [documents, setDocuments] = useState<{ filename: string }[]>([]);
  const [loading, setLoading] = useState(true);

  async function loadDocs() {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return;

    const { data, error } = await supabase
      .from("user_documents")
      .select("filename")
      .eq("user_id", user.id);

    if (!error && data) {
      setDocuments(data);
    }

    setLoading(false);
  }

  async function deleteDoc(filename: string) {
    if (!confirm(`Delete ${filename}?`)) return;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const ws = new WebSocket(process.env.NEXT_PUBLIC_WS_URL!);

    ws.onopen = () => {
      ws.send(JSON.stringify({
        setup: { user_id: user.id }
      }));

      setTimeout(() => {
        ws.send(JSON.stringify({
          realtime_input: {
            tool_call: {
              function_calls: [
                {
                  name: "delete_document",
                  args: { filename }
                }
              ]
            }
          }
        }));
        ws.close();
      }, 300);
    };

    setDocuments((docs) => docs.filter((d) => d.filename !== filename));
  }


  useEffect(() => {
    loadDocs();
  }, []);

  return (
    <aside className="w-64 bg-white shadow-lg rounded-xl p-4 h-[600px] overflow-y-auto">
      <h3 className="text-lg font-semibold mb-3">Your Documents</h3>

      {loading ? (
        <p className="text-gray-500 text-sm">Loading…</p>
      ) : documents.length === 0 ? (
        <p className="text-gray-500 text-sm">No documents uploaded yet.</p>
      ) : (
        <ul className="space-y-3">
          {documents.map(({ filename }) => (
            <li
              key={filename}
              className="flex justify-between items-center text-sm border-b pb-2"
            >
              <span className="truncate max-w-[120px]">{filename}</span>
              <button
                onClick={() => deleteDoc(filename)}
                className="text-red-500 hover:underline text-xs"
              >
                Delete
              </button>
            </li>
          ))}
        </ul>
      )}
    </aside>
  );
}
