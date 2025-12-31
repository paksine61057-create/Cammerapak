
import React, { useState, useRef, useEffect } from 'react';
import { CameraBubble } from './components/CameraBubble';
import { ControlPanel } from './components/ControlPanel';
import { CameraConfig, Position } from './types';

const App: React.FC = () => {
  const [cameraConfig, setCameraConfig] = useState<CameraConfig>({
    shape: 'circle',
    size: 240,
    mirrored: true,
    backgroundUrl: 'https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&q=80&w=800',
    blur: 0,
    videoOpacity: 1.0, 
    zoom: 1.2,
    useChromaKey: false,
    chromaKeyColor: { r: 255, g: 255, b: 255 },
    threshold: 50,
  });
  
  const [isUIVisible, setIsUIVisible] = useState(true);
  const [pos, setPos] = useState<Position>({ x: 40, y: 40 });
  const [isPiPActive, setIsPiPActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isCameraLoading, setIsCameraLoading] = useState(true);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const processingCanvasRef = useRef<HTMLCanvasElement>(document.createElement('canvas'));
  const pipVideoRef = useRef<HTMLVideoElement>(null);
  const bgImageRef = useRef<HTMLImageElement | null>(null);

  // Background Image Loader
  useEffect(() => {
    if (cameraConfig.backgroundUrl) {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.src = cameraConfig.backgroundUrl;
      img.onload = () => { bgImageRef.current = img; };
      img.onerror = () => { console.error("Failed to load background image"); };
    } else {
      bgImageRef.current = null;
    }
  }, [cameraConfig.backgroundUrl]);

  // Camera Initialization
  useEffect(() => {
    let stream: MediaStream | null = null;
    
    const startCamera = async () => {
      setIsCameraLoading(true);
      setCameraError(null);
      try {
        stream = await navigator.mediaDevices.getUserMedia({ 
          video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 640 } }, 
          audio: false 
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          // Force play to ensure it starts
          await videoRef.current.play();
          setIsCameraLoading(false);
        }
      } catch (err) {
        console.error("Camera error:", err);
        setCameraError("ไม่สามารถเข้าถึงกล้องได้ กรุณาอนุญาตสิทธิ์การใช้งานกล้อง");
        setIsCameraLoading(false);
      }
    };

    startCamera();

    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  // PiP Stream Setup (Run once when canvas is ready)
  useEffect(() => {
    const canvas = canvasRef.current;
    const pipVideo = pipVideoRef.current;
    if (canvas && pipVideo && !pipVideo.srcObject) {
      const stream = canvas.captureStream(30);
      pipVideo.srcObject = stream;
    }
  }, []);

  // Master Render Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    const procCanvas = processingCanvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video) return;

    const ctx = canvas.getContext('2d', { alpha: false });
    const pCtx = procCanvas.getContext('2d', { willReadFrequently: true });
    if (!ctx || !pCtx) return;

    procCanvas.width = 400;
    procCanvas.height = 400;

    let animationId: number;

    const render = () => {
      // Check if video is actually providing data
      if (video.readyState < 2) {
        animationId = requestAnimationFrame(render);
        return;
      }

      const size = canvas.width;
      
      // 1. Draw Background
      ctx.save();
      if (cameraConfig.shape === 'circle') {
        ctx.beginPath(); ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2); ctx.clip();
      }
      if (bgImageRef.current) {
        ctx.drawImage(bgImageRef.current, 0, 0, size, size);
      } else {
        ctx.fillStyle = '#0f172a'; ctx.fillRect(0, 0, size, size);
      }
      ctx.restore();

      // 2. Process Video
      pCtx.clearRect(0, 0, procCanvas.width, procCanvas.height);
      pCtx.save();
      if (cameraConfig.mirrored) {
        pCtx.translate(procCanvas.width, 0); pCtx.scale(-1, 1);
      }

      const videoW = video.videoWidth || 640;
      const videoH = video.videoHeight || 480;
      const zoom = cameraConfig.zoom;
      const sw = videoW / zoom;
      const sh = videoH / zoom;
      const sx = (videoW - sw) / 2;
      const sy = (videoH - sh) / 2;

      pCtx.drawImage(video, sx, sy, sw, sh, 0, 0, procCanvas.width, procCanvas.height);
      
      if (cameraConfig.useChromaKey) {
        const imageData = pCtx.getImageData(0, 0, procCanvas.width, procCanvas.height);
        const data = imageData.data;
        const target = cameraConfig.chromaKeyColor;
        const t = cameraConfig.threshold;

        for (let i = 0; i < data.length; i += 4) {
          const r = data[i]; const g = data[i + 1]; const b = data[i + 2];
          const diff = Math.sqrt(Math.pow(r - target.r, 2) + Math.pow(g - target.g, 2) + Math.pow(b - target.b, 2));
          if (diff < t) {
            data[i + 3] = 0;
          } else if (diff < t + 25) {
            data[i + 3] = ((diff - t) / 25) * 255;
          }
        }
        pCtx.putImageData(imageData, 0, 0);
      }
      pCtx.restore();

      // 3. Composite
      ctx.save();
      if (cameraConfig.shape === 'circle') {
        ctx.beginPath(); ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2); ctx.clip();
      }
      if (cameraConfig.blur > 0) ctx.filter = `blur(${cameraConfig.blur}px)`;
      ctx.globalAlpha = cameraConfig.videoOpacity;
      ctx.drawImage(procCanvas, 0, 0, size, size);
      ctx.restore();

      animationId = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(animationId);
  }, [cameraConfig]);

  const togglePiP = async () => {
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
        setIsPiPActive(false);
      } else if (pipVideoRef.current) {
        await pipVideoRef.current.requestPictureInPicture();
        setIsPiPActive(true);
      }
    } catch (error) { console.error("PiP Error:", error); }
  };

  return (
    <div className="relative w-full h-full bg-slate-950 overflow-hidden select-none font-sans">
      <video ref={videoRef} autoPlay playsInline muted className="hidden" />
      <canvas ref={canvasRef} width={512} height={512} className="hidden" />
      <video ref={pipVideoRef} autoPlay playsInline muted className="hidden" />

      {/* Header */}
      <div className="absolute top-10 w-full text-center z-10 px-6 pointer-events-none">
        <h1 className="text-3xl font-black bg-gradient-to-b from-white to-white/60 bg-clip-text text-transparent">
          iPad Pro Presenter
        </h1>
        <p className="text-slate-500 text-xs mt-1 uppercase tracking-[0.2em]">โหมดเจาะพื้นหลัง & ปรับมุมกล้อง</p>
      </div>

      {/* Main Status UI */}
      <div className="absolute inset-0 flex items-center justify-center p-6">
        <div className="glass p-10 rounded-[3rem] max-w-sm w-full space-y-8 shadow-2xl border-white/5 text-center">
          <div className="relative w-32 h-32 mx-auto">
            {isCameraLoading ? (
              <div className="w-full h-full border-4 border-white/10 border-t-indigo-500 rounded-full animate-spin" />
            ) : (
              <>
                <div className={`absolute inset-0 ${cameraError ? 'bg-red-500/20' : 'bg-indigo-500/20'} blur-3xl rounded-full`} />
                <div className={`relative bg-gradient-to-br ${cameraError ? 'from-red-600 to-rose-700' : 'from-indigo-600 to-violet-700'} w-full h-full rounded-[2.5rem] flex items-center justify-center shadow-lg border border-white/10`}>
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                </div>
              </>
            )}
          </div>
          
          <div className="space-y-3">
            <h2 className="text-xl font-bold text-white">
              {cameraError ? 'เกิดข้อผิดพลาด' : isCameraLoading ? 'กำลังเตรียมกล้อง...' : 'พร้อมสอนหรือยัง?'}
            </h2>
            <p className="text-slate-400 text-sm px-4">
              {cameraError || 'ใช้แถบ "ซูม (Zoom)" เพื่อบีบมุมกล้องให้แคบลง ช่วยซ่อนสิ่งของที่ไม่ต้องการในห้องคุณ'}
            </p>
          </div>

          {!cameraError && !isCameraLoading && (
            <button
              onClick={togglePiP}
              className={`w-full py-5 rounded-3xl font-black text-lg transition-all active:scale-95 shadow-xl ${
                isPiPActive ? 'bg-rose-500 text-white' : 'bg-white text-black hover:bg-slate-100'
              }`}
            >
              {isPiPActive ? 'ปิดหน้าต่างลอย' : 'เปิดหน้าต่างลอย (PiP)'}
            </button>
          )}

          {cameraError && (
            <button
              onClick={() => window.location.reload()}
              className="w-full py-5 rounded-3xl font-black text-lg bg-white text-black hover:bg-slate-100 transition-all active:scale-95"
            >
              ลองใหม่อีกครั้ง
            </button>
          )}
        </div>
      </div>

      {/* Floating Overlay Preview */}
      {!isPiPActive && !cameraError && !isCameraLoading && (
        <CameraBubble 
          canvasRef={canvasRef} 
          config={cameraConfig} 
          position={pos}
          onPositionChange={setPos}
        />
      )}

      {/* Controls */}
      {isUIVisible ? (
        <ControlPanel 
          config={cameraConfig}
          onConfigChange={setCameraConfig}
          onHideUI={() => setIsUIVisible(false)}
        />
      ) : (
        <button 
          onClick={() => setIsUIVisible(true)}
          className="absolute bottom-8 left-1/2 -translate-x-1/2 px-6 py-3 glass rounded-full text-xs font-bold text-white/50 hover:text-white transition-all z-[110]"
        >
          SETTINGS
        </button>
      )}
    </div>
  );
};

export default App;
