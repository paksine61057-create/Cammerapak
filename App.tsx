
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
  
  const configRef = useRef(cameraConfig);
  useEffect(() => {
    configRef.current = cameraConfig;
  }, [cameraConfig]);

  const [isUIVisible, setIsUIVisible] = useState(true);
  const [pos, setPos] = useState<Position>({ x: 40, y: 40 });
  const [isPiPActive, setIsPiPActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isCameraLoading, setIsCameraLoading] = useState(true);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const processingCanvasRef = useRef<HTMLCanvasElement>(null);
  const pipVideoRef = useRef<HTMLVideoElement>(null);
  const bgImageRef = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    processingCanvasRef.current = document.createElement('canvas');
    processingCanvasRef.current.width = 400;
    processingCanvasRef.current.height = 400;
  }, []);

  useEffect(() => {
    if (cameraConfig.backgroundUrl) {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.src = cameraConfig.backgroundUrl;
      img.onload = () => { bgImageRef.current = img; };
      img.onerror = (e) => { 
        console.error("Failed to load background image", e);
        bgImageRef.current = null;
      };
    } else {
      bgImageRef.current = null;
    }
  }, [cameraConfig.backgroundUrl]);

  useEffect(() => {
    let stream: MediaStream | null = null;
    
    const startCamera = async () => {
      setIsCameraLoading(true);
      setCameraError(null);
      try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          throw new Error("เบราว์เซอร์นี้ไม่รองรับการใช้งานกล้อง");
        }

        stream = await navigator.mediaDevices.getUserMedia({ 
          video: { 
            facingMode: "user", 
            width: { ideal: 1280 }, 
            height: { ideal: 720 } 
          }, 
          audio: false 
        });
        
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.onloadedmetadata = () => {
            videoRef.current?.play().catch(e => console.error("Play error:", e));
            setIsCameraLoading(false);
          };
        }
      } catch (err: any) {
        console.error("Camera access error:", err);
        setCameraError(err.message || "ไม่สามารถเข้าถึงกล้องได้ กรุณาตรวจสอบการอนุญาตสิทธิ์");
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

  useEffect(() => {
    const canvas = canvasRef.current;
    const procCanvas = processingCanvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video || !procCanvas) return;

    const ctx = canvas.getContext('2d', { alpha: false });
    const pCtx = procCanvas.getContext('2d', { willReadFrequently: true });
    if (!ctx || !pCtx) return;

    let animationId: number;

    const render = () => {
      const cfg = configRef.current;
      const size = canvas.width;
      
      ctx.save();
      if (cfg.shape === 'circle') {
        ctx.beginPath(); ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2); ctx.clip();
      }
      if (bgImageRef.current) {
        ctx.drawImage(bgImageRef.current, 0, 0, size, size);
      } else {
        ctx.fillStyle = '#0f172a'; ctx.fillRect(0, 0, size, size);
      }
      ctx.restore();

      if (video.readyState >= 2) {
        pCtx.clearRect(0, 0, procCanvas.width, procCanvas.height);
        pCtx.save();
        if (cfg.mirrored) {
          pCtx.translate(procCanvas.width, 0); pCtx.scale(-1, 1);
        }

        const videoW = video.videoWidth;
        const videoH = video.videoHeight;
        const zoom = cfg.zoom;
        
        const minDim = Math.min(videoW, videoH);
        const sw = (minDim / zoom);
        const sh = (minDim / zoom);
        const sx = (videoW - sw) / 2;
        const sy = (videoH - sh) / 2;

        pCtx.drawImage(video, sx, sy, sw, sh, 0, 0, procCanvas.width, procCanvas.height);
        
        if (cfg.useChromaKey) {
          const imageData = pCtx.getImageData(0, 0, procCanvas.width, procCanvas.height);
          const data = imageData.data;
          const target = cfg.chromaKeyColor;
          const t = cfg.threshold;

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

        ctx.save();
        if (cfg.shape === 'circle') {
          ctx.beginPath(); ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2); ctx.clip();
        }
        if (cfg.blur > 0) ctx.filter = `blur(${cfg.blur}px)`;
        ctx.globalAlpha = cfg.videoOpacity;
        ctx.drawImage(procCanvas, 0, 0, size, size);
        ctx.restore();
      }

      animationId = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(animationId);
  }, []);

  const togglePiP = async () => {
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
        setIsPiPActive(false);
      } else if (pipVideoRef.current && canvasRef.current) {
        const stream = canvasRef.current.captureStream(30);
        pipVideoRef.current.srcObject = stream;
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

      {/* Main Status UI - แสดงเมื่อกล้องมีปัญหาหรือกำลังโหลด แต่ไม่บังปุ่ม Settings */}
      {(isCameraLoading || cameraError) && (
        <div className="absolute inset-0 flex items-center justify-center p-6 pointer-events-none">
          <div className="glass p-10 rounded-[3rem] max-w-sm w-full space-y-8 shadow-2xl border-white/5 text-center pointer-events-auto">
            <div className="relative w-32 h-32 mx-auto">
              {isCameraLoading ? (
                <div className="w-full h-full border-4 border-white/5 border-t-indigo-500 rounded-full animate-spin" />
              ) : (
                <div className={`relative bg-gradient-to-br from-red-600 to-rose-700 w-full h-full rounded-[2.5rem] flex items-center justify-center shadow-lg border border-white/10`}>
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
              )}
            </div>
            
            <div className="space-y-3">
              <h2 className="text-xl font-bold text-white">
                {cameraError ? 'พบข้อขัดข้อง' : 'กำลังเตรียมความพร้อม...'}
              </h2>
              <p className="text-slate-400 text-sm px-4">
                {cameraError || 'กรุณารอสักครู่ขณะแอปกำลังเริ่มต้นระบบ'}
              </p>
            </div>

            {cameraError && (
              <button
                onClick={() => window.location.reload()}
                className="w-full py-5 rounded-3xl font-black text-lg bg-white text-black hover:bg-slate-100 transition-all active:scale-95"
              >
                รีโหลดหน้าเว็บ
              </button>
            )}
          </div>
        </div>
      )}

      {/* Floating Overlay Preview */}
      {!isPiPActive && !isCameraLoading && (
        <CameraBubble 
          canvasRef={canvasRef} 
          config={cameraConfig} 
          position={pos}
          onPositionChange={setPos}
        />
      )}

      {/* Controls - แสดงเสมอให้ผู้ใช้กดได้ */}
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
          เปิดการตั้งค่า
        </button>
      )}

      {/* PiP Shortcut Button - ถ้ากล้องพร้อมแล้วแต่ปิด UI ไป */}
      {!isUIVisible && !isPiPActive && !isCameraLoading && (
        <button
          onClick={togglePiP}
          className="absolute top-8 right-8 w-12 h-12 glass rounded-2xl flex items-center justify-center text-white/70 hover:text-white transition-all z-[60]"
          title="เปิดโหมดหน้าต่างลอย"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
        </button>
      )}
    </div>
  );
};

export default App;
