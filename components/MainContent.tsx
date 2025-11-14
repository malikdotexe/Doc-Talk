'use client';
import UploadedDocuments from "@/components/UploadedDocuments";

import { useEffect, useRef, useState } from 'react';  
import { useAudioWebSocket } from '@/hooks/useAudioWebSocket';
import { supabase } from "@/lib/supabaseClient";

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
  
  const [selectedPdf, setSelectedPdf] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [isUploading, setIsUploading] = useState(false);
  const [currentStatus, setCurrentStatus] = useState<'idle' | 'recording' | 'processing' | 'speaking'>('idle');

  const [conversation, setConversation] = useState<Array<{
    id: string;
    type: 'user' | 'ai';
    content: string;
    timestamp: Date;
  }>>([]);
  const [currentTranscript, setCurrentTranscript] = useState("");
  // NEW: Track if we've already added the current transcript as a user message
  const [transcriptAddedToConversation, setTranscriptAddedToConversation] = useState(false);

  useEffect(() => {
    if (chatLogRef.current) {
      chatLogRef.current.scrollTop = chatLogRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    if (isRecording) {
      setCurrentStatus('recording');
    } else if (!isRecording) {
      setCurrentStatus('idle');
    }
  }, [isRecording]);

  const handlePdfSelect = async (filename: string) => {
    setSelectedPdf(filename);
    
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

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setIsUploading(true);
      setUploadProgress(0);
      setCurrentStatus('processing');
      
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => Math.min(prev + 10, 90));
      }, 200);
      
      try {
        await handlePdfUpload(file, useOCR);
        setUploadProgress(100);
        setSelectedPdf(file.name);
        
        setTimeout(() => {
          setIsUploading(false);
          setUploadProgress(0);
          if (!isRecording) {
            setCurrentStatus('idle');
          }
        }, 1000);
      } catch (error) {
        console.error('Upload failed:', error);
        setIsUploading(false);
        setUploadProgress(0);
        if (!isRecording) {
          setCurrentStatus('idle');
        }
      } finally {
        clearInterval(progressInterval);
      }
    }
  };

  const getStatusDisplay = () => {
    switch (currentStatus) {
      case 'recording':
        return { text: 'Recording...', color: 'bg-red-500', textColor: 'text-red-700' };
      case 'processing':
        return { text: 'Processing...', color: 'bg-yellow-500', textColor: 'text-yellow-700' };
      case 'speaking':
        return { text: 'AI Speaking...', color: 'bg-blue-500', textColor: 'text-blue-700' };
      default:
        return { text: 'Ready', color: 'bg-green-500', textColor: 'text-green-700' };
    }
  };

  const statusDisplay = getStatusDisplay();

  useEffect(() => {
    const handleWebSocketMessage = (event: MessageEvent) => {
      try {
        const messageData = JSON.parse(event.data);
        
        // Handle user transcription updates (partial transcripts while speaking)
        if (messageData.user_transcript) {
          setCurrentTranscript(messageData.user_transcript);
          // Reset the flag when we get a new transcript
          if (messageData.transcript_partial) {
            setTranscriptAddedToConversation(false);
          }
        }
        
        // Handle user queries extracted from tool calls
        if (messageData.user_query && messageData.query_from_tool) {
          const userMessage = {
            id: Date.now().toString() + '_user',
            type: 'user' as const,
            content: messageData.user_query,
            timestamp: new Date()
          };
          setConversation(prev => [...prev, userMessage]);
          setTranscriptAddedToConversation(true); // Prevent duplicate addition
          return; // Don't process other message types
        }
        
        // Handle AI text responses
        if (messageData.text && !messageData.user_transcript && !messageData.transcript_partial && !messageData.user_query) {
          // ONLY add the user message if we haven't already added it
          if (currentTranscript.trim() && !transcriptAddedToConversation) {
            const userMessage = {
              id: Date.now().toString() + '_user',
              type: 'user' as const,
              content: currentTranscript.trim(),
              timestamp: new Date()
            };
            setConversation(prev => [...prev, userMessage]);
            setTranscriptAddedToConversation(true); // Mark as added
          }
          
          // Add the AI response
          const aiMessage = {
            id: Date.now().toString() + '_ai',
            type: 'ai' as const,
            content: messageData.text,
            timestamp: new Date()
          };
          setConversation(prev => [...prev, aiMessage]);
          
          // Clear the transcript for the next question
          setCurrentTranscript("");
          setTranscriptAddedToConversation(false);
        }
        
      } catch (err) {
        console.error('Error parsing WebSocket message:', err);
      }
    };

    if (webSocket) {
      webSocket.addEventListener('message', handleWebSocketMessage);
      return () => webSocket.removeEventListener('message', handleWebSocketMessage);
    }
  }, [webSocket, currentTranscript, transcriptAddedToConversation]);

  // REMOVED: The duplicate useEffect that was adding user messages when recording stopped
  // This was causing the double-add issue

  // Auto-scroll to latest messages
  useEffect(() => {
    const chatContainer = document.querySelector('.max-h-96');
    if (chatContainer) {
      chatContainer.scrollTop = chatContainer.scrollHeight;
    }
  }, [conversation, currentTranscript]);

  return (
    <main className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          <div className="lg:col-span-3">
            <div className="sticky top-8">
              <UploadedDocuments 
                webSocket={webSocket} 
                onSelect={handlePdfSelect}
                selectedPdf={selectedPdf}
              />
            </div>
          </div>

          <div className="lg:col-span-9">
            
            <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-200 mb-6">
              
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-gray-900">
                  Voice Assistant
                </h2>
                
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-gray-50 border border-gray-200">
                    <div className={`w-3 h-3 rounded-full transition-all duration-300 ${
                      currentStatus === 'idle' ? 'bg-green-500' : 
                      currentStatus === 'recording' ? 'bg-red-500 animate-pulse' :
                      currentStatus === 'processing' ? 'bg-yellow-500 animate-pulse' :
                      'bg-blue-500 animate-pulse'
                    }`}></div>
                    <span className={`text-sm font-medium ${statusDisplay.textColor}`}>
                      {statusDisplay.text}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex gap-4 justify-center">
                <button
                  id="startButton"
                  onClick={startRecording}
                  disabled={isRecording}
                  className="bg-gray-900 text-white py-4 px-8 border-none rounded-xl text-lg font-semibold cursor-pointer hover:bg-gray-800 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-3 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
                >
                  <i className="material-icons text-xl">mic</i>
                  <span>Start Recording</span>
                </button>
                
                <button
                  id="stopButton"
                  onClick={stopRecording}
                  disabled={!isRecording}
                  className="bg-red-600 text-white py-4 px-8 border-none rounded-xl text-lg font-semibold cursor-pointer hover:bg-red-700 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-3 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
                >
                  <i className="material-icons text-xl">stop</i>
                  <span>Stop Recording</span>
                </button>
              </div>
            </div>

            <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-200 mb-6">
              <h3 className="text-xl font-bold text-gray-900 mb-4">Conversation</h3>
              
              <div className="space-y-4 max-h-96 overflow-y-auto mb-4">
                {conversation.map((message) => (
                  <div key={message.id} className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                      message.type === 'user' 
                        ? 'bg-blue-500 text-white' 
                        : 'bg-gray-100 text-gray-900'
                    }`}>
                      <p className="text-sm">{message.content}</p>
                      <p className="text-xs opacity-70 mt-1">
                        {message.timestamp.toLocaleTimeString()}
                      </p>
                    </div>
                  </div>
                ))}
                
                {/* Show current transcription while speaking */}
                {currentTranscript && !transcriptAddedToConversation && (
                  <div className="flex justify-end">
                    <div className="max-w-xs lg:max-w-md px-4 py-2 rounded-lg bg-blue-200 text-blue-900">
                      <p className="text-sm italic">{currentTranscript}...</p>
                      <p className="text-xs opacity-70 mt-1">Speaking...</p>
                    </div>
                  </div>
                )}
              </div>
              
              <button
                onClick={() => {
                  setConversation([]);
                  setCurrentTranscript("");
                  setTranscriptAddedToConversation(false);
                }}
                className="text-sm text-gray-500 hover:text-gray-700 underline"
              >
                Clear conversation
              </button>
            </div>

            <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-200 relative overflow-hidden">
              
              {isUploading && (
                <div className="mb-6 p-4 bg-gray-50 rounded-xl border border-gray-200">
                  <div className="flex justify-between text-sm font-medium text-gray-700 mb-2">
                    <span>Processing Document...</span>
                    <span>{uploadProgress}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                    <div 
                      className="h-full bg-gray-900 rounded-full transition-all duration-500 ease-out"
                      style={{ width: `${uploadProgress}%` }}
                    ></div>
                  </div>
                </div>
              )}

              <input
                type="file"
                id="pdfInput"
                ref={pdfInputRef}
                accept="application/pdf"
                onChange={handleFileChange}
                className="hidden"
              />

              {pdfUrl ? (
                <div className="relative">
                  <embed
                    src={pdfUrl}
                    type="application/pdf"
                    className="w-full h-[600px] rounded-xl shadow-lg border border-gray-200"
                  />
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-[400px] text-center">
                  <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                    <i className="material-icons text-3xl text-gray-400">description</i>
                  </div>
                  <h3 className="text-xl font-semibold text-gray-700 mb-2">No Document Selected</h3>
                  <p className="text-gray-500 mb-6 max-w-md">
                    Choose a document from the sidebar or upload a new PDF to start asking questions about it.
                  </p>
                  <button
                    onClick={() => pdfInputRef.current?.click()}
                    className="bg-gray-900 text-white px-6 py-3 rounded-lg font-medium shadow-lg hover:shadow-xl transition-all duration-300 hover:bg-gray-800 transform hover:-translate-y-0.5"
                  >
                    <i className="material-icons text-sm mr-2">upload</i>
                    Upload PDF
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}