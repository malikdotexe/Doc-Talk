'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'wss://doc-talk-u97i.onrender.com';

interface UseAudioWebSocketReturn {
  isRecording: boolean;
  isConnected: boolean;
  messages: string[];
  pdfUrl: string | null;
  webSocket: WebSocket | null;
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<void>;
  handlePdfUpload: (file: File, useOCR: boolean) => Promise<void>;
  displayMessage: (message: string) => void;
}

export function useAudioWebSocket(): UseAudioWebSocketReturn {
  const [isRecording, setIsRecording] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [messages, setMessages] = useState<string[]>([]);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);

  // WebSocket refs
  const webSocketRef = useRef<WebSocket | null>(null);

  // Audio refs
  const audioContextRef = useRef<AudioContext | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const mediaSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const pcmDataRef = useRef<number[]>([]);
  const chunkTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Playback refs
  const audioInputContextRef = useRef<AudioContext | null>(null);
  const workletNodeRef = useRef<AudioWorkletNode | null>(null);
  const initializedRef = useRef(false);

  const displayMessage = useCallback((message: string) => {
    setMessages((prev) => [...prev, message]);
  }, []);

  // Initialize audio context for playback
  const initializeAudioContext = useCallback(async () => {
    if (initializedRef.current) return;

    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      audioInputContextRef.current = new AudioContextClass({
        sampleRate: 24000,
      });
      await audioInputContextRef.current.audioWorklet.addModule('/pcm-processor.js');
      workletNodeRef.current = new AudioWorkletNode(
        audioInputContextRef.current,
        'pcm-processor'
      );
      workletNodeRef.current.connect(audioInputContextRef.current.destination);
      initializedRef.current = true;
    } catch (error) {
      console.error('Error initializing audio context:', error);
    }
  }, []);

  // Convert base64 to ArrayBuffer
  const base64ToArrayBuffer = (base64: string): ArrayBuffer => {
    const binaryString = window.atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
  };

  // Convert PCM16LE to Float32
  const convertPCM16LEToFloat32 = (pcmData: ArrayBuffer): Float32Array => {
    const inputArray = new Int16Array(pcmData);
    const float32Array = new Float32Array(inputArray.length);

    for (let i = 0; i < inputArray.length; i++) {
      float32Array[i] = inputArray[i] / 32768;
    }

    return float32Array;
  };

  // Ingest audio chunk for playback
  const ingestAudioChunkToPlay = useCallback(
    async (base64AudioChunk: string) => {
      try {
        if (!audioInputContextRef.current || !workletNodeRef.current) {
          await initializeAudioContext();
        }

        if (audioInputContextRef.current?.state === 'suspended') {
          await audioInputContextRef.current.resume();
        }

        const arrayBuffer = base64ToArrayBuffer(base64AudioChunk);
        const float32Data = convertPCM16LEToFloat32(arrayBuffer);

        workletNodeRef.current?.port.postMessage(float32Data);
      } catch (error) {
        console.error('Error processing audio chunk:', error);
      }
    },
    [initializeAudioContext]
  );

  // Send initial setup message
  const sendInitialSetupMessage = useCallback(async () => {
    if (!webSocketRef.current) return;

    // get logged-in user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      console.warn("No user logged in — PDF + chat indexing will NOT work.");
      return;
    }

    const setupClientMessage = {
      setup: {
        user_id: user.id,        // IMPORTANT
        generation_config: { response_modalities: ["AUDIO"] },
      },
    };

    webSocketRef.current.send(JSON.stringify(setupClientMessage));
    console.log("Sent user_id to backend:", user.id);
  }, []);


 

  // Send voice message
  const sendVoiceMessage = useCallback(
    (b64PCM: string) => {
      if (!webSocketRef.current) {
        console.warn('WebSocket not initialized, cannot send audio');
        return;
      }

      // Check if WebSocket is in a valid state to send
      if (webSocketRef.current.readyState !== WebSocket.OPEN) {
        console.warn(`WebSocket not open (state: ${webSocketRef.current.readyState}), cannot send audio`);
        
        // If we're recording and WebSocket is closed, try to reconnect
        if (isRecording && webSocketRef.current.readyState === WebSocket.CLOSED) {
          console.log('Attempting to reconnect WebSocket...');
          connectWithRetry(3, 1000);
        }
        return;
      }

      try {
        const payload = {
          realtime_input: {
            media_chunks: [
              {
                mime_type: 'audio/pcm',
                data: b64PCM,
              },
            ],
          },
        };

        webSocketRef.current.send(JSON.stringify(payload));
        console.log('sent payload with audio data');
      } catch (err) {
        console.error('Error sending audio message:', err);
        // If send fails, WebSocket might be closed
        if (err instanceof Error && err.message.includes('CLOSED')) {
          console.warn('WebSocket closed during send, will attempt reconnect');
          if (isRecording) {
            connectWithRetry(3, 1000);
          }
        }
      }
    },
    [isRecording]
  );

  // Handle WebSocket messages
  const receiveMessage = useCallback(
    (event: MessageEvent) => {
      try {
        const messageData = JSON.parse(event.data);

        if (messageData.text) {
          displayMessage('GEMINI: ' + messageData.text);
        }
        if (messageData.audio) {
          ingestAudioChunkToPlay(messageData.audio);
        }
      } catch (err) {
        console.error('Error receiving message:', err);
      }
    },
    [displayMessage, ingestAudioChunkToPlay]
  );

  // Connect WebSocket with retry
  const connectWithRetry = useCallback(
    (retries = 5, delay = 2000) => {
      // Don't create a new connection if one already exists and is connecting/open
      if (webSocketRef.current && 
          (webSocketRef.current.readyState === WebSocket.CONNECTING || 
           webSocketRef.current.readyState === WebSocket.OPEN)) {
        console.log('WebSocket already connected or connecting');
        return;
      }

      // Close existing connection if it's in a bad state
      if (webSocketRef.current && webSocketRef.current.readyState !== WebSocket.CLOSED) {
        try {
          webSocketRef.current.close();
        } catch (e) {
          // Ignore errors when closing
        }
      }

      console.log('Connecting to backend…');
      const ws = new WebSocket(WS_URL);

      ws.onopen = () => {
        console.log('Connected ✅');
        setIsConnected(true);
        sendInitialSetupMessage();
      };

      ws.onclose = (event) => {
        console.warn('WebSocket closed.', event.code, event.reason);
        setIsConnected(false);
        
        // Always try to reconnect if we're recording (user is actively using the app)
        // or if it wasn't a normal closure
        if (isRecording || (event.code !== 1000 && retries > 0)) {
          if (retries > 0) {
            console.log(`Retrying in ${delay / 1000}s… (${retries} left)`);
            setTimeout(() => connectWithRetry(retries - 1, delay * 2), delay);
          } else {
            console.error('Unable to connect after retries. Please refresh.');
          }
        } else if (retries === 0) {
          console.error('Unable to connect after retries. Please refresh.');
        }
      };

      ws.onerror = (err) => {
        console.error('WebSocket error:', err);
        setIsConnected(false);
      };

      ws.onmessage = receiveMessage;

      webSocketRef.current = ws;
    },
    [sendInitialSetupMessage, receiveMessage, isRecording]
  );

  // Start audio input
  const startRecording = useCallback(async () => {
    if (isRecording) return;

    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      audioContextRef.current = new AudioContextClass({
        sampleRate: 16000,
      });

      micStreamRef.current = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: 16000,
        },
      });

      mediaSourceRef.current = audioContextRef.current.createMediaStreamSource(
        micStreamRef.current
      );
      processorRef.current = audioContextRef.current.createScriptProcessor(4096, 1, 1);

      processorRef.current.onaudioprocess = (e) => {
        const inputData = e.inputBuffer.getChannelData(0);
        for (let i = 0; i < inputData.length; i++) {
          pcmDataRef.current.push(Math.max(-1, Math.min(1, inputData[i])) * 0x7fff);
        }
      };

      mediaSourceRef.current.connect(processorRef.current);
      processorRef.current.connect(audioContextRef.current.destination);

      if (chunkTimerRef.current) clearInterval(chunkTimerRef.current);
      chunkTimerRef.current = setInterval(() => {
        if (pcmDataRef.current.length === 0) return;

        // Check if WebSocket is available before processing
        if (!webSocketRef.current || webSocketRef.current.readyState !== WebSocket.OPEN) {
          console.warn('WebSocket not available, skipping audio chunk');
          // Clear the buffer to prevent accumulation
          pcmDataRef.current = [];
          return;
        }

        const buffer = new ArrayBuffer(pcmDataRef.current.length * 2);
        const view = new DataView(buffer);
        pcmDataRef.current.forEach((value, index) => {
          view.setInt16(index * 2, value, true);
        });

        const base64 = btoa(
          String.fromCharCode.apply(null, Array.from(new Uint8Array(buffer)))
        );

        sendVoiceMessage(base64);
        pcmDataRef.current = [];
      }, 3000);

      setIsRecording(true);
    } catch (error) {
      console.error('Error starting audio input:', error);
    }
  }, [isRecording, sendVoiceMessage]);

  // Stop audio input
  const stopRecording = useCallback(async () => {
    if (!isRecording) return;

    try {
      // Stop timer
      if (chunkTimerRef.current) {
        clearInterval(chunkTimerRef.current);
        chunkTimerRef.current = null;
      }

      // Disconnect nodes
      if (processorRef.current) {
        try {
          processorRef.current.disconnect();
        } catch {}
        processorRef.current.onaudioprocess = null;
        processorRef.current = null;
      }
      if (mediaSourceRef.current) {
        try {
          mediaSourceRef.current.disconnect();
        } catch {}
        mediaSourceRef.current = null;
      }

      // Stop mic
      if (micStreamRef.current) {
        micStreamRef.current.getTracks().forEach((t) => {
          try {
            t.stop();
          } catch {}
        });
        micStreamRef.current = null;
      }

      // Close context
      if (audioContextRef.current) {
        if (audioContextRef.current.state !== 'closed') {
          try {
            await audioContextRef.current.close();
          } catch {}
        }
        audioContextRef.current = null;
      }

      pcmDataRef.current = [];
      setIsRecording(false);
    } catch (err) {
      console.error('stopAudioInput error:', err);
    }
  }, [isRecording]);

  // Handle PDF upload
  const handlePdfUpload = useCallback(
    async (file: File, useOCR: boolean) => {
      if (file.type !== "application/pdf") {
        alert("Please select a valid PDF file.");
        return;
      }

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        alert("Please login first.");
        return;
      }

      // 1) Upload PDF directly to Supabase Storage (no WebSocket transfer)
      const storagePath = `${user.id}/${file.name}`;

      const { error: uploadError } = await supabase.storage
        .from("pdfs")
        .upload(storagePath, file, {
          upsert: true,
          contentType: "application/pdf",
        });

      if (uploadError) {
        console.error("Upload failed:", uploadError);
        alert("Upload failed, retry.");
        return;
      }

      // 2) Notify the backend over WebSocket (sending only metadata)
      if (!webSocketRef.current) {
        console.warn("WebSocket is not initialized");
        return;
      }

      webSocketRef.current.send(
        JSON.stringify({
          realtime_input: {
            media_chunks: [
              {
                mime_type: "application/pdf",
                filename: file.name,
                storage_path: storagePath,
                ocr: useOCR,
              },
            ],
          },
        })
      );

      // 3) Listen for success response to trigger document refresh
      const originalOnMessage = webSocketRef.current.onmessage;
      webSocketRef.current.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.text && (data.text.includes("successfully") || data.text.includes("✅"))) {
            // Trigger document list refresh
            window.dispatchEvent(new CustomEvent('documentUploaded'));
          }
        } catch (e) {
          // Ignore parse errors
        }
        // Call original handler
        if (originalOnMessage && webSocketRef.current) originalOnMessage.call(webSocketRef.current, event);
      };

      // 4) Display PDF in the UI preview pane
      const url = URL.createObjectURL(file);
      setPdfUrl(url);

    },
    []
  );
  // Initialize on mount
  useEffect(() => {
    initializeAudioContext();
    connectWithRetry();

    return () => {
      if (isRecording) {
        stopRecording();
      }
      if (webSocketRef.current) {
        webSocketRef.current.close();
        webSocketRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    isRecording,
    isConnected,
    messages,
    pdfUrl,
    webSocket: webSocketRef.current,
    startRecording,
    stopRecording,
    handlePdfUpload,
    displayMessage,
  };
}
