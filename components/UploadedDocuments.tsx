'use client';

import { useEffect, useState, useRef } from "react";
import { supabase } from "@/lib/supabaseClient";

interface UploadedDocumentsProps {
  onDelete?: (filename: string) => void;
  onSelect?: (filename: string) => void;  // NEW: callback for selection
  selectedPdf?: string | null;  // NEW: track which PDF is selected
  webSocket?: WebSocket | null;
}

export default function UploadedDocuments({ onDelete, onSelect, selectedPdf, webSocket }: UploadedDocumentsProps) {
  const [documents, setDocuments] = useState<{ filename: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);

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
    if (!user) {
      alert("Please login first.");
      return;
    }

    setDeleting(filename);

    try {
      // Use existing WebSocket if available and open
      if (webSocket && webSocket.readyState === WebSocket.OPEN) {
        console.log("Using existing WebSocket for delete");
        // Send delete request through existing WebSocket
        webSocket.send(JSON.stringify({
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
        
        // Wait a bit for response, then refresh
        setTimeout(() => {
          loadDocs();
          setDeleting(null);
        }, 1500);
        
        // Optimistically remove from UI
        setDocuments((docs) => docs.filter((d) => d.filename !== filename));
      } else {
        // Fallback: Create a temporary WebSocket connection
        console.log("Creating temporary WebSocket for delete");
        const ws = new WebSocket(process.env.NEXT_PUBLIC_WS_URL || 'wss://doc-talk-u97i.onrender.com');
        let deleteCompleted = false;
        
        ws.onopen = () => {
          // Send setup message first
          ws.send(JSON.stringify({
            setup: { user_id: user.id }
          }));

          // Wait for setup to be processed, then send delete request
          setTimeout(() => {
            if (ws.readyState === WebSocket.OPEN && !deleteCompleted) {
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
            }
          }, 500);
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.text) {
              console.log("Delete response:", data.text);
              deleteCompleted = true;
              
              // Refresh document list on success
              if (data.text.includes("✅") || data.text.includes("Deleted")) {
                loadDocs(); // Reload documents
              } else if (data.text.includes("❌")) {
                alert(`Delete failed: ${data.text}`);
                loadDocs(); // Refresh to show actual state
              }
              
              setTimeout(() => {
                ws.close();
                setDeleting(null);
              }, 500);
            }
          } catch (e) {
            console.error("Error parsing delete response:", e);
          }
        };

        ws.onerror = (error) => {
          console.error("WebSocket error during delete:", error);
          if (!deleteCompleted) {
            alert("Failed to delete document. Please try again.");
            setDeleting(null);
            loadDocs(); // Refresh to show actual state
          }
        };

        ws.onclose = () => {
          if (!deleteCompleted) {
            setDeleting(null);
            loadDocs(); // Refresh to show actual state
          }
        };

        // Timeout after 5 seconds
        setTimeout(() => {
          if (!deleteCompleted) {
            deleteCompleted = true;
            ws.close();
            setDeleting(null);
            loadDocs(); // Refresh to show actual state
            alert("Delete request timed out. Please check if it was successful.");
          }
        }, 5000);

        // Optimistically remove from UI
        setDocuments((docs) => docs.filter((d) => d.filename !== filename));
      }
    } catch (error) {
      console.error("Error deleting document:", error);
      alert("Failed to delete document. Please try again.");
      setDeleting(null);
      loadDocs(); // Refresh to show actual state
    }
  }


  useEffect(() => {
    loadDocs();
    const handleDocumentUpload = () => loadDocs();
    window.addEventListener('documentUploaded', handleDocumentUpload);
    
    return () => {
      window.removeEventListener('documentUploaded', handleDocumentUpload);
    };
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
              onClick={() => onSelect?.(filename)}  // NEW: Handle PDF selection
              className={`flex justify-between items-center text-sm border-b pb-2 cursor-pointer transition-colors ${
                selectedPdf === filename 
                  ? 'bg-gray-200 border-gray-400'  // NEW: Darkened background for selected PDF
                  : 'hover:bg-gray-50'
              }`}
            >
              <span className="truncate max-w-[120px]">{filename}</span>
              <button
                onClick={(e) => {
                  e.stopPropagation(); // Prevent triggering selection when clicking delete
                  deleteDoc(filename);
                }}
                disabled={deleting === filename}
                className="text-red-500 hover:underline text-xs disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {deleting === filename ? "Deleting..." : "Delete"}
              </button>
            </li>
          ))}
        </ul>
      )}
    </aside>
  );
}