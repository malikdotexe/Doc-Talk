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
    <aside className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 shadow-xl border border-white/20 h-fit">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center">
          <i className="material-icons text-white text-lg">folder</i>
        </div>
        <h3 className="text-xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
          Your Documents
        </h3>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div>
        </div>
      ) : documents.length === 0 ? (
        <div className="text-center py-8">
          <div className="w-16 h-16 bg-gradient-to-br from-gray-100 to-gray-200 rounded-full flex items-center justify-center mx-auto mb-4">
            <i className="material-icons text-gray-400 text-2xl">description</i>
          </div>
          <p className="text-gray-500 text-sm font-medium">No documents yet</p>
          <p className="text-gray-400 text-xs mt-1">Upload PDFs to get started</p>
        </div>
      ) : (
        <ul className="space-y-3 max-h-96 overflow-y-auto">
          {documents.map(({ filename }) => (
            <li
              key={filename}
              onClick={() => onSelect?.(filename)}
              className={`group relative p-4 rounded-xl border transition-all duration-300 cursor-pointer ${
                selectedPdf === filename 
                  ? 'bg-gradient-to-r from-indigo-50 to-purple-50 border-indigo-300 shadow-md' 
                  : 'bg-gray-50/50 border-gray-200 hover:bg-white hover:border-indigo-200 hover:shadow-md'
              }`}
            >
              <div className="flex items-start gap-3">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                  selectedPdf === filename 
                    ? 'bg-gradient-to-br from-indigo-500 to-purple-600' 
                    : 'bg-gradient-to-br from-gray-200 to-gray-300 group-hover:from-indigo-100 group-hover:to-purple-100'
                }`}>
                  <i className={`material-icons text-sm ${
                    selectedPdf === filename ? 'text-white' : 'text-gray-600'
                  }`}>description</i>
                </div>
                
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium truncate ${
                    selectedPdf === filename ? 'text-indigo-900' : 'text-gray-700'
                  }`}>
                    {filename}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {selectedPdf === filename ? 'Currently selected' : 'Click to select'}
                  </p>
                </div>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteDoc(filename);
                  }}
                  disabled={deleting === filename}
                  className="opacity-0 group-hover:opacity-100 text-red-500 hover:text-red-700 p-1 rounded-lg hover:bg-red-50 transition-all duration-200 disabled:opacity-50"
                  title="Delete document"
                >
                  {deleting === filename ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-red-500"></div>
                  ) : (
                    <i className="material-icons text-sm">delete</i>
                  )}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </aside>
  );
}