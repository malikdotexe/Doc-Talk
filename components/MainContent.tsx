'use client';

import { useEffect, useRef } from 'react';
import { useAudioWebSocket } from '@/hooks/useAudioWebSocket';

export default function MainContent() {
  const {
    isRecording,
    messages,
    pdfUrl,
    startRecording,
    stopRecording,
    handlePdfUpload,
  } = useAudioWebSocket();

  const chatLogRef = useRef<HTMLDivElement>(null);
  const pdfInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (chatLogRef.current) {
      chatLogRef.current.scrollTop = chatLogRef.current.scrollHeight;
    }
  }, [messages]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handlePdfUpload(file);
    }
  };

  return (
    <main className="flex justify-center gap-10 py-16 px-16 flex-wrap">
      {/* Left: PDF + Voice */}
      <div className="bg-white rounded-[20px] p-6 shadow-[0_6px_20px_rgba(0,0,0,0.08)] flex-1 min-w-[360px] max-w-[600px]">
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
            <p className="text-gray-500 text-center">No messages yet. Start talking to see responses here.</p>
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
