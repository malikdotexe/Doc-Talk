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

  useEffect(() => {
    if (chatLogRef.current) {
      chatLogRef.current.scrollTop = chatLogRef.current.scrollHeight;
    }
  }, [messages]);

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
    <main className="flex justify-center gap-10 py-16 px-16 flex-wrap">

      {/* UPDATED: Pass selection handlers to UploadedDocuments */}
      <UploadedDocuments 
        webSocket={webSocket} 
        onSelect={handlePdfSelect}
        selectedPdf={selectedPdf}
      />

      {/* Middle: PDF + Voice */}
      <div className="bg-white rounded-[20px] p-6 shadow-[0_6px_20px_rgba(0,0,0,0.08)] flex-1 min-w-[360px] max-w-[600px]">
        
        {/* NEW: Upload Progress Bar */}
        {isUploading && (
          <div className="mb-4">
            <div className="flex justify-between text-sm text-gray-600 mb-1">
              <span>Uploading & Indexing...</span>
              <span>{uploadProgress}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className="bg-[#4a00e0] h-2 rounded-full transition-all duration-300"
                style={{ width: `${uploadProgress}%` }}
              ></div>
            </div>
          </div>
        )}

        <div className="flex gap-2.5 mb-5">
          <button
            id="startButton"
            onClick={startRecording}
            disabled={isRecording}
            className="bg-[#4a00e0] text-white py-3.5 px-6 border-none rounded-lg text-base cursor-pointer hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <i className="material-icons text-base">mic</i>
            Start
          </button>
          <button
            id="stopButton"
            onClick={stopRecording}
            disabled={!isRecording}
            className="bg-[#9e9e9e] text-white py-3.5 px-6 border-none rounded-lg text-base cursor-pointer hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <i className="material-icons text-base">mic_off</i>
            Stop
          </button>
        </div>

        <input
          type="file"
          id="pdfInput"
          ref={pdfInputRef}
          accept="application/pdf"
          onChange={handleFileChange}
          className="mt-5"
          style={{ display: 'none' }}
        />

        {pdfUrl && (
          <div className="mt-5">
            <embed
              src={pdfUrl}
              type="application/pdf"
              className="w-full h-[400px] rounded-xl"
            />
          </div>
        )}
      </div>

      {/* Right: Chat */}
      <div className="bg-white rounded-[20px] p-6 shadow-[0_6px_20px_rgba(0,0,0,0.08)] flex-1 min-w-[360px] max-w-[600px]">
        <h3 className="text-xl font-semibold mb-4">Chat</h3>
        <div
          id="chatLog"
          ref={chatLogRef}
          className="h-[500px] overflow-y-auto border border-gray-300 rounded-xl p-4"
        >
          {messages.length === 0 && (
            <p className="text-gray-500 text-center">
              No messages yet. Start talking to see responses here.
            </p>
          )}
          {messages.map((message, index) => (
            <p key={index} className="mb-2">
              {message}
            </p>
          ))}
        </div>
      </div>

    </main>
  );
}

// NEW: Import supabase for PDF downloading
import { supabase } from "@/lib/supabaseClient";