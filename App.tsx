
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
    zoom: 1.2, // Slightly zoomed by default for a better portrait look
    useChromaKey: false,
    chromaKeyColor: { r: 255, g: 255, b: 255 },
    threshold: 50,
  });
  
  const [isUIVisible, setIsUIVisible] = useState(true);
  const [pos, setPos] = useState<Position>({ x: 40, y: 40 });
  const [isPiPActive, setIsPiPActive] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const processingCanvasRef = useRef<HTMLCanvasElement>(document.createElement('canvas'));
  const pipVideoRef = useRef<HTMLVideoElement>(null);
  const bgImageRef = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    if (cameraConfig.backgroundUrl) {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.src = cameraConfig.backgroundUrl;
      img.onload = () => { bgImageRef.current = img; };
    } else {
      bgImageRef.current = null;
    }
  }, [cameraConfig.backgroundUrl]);

  useEffect(() => {
    const startCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
          video: { facingMode: "user", width: 640, height: 640 }, 
          audio: false 
        });
        if (videoRef.current) videoRef.current.srcObject = stream;
      } catch (err) { console.error("Camera error:", err); }
    };
    startCamera();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const procCanvas = processingCanvasRef.current;
    const video = videoRef.current;
    const pipVideo = pipVideoRef.current;
    if (!canvas || !video || !pipVideo) return;

    const ctx = canvas.getContext('2d', { alpha: false });
    const pCtx = procCanvas.getContext('2d', { willReadFrequently: true });
    if (!ctx || !pCtx) return;

    procCanvas.width = 400; // Resolution for processing
    procCanvas.height = 400;

    let animationId: number;

    const render = () => {
      const size = canvas.width;
      
      // 1. Draw Virtual Background FIRST (Layer 0)
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

      // 2. Process Video for Zoom & Chroma Key (Layer 1)
      pCtx.clearRect(0, 0, procCanvas.width, procCanvas.height);
      pCtx.save();
      if (cameraConfig.mirrored) {
        pCtx.translate(procCanvas.width, 0); pCtx.scale(-1, 1);
      }

      // Digital Zoom Logic
      const videoW = video.videoWidth || 640;
      const videoH = video.videoHeight || 480;
      const videoAspect = videoW / videoH;
      
      // Calculate crop area based on zoom
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
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          
          const diff = Math.sqrt(
            Math.pow(r - target.r, 2) + 
            Math.pow(g - target.g, 2) + 
            Math.pow(b - target.b, 2)
          );

          if (diff < t) {
            data[i + 3] = 0;
          } else if (diff < t + 25) {
            data[i + 3] = ((diff - t) / 25) * 255;
          }
        }
        pCtx.putImageData(imageData, 0, 0);
      }
      pCtx.restore();

      // 3. Draw Processed Video on Top of Background
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
    const stream = canvas.captureStream(30);
    pipVideo.srcObject = stream;
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

      <div className="absolute top-10 w-full text-center z-10 px-6 pointer-events-none">
        <h1 className="text-3xl font-black bg-gradient-to-b from-white to-white/60 bg-clip-text text-transparent">
          iPad Pro Presenter
        </h1>
        <p className="text-slate-500 text-xs mt-1 uppercase tracking-[0.2em]">โหมดเจาะพื้นหลัง & ปรับมุมกล้อง</p>
      </div>

      <div className="absolute inset-0 flex items-center justify-center p-6">
        <div className="glass p-10 rounded-[3rem] max-w-sm w-full space-y-8 shadow-2xl border-white/5 text-center">
          <div className="relative w-32 h-32 mx-auto">
            <div className="absolute inset-0 bg-indigo-500/20 blur-3xl rounded-full" />
            <div className="relative bg-gradient-to-br from-indigo-600 to-violet-700 w-full h-full rounded-[2.5rem] flex items-center justify-center shadow-lg border border-white/10">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            </div>
          </div>
          
          <div className="space-y-3">
            <h2 className="text-xl font-bold text-white">พร้อมสอนหรือยัง?</h2>
            <p className="text-slate-400 text-sm px-4">
              ใช้แถบ "ซูม (Zoom)" เพื่อบีบมุมกล้องให้แคบลง ช่วยซ่อนสิ่งของที่ไม่ต้องการในห้องคุณ
            </p>
          </div>

          <button
            onClick={togglePiP}
            className={`w-full py-5 rounded-3xl font-black text-lg transition-all active:scale-95 shadow-xl ${
              isPiPActive ? 'bg-rose-500 text-white' : 'bg-white text-black hover:bg-slate-100'
            }`}
          >
            {isPiPActive ? 'ปิดหน้าต่างลอย' : 'เปิดหน้าต่างลอย (PiP)'}
          </button>
        </div>
      </div>

      {!isPiPActive && (
        <CameraBubble 
          canvasRef={canvasRef} 
          config={cameraConfig} 
          position={pos}
          onPositionChange={setPos}
        />
      )}

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
