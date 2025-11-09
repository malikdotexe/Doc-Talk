'use client';
import UploadedDocuments from "@/components/UploadedDocuments";

import { useEffect, useRef, useState } from 'react';  // Added useState
import { useAudioWebSocket } from '@/hooks/useAudioWebSocket';

export default function MainContent({ useOCR }: { useOCR: boolean }){
  const {
    isRecording,
    messages,
    pdfUrl,
    setPdfUrl,
    webSocket,
    startRecording,
    stopRecording,
    handlePdfUpload,
  } = useAudioWebSocket();

  const chatLogRef = useRef<HTMLDivElement>(null);
  const pdfInputRef = useRef<HTMLInputElement>(null);
  
  // NEW: State for selected PDF and upload progress
  const [selectedPdf, setSelectedPdf] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [isUploading, setIsUploading] = useState(false);
  
  // NEW: Animation states
  const [isGeminiSpeaking, setIsGeminiSpeaking] = useState(false);
  const [isUserSending, setIsUserSending] = useState(false);

  useEffect(() => {
    if (chatLogRef.current) {
      chatLogRef.current.scrollTop = chatLogRef.current.scrollHeight;
    }
  }, [messages]);

  // NEW: Track Gemini speaking state
  useEffect(() => {
    const handleWebSocketMessage = (event: MessageEvent) => {
      try {
        const messageData = JSON.parse(event.data);
        if (messageData.audio) {
          setIsGeminiSpeaking(true);
          // Reset speaking state after audio playback (assuming ~3-5 seconds)
          setTimeout(() => setIsGeminiSpeaking(false), 3000);
        }
      } catch (err) {
        console.error('Error parsing WebSocket message:', err);
      }
    };

    if (webSocket) {
      webSocket.addEventListener('message', handleWebSocketMessage);
      return () => webSocket.removeEventListener('message', handleWebSocketMessage);
    }
  }, [webSocket]);

  // NEW: Track user sending state
  useEffect(() => {
    if (isRecording) {
      setIsUserSending(true);
    } else {
      // Keep sending animation for a brief moment after stopping
      setTimeout(() => setIsUserSending(false), 500);
    }
  }, [isRecording]);

  // NEW: Handle PDF selection from sidebar
  const handlePdfSelect = async (filename: string) => {
    setSelectedPdf(filename);
    
    // Fetch and display the selected PDF
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase.storage
        .from('pdfs')
        .download(`${user.id}/${filename}`);

      if (error) {
        console.error('Error downloading PDF:', error);
        return;
      }

      const url = URL.createObjectURL(data);
      setPdfUrl(url);
    } catch (error) {
      console.error('Error loading selected PDF:', error);
    }
  };

  // Modified: Enhanced PDF upload handler with progress
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setIsUploading(true);
      setUploadProgress(0);
      
      // Simulate progress updates during upload
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => Math.min(prev + 10, 90));
      }, 200);
      
      try {
        await handlePdfUpload(file, useOCR);
        setUploadProgress(100);
        setSelectedPdf(file.name); // Auto-select newly uploaded PDF
        
        setTimeout(() => {
          setIsUploading(false);
          setUploadProgress(0);
        }, 1000);
      } catch (error) {
        console.error('Upload failed:', error);
        setIsUploading(false);
        setUploadProgress(0);
      } finally {
        clearInterval(progressInterval);
      }
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 py-8 px-4">
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Left Sidebar - Documents */}
          <div className="lg:col-span-3">
            <div className="sticky top-8">
              <UploadedDocuments 
                webSocket={webSocket} 
                onSelect={handlePdfSelect}
                selectedPdf={selectedPdf}
              />
            </div>
          </div>

          {/* Main Content Area */}
          <div className="lg:col-span-9">
            
            {/* Voice Control Panel */}
            <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 shadow-xl border border-white/20 mb-6">
              
              {/* Status Header */}
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                  Voice Assistant
                </h2>
                
                {/* Connection Status */}
                <div className="flex items-center gap-4">
                  {/* User Status */}
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-red-50 border border-red-200">
                    <div className={`w-2.5 h-2.5 rounded-full transition-all duration-300 ${
                      isUserSending ? 'bg-red-500 animate-pulse shadow-lg shadow-red-500/50' : 'bg-red-300'
                    }`}></div>
                    <span className="text-xs font-medium text-red-700">
                      {isUserSending ? 'Recording' : 'Ready'}
                    </span>
                  </div>

                  {/* AI Status */}
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-50 border border-blue-200">
                    <div className={`w-2.5 h-2.5 rounded-full transition-all duration-300 ${
                      isGeminiSpeaking ? 'bg-blue-500 animate-pulse shadow-lg shadow-blue-500/50' : 'bg-blue-300'
                    }`}></div>
                    <span className="text-xs font-medium text-blue-700">
                      {isGeminiSpeaking ? 'AI Speaking' : 'Listening'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Voice Controls */}
              <div className="flex gap-4 justify-center">
                <button
                  id="startButton"
                  onClick={startRecording}
                  disabled={isRecording}
                  className="group relative bg-gradient-to-r from-indigo-500 to-purple-600 text-white py-4 px-8 border-none rounded-xl text-lg font-semibold cursor-pointer hover:from-indigo-600 hover:to-purple-700 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-3 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-indigo-400 to-purple-500 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                  <i className="material-icons text-xl relative z-10">mic</i>
                  <span className="relative z-10">Start Recording</span>
                </button>
                
                <button
                  id="stopButton"
                  onClick={stopRecording}
                  disabled={!isRecording}
                  className="group relative bg-gradient-to-r from-red-500 to-pink-600 text-white py-4 px-8 border-none rounded-xl text-lg font-semibold cursor-pointer hover:from-red-600 hover:to-pink-700 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-3 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-red-400 to-pink-500 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                  <i className="material-icons text-xl relative z-10">stop</i>
                  <span className="relative z-10">Stop Recording</span>
                </button>
              </div>
            </div>

            {/* PDF Viewer Panel */}
            <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 shadow-xl border border-white/20 relative overflow-hidden">
              
              {/* Upload Progress */}
              {isUploading && (
                <div className="mb-6 p-4 bg-gradient-to-r from-indigo-50 to-purple-50 rounded-xl border border-indigo-200">
                  <div className="flex justify-between text-sm font-medium text-indigo-700 mb-2">
                    <span>Processing Document...</span>
                    <span>{uploadProgress}%</span>
                  </div>
                  <div className="w-full bg-indigo-100 rounded-full h-3 overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-indigo-500 to-purple-600 rounded-full transition-all duration-500 ease-out shadow-sm"
                      style={{ width: `${uploadProgress}%` }}
                    ></div>
                  </div>
                </div>
              )}

              {/* PDF Upload Input */}
              <input
                type="file"
                id="pdfInput"
                ref={pdfInputRef}
                accept="application/pdf"
                onChange={handleFileChange}
                className="hidden"
              />

              {/* PDF Viewer */}
              {pdfUrl ? (
                <div className="relative">
                  <div className="absolute top-4 right-4 z-10">
                    <button
                      onClick={() => pdfInputRef.current?.click()}
                      className="bg-white/90 backdrop-blur-sm text-indigo-600 px-4 py-2 rounded-lg font-medium shadow-lg hover:shadow-xl transition-all duration-300 hover:bg-white border border-indigo-200"
                    >
                      <i className="material-icons text-sm mr-2">upload_file</i>
                      Change PDF
                    </button>
                  </div>
                  <embed
                    src={pdfUrl}
                    type="application/pdf"
                    className="w-full h-[600px] rounded-xl shadow-lg border border-gray-200"
                  />
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-[400px] text-center">
                  <div className="w-20 h-20 bg-gradient-to-br from-indigo-100 to-purple-100 rounded-full flex items-center justify-center mb-4">
                    <i className="material-icons text-3xl text-indigo-500">description</i>
                  </div>
                  <h3 className="text-xl font-semibold text-gray-700 mb-2">No Document Selected</h3>
                  <p className="text-gray-500 mb-6 max-w-md">
                    Choose a document from the sidebar or upload a new PDF to start asking questions about it.
                  </p>
                  <button
                    onClick={() => pdfInputRef.current?.click()}
                    className="bg-gradient-to-r from-indigo-500 to-purple-600 text-white px-6 py-3 rounded-lg font-medium shadow-lg hover:shadow-xl transition-all duration-300 hover:from-indigo-600 hover:to-purple-700 transform hover:-translate-y-0.5"
                  >
                    <i className="material-icons text-sm mr-2">upload</i>
                    Upload PDF
                  </button>
                </div>
              )}

              {/* Gemini Speaking Overlay */}
              {isGeminiSpeaking && (
                <div className="absolute inset-0 bg-gradient-to-br from-blue-500/90 to-purple-600/90 backdrop-blur-sm rounded-2xl flex items-center justify-center z-20">
                  <div className="text-center text-white">
                    <div className="mb-6">
                      <div className="flex justify-center space-x-2">
                        <div className="w-5 h-5 bg-white rounded-full animate-bounce shadow-lg"></div>
                        <div className="w-5 h-5 bg-white rounded-full animate-bounce shadow-lg" style={{ animationDelay: '0.1s' }}></div>
                        <div className="w-5 h-5 bg-white rounded-full animate-bounce shadow-lg" style={{ animationDelay: '0.2s' }}></div>
                        <div className="w-5 h-5 bg-white rounded-full animate-bounce shadow-lg" style={{ animationDelay: '0.3s' }}></div>
                      </div>
                    </div>
                    <h3 className="text-2xl font-bold mb-2">Gemini is speaking...</h3>
                    <p className="text-blue-100">Processing your request</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

// NEW: Import supabase for PDF downloading
import { supabase } from "@/lib/supabaseClient";