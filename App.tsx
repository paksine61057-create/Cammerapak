
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { CameraBubble } from './components/CameraBubble';
import { ControlPanel } from './components/ControlPanel';
import { CameraConfig, Position } from './types';

const STORAGE_KEY = 'presenter_camera_config_v8';

const DEFAULT_CONFIG: CameraConfig = {
  shape: 'rect',      // เปลี่ยนเป็นสี่เหลี่ยมเพื่อให้เห็นภาพสดได้กว้างขึ้น
  size: 360,
  mirrored: true,
  backgroundUrl: null, // ปิดพื้นหลัง
  blur: 0,
  videoOpacity: 1.0,
  zoom: 1.0,           // ไม่ซูม (ภาพสดจริง)
  useChromaKey: false, // ปิดการตัดพื้นหลัง
  chromaKeyColor: { r: 255, g: 255, b: 255 }, 
  threshold: 45,
};

const App: React.FC = () => {
  const [cameraConfig, setCameraConfig] = useState<CameraConfig>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        return DEFAULT_CONFIG;
      }
    }
    return DEFAULT_CONFIG;
  });
  
  const configRef = useRef(cameraConfig);
  const [isUIVisible, setIsUIVisible] = useState(false);
  const [pos, setPos] = useState<Position>({ x: window.innerWidth / 2 - 180, y: window.innerHeight / 2 - 180 });
  const [isPiPActive, setIsPiPActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isCameraLoading, setIsCameraLoading] = useState(true);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pipVideoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cameraConfig));
    configRef.current = cameraConfig;
  }, [cameraConfig]);

  useEffect(() => {
    let stream: MediaStream | null = null;
    const startCamera = async () => {
      setIsCameraLoading(true);
      try {
        stream = await navigator.mediaDevices.getUserMedia({ 
          video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } }
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.onloadedmetadata = () => {
            videoRef.current?.play().catch(e => console.error(e));
            setIsCameraLoading(false);
          };
        }
      } catch (err: any) {
        setCameraError("ไม่สามารถเข้าถึงกล้องได้");
        setIsCameraLoading(false);
      }
    };
    startCamera();
    return () => stream?.getTracks().forEach(t => t.stop());
  }, []);

  const renderFrame = useCallback(() => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video || video.readyState < 2) return;
    
    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    const cfg = configRef.current;
    const size = canvas.width;
    
    ctx.clearRect(0, 0, size, size);
    ctx.save();
    
    // Masking
    if (cfg.shape === 'circle') { 
      ctx.beginPath(); ctx.arc(size/2, size/2, size/2, 0, Math.PI*2); ctx.clip(); 
    } else {
      const radius = 24; // ลบมุมเล็กน้อยให้ดูทันสมัย
      ctx.beginPath();
      ctx.moveTo(radius, 0); ctx.lineTo(size - radius, 0); ctx.quadraticCurveTo(size, 0, size, radius);
      ctx.lineTo(size, size - radius); ctx.quadraticCurveTo(size, size, size - radius, size);
      ctx.lineTo(radius, size); ctx.quadraticCurveTo(0, size, 0, size - radius);
      ctx.lineTo(0, radius); ctx.quadraticCurveTo(0, 0, radius, 0);
      ctx.closePath();
      ctx.clip();
    }

    // Draw Raw Video
    if (cfg.mirrored) { 
      ctx.translate(size, 0); 
      ctx.scale(-1, 1); 
    }
    
    const zoom = cfg.zoom;
    const sw = video.videoWidth / zoom;
    const sh = video.videoHeight / zoom;
    const sx = (video.videoWidth - sw) / 2;
    const sy = (video.videoHeight - sh) / 2;
    
    ctx.drawImage(video, sx, sy, sw, sh, 0, 0, size, size);
    ctx.restore();
  }, []);

  useEffect(() => {
    const ticker = setInterval(renderFrame, 1000/30);
    return () => clearInterval(ticker);
  }, [renderFrame]);

  const handlePiPToggle = async () => {
    const video = pipVideoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    const isCurrentlyPiP = document.pictureInPictureElement || (video as any).webkitPresentationMode === 'picture-in-picture';
    if (isCurrentlyPiP) {
      try {
        if (document.exitPictureInPicture) await document.exitPictureInPicture();
        setIsPiPActive(false);
      } catch (e) { console.error(e); }
      return;
    }
    try {
      video.srcObject = canvas.captureStream(30);
      await video.play();
      if (video.requestPictureInPicture) await video.requestPictureInPicture();
      setIsPiPActive(true);
    } catch (e) { alert("เบราว์เซอร์ของคุณไม่รองรับการเปิดโหมดลอย"); }
  };

  return (
    <div className="relative w-full h-full bg-[#020617] text-white overflow-hidden select-none font-sans">
      <video ref={videoRef} style={{ display: 'none' }} muted playsInline />
      <canvas ref={canvasRef} width={512} height={512} className="fixed -top-[2000px] pointer-events-none" />
      <video ref={pipVideoRef} style={{ position: 'fixed', opacity: 0, pointerEvents: 'none', zIndex: -1 }} muted playsInline />

      <div className="absolute inset-x-0 bottom-16 z-[100] flex flex-col items-center pointer-events-none">
        {isUIVisible ? (
          <div className="pointer-events-auto w-full max-w-md px-4 scale-90">
            <ControlPanel config={cameraConfig} onConfigChange={setCameraConfig} onHideUI={() => setIsUIVisible(false)} />
          </div>
        ) : (
          <div className="flex flex-col items-center gap-4 pointer-events-auto animate-in fade-in slide-in-from-bottom-5 duration-700">
            {!cameraError && !isCameraLoading && (
              <button 
                onClick={handlePiPToggle} 
                className={`flex items-center gap-4 px-12 py-6 rounded-full font-black text-sm uppercase tracking-widest shadow-2xl transition-all active:scale-95 ${isPiPActive ? 'bg-zinc-800 text-white' : 'bg-white text-black hover:bg-zinc-200'}`}
              >
                {isPiPActive ? '⏹ ปิดโหมดลอย' : '📺 เปิดโหมดลอย'}
              </button>
            )}
            <button 
              onClick={() => setIsUIVisible(true)} 
              className="text-[9px] font-bold text-white/10 uppercase tracking-[0.3em] hover:text-white/40 transition-colors"
            >
              ตั้งค่ากล้อง
            </button>
          </div>
        )}
      </div>

      <div className="absolute inset-0 flex items-center justify-center p-8 pointer-events-none">
        <div className="pointer-events-auto">
          {!isCameraLoading && !cameraError && (
            <CameraBubble canvasRef={canvasRef} config={cameraConfig} position={pos} onPositionChange={setPos} />
          )}
        </div>
        
        {isCameraLoading && (
          <div className="w-10 h-10 border-4 border-white/5 border-t-white/40 rounded-full animate-spin" />
        )}

        {cameraError && (
          <p className="text-red-400 text-xs font-bold">{cameraError}</p>
        )}
      </div>
    </div>
  );
};

export default App;
