
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { CameraBubble } from './components/CameraBubble';
import { ControlPanel } from './components/ControlPanel';
import { CameraConfig, Position } from './types';

const STORAGE_KEY = 'presenter_camera_config_v6';

const DEFAULT_CONFIG: CameraConfig = {
  shape: 'circle',
  size: 280,
  mirrored: true,
  backgroundUrl: 'https://images.unsplash.com/photo-1543589077-47d81606c1ad?auto=format&fit=crop&q=80&w=1200',
  blur: 0,
  videoOpacity: 1.0, // ปรับให้คนทึบ 100% เพื่อให้แยกจากพื้นหลังชัดเจน
  zoom: 1.4,
  useChromaKey: true,
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
  const [isUIVisible, setIsUIVisible] = useState(true);
  const [pos, setPos] = useState<Position>({ x: 50, y: 150 });
  const [isPiPActive, setIsPiPActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isCameraLoading, setIsCameraLoading] = useState(true);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const processingCanvasRef = useRef<HTMLCanvasElement>(null);
  const pipVideoRef = useRef<HTMLVideoElement>(null);
  const bgImageRef = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cameraConfig));
    configRef.current = cameraConfig;
  }, [cameraConfig]);

  useEffect(() => {
    const pc = document.createElement('canvas');
    pc.width = 512;
    pc.height = 512;
    processingCanvasRef.current = pc;
  }, []);

  useEffect(() => {
    if (!cameraConfig.backgroundUrl) {
      bgImageRef.current = null;
      return;
    }
    const img = new Image();
    if (!cameraConfig.backgroundUrl.startsWith('data:')) {
      img.crossOrigin = "anonymous";
    }
    img.onload = () => { bgImageRef.current = img; };
    img.onerror = () => { bgImageRef.current = null; };
    img.src = cameraConfig.backgroundUrl;
  }, [cameraConfig.backgroundUrl]);

  const drawImageCover = (ctx: CanvasRenderingContext2D, img: HTMLImageElement, w: number, h: number) => {
    if (!img.complete || img.naturalWidth === 0) return;
    const imgRatio = img.naturalWidth / img.naturalHeight;
    const canvasRatio = w / h;
    let sx, sy, sw, sh;
    if (imgRatio > canvasRatio) {
      sh = img.naturalHeight; sw = img.naturalHeight * canvasRatio;
      sx = (img.naturalWidth - sw) / 2; sy = 0;
    } else {
      sw = img.naturalWidth; sh = img.naturalWidth / canvasRatio;
      sx = 0; sy = (img.naturalHeight - sh) / 2;
    }
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, w, h);
  };

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
    const procCanvas = processingCanvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video || !procCanvas) return;
    
    const ctx = canvas.getContext('2d', { alpha: false });
    const pCtx = procCanvas.getContext('2d', { willReadFrequently: true });
    if (!ctx || !pCtx) return;

    const cfg = configRef.current;
    const size = canvas.width;
    
    // Reset Shadow for background
    ctx.shadowBlur = 0;
    ctx.shadowColor = 'transparent';

    // 1. Draw Background Base
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, size, size);

    ctx.save();
    // Create Bubble Clipping Mask
    if (cfg.shape === 'circle') { 
      ctx.beginPath(); ctx.arc(size/2, size/2, size/2, 0, Math.PI*2); ctx.clip(); 
    } else {
      const radius = 60;
      ctx.beginPath();
      ctx.moveTo(radius, 0); ctx.lineTo(size - radius, 0); ctx.quadraticCurveTo(size, 0, size, radius);
      ctx.lineTo(size, size - radius); ctx.quadraticCurveTo(size, size, size - radius, size);
      ctx.lineTo(radius, size); ctx.quadraticCurveTo(0, size, 0, size - radius);
      ctx.lineTo(0, radius); ctx.quadraticCurveTo(0, 0, radius, 0);
      ctx.closePath();
      ctx.clip();
    }

    // 2. วาดภาพพื้นหลัง (เลเยอร์ล่างสุด)
    ctx.globalAlpha = 1.0;
    if (bgImageRef.current) {
      drawImageCover(ctx, bgImageRef.current, size, size);
    } else {
      ctx.fillStyle = '#450a0a';
      ctx.fillRect(0, 0, size, size);
    }

    // 3. วาดวิดีโอตัวคน (เลเยอร์บนสุด + เพิ่มเงาให้ดูแยกออกมา)
    if (video.readyState >= 2) {
      pCtx.clearRect(0, 0, procCanvas.width, procCanvas.height);
      pCtx.save();
      if (cfg.mirrored) { pCtx.translate(procCanvas.width, 0); pCtx.scale(-1, 1); }
      
      const zoom = cfg.zoom;
      const sw = video.videoWidth / zoom;
      const sh = video.videoHeight / zoom;
      const sx = (video.videoWidth - sw) / 2;
      const sy = (video.videoHeight - sh) / 2;
      
      pCtx.drawImage(video, sx, sy, sw, sh, 0, 0, procCanvas.width, procCanvas.height);
      
      if (cfg.useChromaKey) {
        const imageData = pCtx.getImageData(0, 0, procCanvas.width, procCanvas.height);
        const data = imageData.data;
        const { r: tr, g: tg, b: tb } = cfg.chromaKeyColor;
        const threshold = cfg.threshold;
        for (let i = 0; i < data.length; i += 4) {
          const r = data[i], g = data[i+1], b = data[i+2];
          const dist = Math.sqrt((r-tr)**2 + (g-tg)**2 + (b-tb)**2);
          if (dist < threshold) {
            data[i+3] = 0;
          } else if (dist < threshold + 15) {
            data[i+3] = ((dist - threshold) / 15) * 255;
          }
        }
        pCtx.putImageData(imageData, 0, 0);
      }
      pCtx.restore();

      // เพิ่ม Drop Shadow ให้ตัวคนเพื่อให้ "แยก" ออกจากพื้นหลัง
      ctx.save();
      ctx.shadowBlur = 30;
      ctx.shadowColor = 'rgba(0,0,0,0.7)';
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 10;
      
      ctx.globalAlpha = cfg.videoOpacity;
      ctx.drawImage(procCanvas, 0, 0, size, size);
      ctx.restore();
    }
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
        else if ((video as any).webkitSetPresentationMode) (video as any).webkitSetPresentationMode('inline');
        setIsPiPActive(false);
      } catch (e) { console.error(e); }
      return;
    }
    try {
      video.srcObject = canvas.captureStream(30);
      await video.play();
      if ((video as any).webkitSetPresentationMode) (video as any).webkitSetPresentationMode('picture-in-picture');
      else if (video.requestPictureInPicture) await video.requestPictureInPicture();
      setIsPiPActive(true);
    } catch (e) { alert("เบราว์เซอร์ไม่รองรับโหมดลอย"); }
  };

  return (
    <div className="relative w-full h-full bg-[#020617] text-white overflow-hidden select-none font-sans">
      <video ref={videoRef} style={{ display: 'none' }} muted playsInline />
      <canvas ref={canvasRef} width={512} height={512} className="fixed -top-[2000px] pointer-events-none" />
      <video ref={pipVideoRef} style={{ position: 'fixed', opacity: 0, pointerEvents: 'none', zIndex: -1 }} muted playsInline />

      <div className="absolute top-8 w-full text-center z-10 pointer-events-none">
        <h1 className="text-4xl font-black tracking-tighter text-white/90 drop-shadow-2xl uppercase italic">
          Presenter <span className="text-red-500">Pro</span>
        </h1>
      </div>

      <div className="absolute inset-x-0 top-24 z-[100] flex flex-col items-center pointer-events-none">
        {isUIVisible ? (
          <div className="pointer-events-auto w-full max-w-md px-4">
            <ControlPanel config={cameraConfig} onConfigChange={setCameraConfig} onHideUI={() => setIsUIVisible(false)} />
          </div>
        ) : (
          <div className="flex gap-4 pointer-events-auto items-center p-6 animate-in slide-in-from-bottom-10 duration-500">
            <button onClick={() => setIsUIVisible(true)} className="px-12 py-6 glass rounded-full text-xs font-black tracking-[0.2em] uppercase border border-white/20 hover:bg-white/10 transition-all shadow-[0_20px_50px_rgba(0,0,0,0.5)] active:scale-95">
              เมนูตั้งค่าพื้นหลัง
            </button>
            {!cameraError && !isCameraLoading && (
              <button onClick={handlePiPToggle} className={`flex items-center gap-3 px-12 py-6 rounded-full font-black text-xs uppercase tracking-[0.2em] shadow-2xl transition-all active:scale-95 ${isPiPActive ? 'bg-red-800 text-white' : 'bg-red-600 text-white hover:bg-red-500'}`}>
                {isPiPActive ? '⏹ ปิดโหมดลอย' : '📺 เปิดโหมดลอย'}
              </button>
            )}
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
          <div className="glass p-16 rounded-[4rem] text-center space-y-6 shadow-2xl">
            <div className="w-16 h-16 border-[6px] border-white/5 border-t-red-500 rounded-full animate-spin mx-auto" />
            <p className="text-xs font-black text-white/40 uppercase tracking-[0.4em]">กำลังเชื่อมต่อกล้อง...</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default App;
