
import React, { useState, useRef, useEffect, useCallback } from 'react';
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
  const [pos, setPos] = useState<Position>({ x: 40, y: 150 });
  const [isPiPActive, setIsPiPActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isCameraLoading, setIsCameraLoading] = useState(true);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const processingCanvasRef = useRef<HTMLCanvasElement>(null);
  const pipVideoRef = useRef<HTMLVideoElement>(null);
  const bgImageRef = useRef<HTMLImageElement | null>(null);
  const workerRef = useRef<Worker | null>(null);

  // Initialize Processing Canvas
  useEffect(() => {
    const pc = document.createElement('canvas');
    pc.width = 512;
    pc.height = 512;
    processingCanvasRef.current = pc;
  }, []);

  // Background Image Loader
  useEffect(() => {
    if (cameraConfig.backgroundUrl) {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.src = cameraConfig.backgroundUrl;
      img.onload = () => { bgImageRef.current = img; };
      img.onerror = () => { bgImageRef.current = null; };
    } else {
      bgImageRef.current = null;
    }
  }, [cameraConfig.backgroundUrl]);

  // Camera Setup
  useEffect(() => {
    let stream: MediaStream | null = null;
    const startCamera = async () => {
      setIsCameraLoading(true);
      setCameraError(null);
      try {
        stream = await navigator.mediaDevices.getUserMedia({ 
          video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } }
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.onloadedmetadata = () => {
            videoRef.current?.play().catch(e => console.error("Play Error", e));
            setIsCameraLoading(false);
          };
        }
      } catch (err: any) {
        setCameraError("ไม่พบกล้องหรือยังไม่ได้อนุญาตสิทธิ์");
        setIsCameraLoading(false);
      }
    };
    startCamera();
    return () => stream?.getTracks().forEach(t => t.stop());
  }, []);

  // Render Logic (Extracted to be called by Worker)
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
    
    // Clear and draw background
    ctx.fillStyle = '#020617';
    ctx.fillRect(0, 0, size, size);
    if (bgImageRef.current) ctx.drawImage(bgImageRef.current, 0, 0, size, size);

    if (video.readyState >= 2) {
      pCtx.clearRect(0, 0, procCanvas.width, procCanvas.height);
      pCtx.save();
      
      if (cfg.mirrored) { 
        pCtx.translate(procCanvas.width, 0); 
        pCtx.scale(-1, 1); 
      }
      
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
          const diff = Math.sqrt((r-tr)**2 + (g-tg)**2 + (b-tb)**2);
          if (diff < threshold) data[i+3] = 0;
          else if (diff < threshold + 20) data[i+3] = ((diff - threshold) / 20) * 255;
        }
        pCtx.putImageData(imageData, 0, 0);
      }
      pCtx.restore();

      ctx.save();
      if (cfg.shape === 'circle') { 
        ctx.beginPath(); 
        ctx.arc(size/2, size/2, size/2, 0, Math.PI*2); 
        ctx.clip(); 
      }
      if (cfg.blur > 0) ctx.filter = `blur(${cfg.blur}px)`;
      ctx.globalAlpha = cfg.videoOpacity;
      ctx.drawImage(procCanvas, 0, 0, size, size);
      ctx.restore();
    }
  }, []);

  // Worker Timer for Background Rendering
  useEffect(() => {
    // สร้าง Worker ผ่าน Blob เพื่อให้ไม่ต้องมีไฟล์แยก
    const workerCode = `
      let interval;
      self.onmessage = function(e) {
        if (e.data === 'start') {
          interval = setInterval(() => self.postMessage('tick'), 1000/30);
        } else if (e.data === 'stop') {
          clearInterval(interval);
        }
      };
    `;
    const blob = new Blob([workerCode], { type: 'application/javascript' });
    const worker = new Worker(URL.createObjectURL(blob));
    
    worker.onmessage = () => {
      renderFrame();
    };
    
    worker.postMessage('start');
    workerRef.current = worker;

    return () => {
      worker.postMessage('stop');
      worker.terminate();
    };
  }, [renderFrame]);

  const handlePiPToggle = async () => {
    const video = pipVideoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    const isCurrentlyPiP = document.pictureInPictureElement || (video as any).webkitPresentationMode === 'picture-in-picture';

    if (isCurrentlyPiP) {
      try {
        if (document.exitPictureInPicture) {
          await document.exitPictureInPicture();
        } else if ((video as any).webkitSetPresentationMode) {
          (video as any).webkitSetPresentationMode('inline');
        }
        setIsPiPActive(false);
      } catch (e) {
        console.error("Exit PiP error", e);
      }
      return;
    }

    try {
      // ดึง Stream และสั่งเล่น
      const stream = canvas.captureStream(30);
      video.srcObject = stream;
      await video.play();
      
      // หน่วงเวลาให้ iPadOS ยอมรับ Metadata
      await new Promise(resolve => {
        const check = () => (video.readyState >= 2 ? resolve(null) : setTimeout(check, 100));
        check();
      });
      await new Promise(r => setTimeout(r, 600));

      // เรียกโหมดลอยตัว
      if ((video as any).webkitSetPresentationMode) {
        (video as any).webkitSetPresentationMode('picture-in-picture');
      } else if (video.requestPictureInPicture) {
        await video.requestPictureInPicture();
      }
      setIsPiPActive(true);
    } catch (e: any) {
      alert("ไม่สามารถเปิดโหมดลอยได้: " + (e.message || "กรุณาใช้ Safari"));
    }
  };

  useEffect(() => {
    const video = pipVideoRef.current;
    const handleExit = () => setIsPiPActive(false);
    const handleEnter = () => setIsPiPActive(true);
    video?.addEventListener('enterpictureinpicture', handleEnter);
    video?.addEventListener('leavepictureinpicture', handleExit);
    const handleWebkitChange = () => {
      const mode = (video as any).webkitPresentationMode;
      if (mode === 'picture-in-picture') setIsPiPActive(true);
      if (mode === 'inline') setIsPiPActive(false);
    };
    video?.addEventListener('webkitpresentationmodechanged', handleWebkitChange);
    return () => {
      video?.removeEventListener('enterpictureinpicture', handleEnter);
      video?.removeEventListener('leavepictureinpicture', handleExit);
      video?.removeEventListener('webkitpresentationmodechanged', handleWebkitChange);
    };
  }, []);

  return (
    <div className="relative w-full h-full bg-[#020617] text-white overflow-hidden select-none font-sans">
      <video ref={videoRef} style={{ display: 'none' }} muted playsInline />
      
      {/* Canvas สำหรับประมวลผล (ต้องไม่ display:none) */}
      <canvas 
        ref={canvasRef} 
        width={512} 
        height={512} 
        style={{ 
          position: 'fixed', 
          top: '-1000px', 
          left: '-1000px', 
          opacity: 0.1,
          pointerEvents: 'none' 
        }} 
      />
      
      {/* Video สำหรับ PiP (ต้องไม่ display:none และมีขนาดจริง) */}
      <video 
        ref={pipVideoRef} 
        style={{ 
          position: 'fixed', 
          bottom: '10px', 
          right: '10px', 
          width: '320px', 
          height: '240px', 
          pointerEvents: 'none',
          opacity: 0.001,
          zIndex: -1
        }}
        muted 
        playsInline 
      />

      <div className="absolute top-8 w-full text-center z-[10] px-6 pointer-events-none">
        <h1 className="text-3xl font-black tracking-tighter text-white/90 drop-shadow-2xl">
          iPad <span className="text-indigo-500 font-extrabold italic">Presenter</span>
        </h1>
        {isPiPActive && (
          <div className="mt-4 animate-pulse">
            <span className="px-6 py-2 bg-green-500 text-black rounded-full text-[10px] font-black uppercase tracking-widest shadow-xl">
              Streaming Active
            </span>
          </div>
        )}
      </div>

      <div className="absolute inset-x-0 top-24 z-[100] flex flex-col items-center pointer-events-none">
        {isUIVisible ? (
          <div className="pointer-events-auto w-full max-w-md px-4">
            <ControlPanel config={cameraConfig} onConfigChange={setCameraConfig} onHideUI={() => setIsUIVisible(false)} />
          </div>
        ) : (
          <div className="flex gap-4 pointer-events-auto items-center p-6">
            <button 
              onClick={() => setIsUIVisible(true)} 
              className="px-10 py-5 glass rounded-full text-[10px] font-black tracking-widest uppercase border border-white/20 hover:bg-white/10 transition-all shadow-2xl"
            >
              ตั้งค่ากล้อง
            </button>
            
            {!cameraError && !isCameraLoading && (
              <button 
                onClick={handlePiPToggle}
                className={`flex items-center gap-3 px-10 py-5 rounded-full font-black text-[10px] uppercase tracking-widest shadow-2xl transition-all active:scale-95 ${
                  isPiPActive ? 'bg-red-500 text-white' : 'bg-indigo-600 text-white'
                }`}
              >
                {isPiPActive ? 'ปิดหน้าต่างลอย' : 'เปิดหน้าต่างลอย'}
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
          <div className="glass p-16 rounded-[4rem] text-center space-y-6">
            <div className="w-14 h-14 border-4 border-indigo-500/10 border-t-indigo-500 rounded-full animate-spin mx-auto" />
            <p className="text-[10px] font-black text-white/30 uppercase tracking-[0.3em]">กำลังเริ่มการทำงาน...</p>
          </div>
        )}

        {cameraError && (
          <div className="glass p-12 rounded-[3.5rem] text-center space-y-8 max-w-xs border-red-500/20 shadow-2xl">
            <p className="text-sm font-bold text-red-400">{cameraError}</p>
            <button onClick={() => window.location.reload()} className="w-full py-5 bg-white text-black rounded-3xl font-black text-[10px] uppercase tracking-widest">ลองใหม่อีกครั้ง</button>
          </div>
        )}
      </div>
    </div>
  );
};

export default App;
