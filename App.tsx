
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
  const [pos, setPos] = useState<Position>({ x: 40, y: 150 });
  const [isPiPActive, setIsPiPActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isCameraLoading, setIsCameraLoading] = useState(true);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const processingCanvasRef = useRef<HTMLCanvasElement>(null);
  const pipVideoRef = useRef<HTMLVideoElement>(null);
  const bgImageRef = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    const pc = document.createElement('canvas');
    pc.width = 512;
    pc.height = 512;
    processingCanvasRef.current = pc;
  }, []);

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

  useEffect(() => {
    let stream: MediaStream | null = null;
    const startCamera = async () => {
      setIsCameraLoading(true);
      setCameraError(null);
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error("iPad ของคุณไม่รองรับการเข้าถึงกล้องผ่านเบราว์เซอร์นี้");
        }
        stream = await navigator.mediaDevices.getUserMedia({ 
          video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } }
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.onloadedmetadata = () => {
            videoRef.current?.play().catch(e => console.error("Video Play Error:", e));
            setIsCameraLoading(false);
          };
        }
      } catch (err: any) {
        setCameraError(err.message || "ไม่สามารถเปิดกล้องได้");
        setIsCameraLoading(false);
      }
    };
    startCamera();
    return () => stream?.getTracks().forEach(t => t.stop());
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
      ctx.fillStyle = '#020617';
      ctx.fillRect(0, 0, size, size);
      if (bgImageRef.current) ctx.drawImage(bgImageRef.current, 0, 0, size, size);
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
            const diff = Math.sqrt((r-tr)**2 + (g-tg)**2 + (b-tb)**2);
            if (diff < threshold) data[i+3] = 0;
            else if (diff < threshold + 20) data[i+3] = ((diff - threshold) / 20) * 255;
          }
          pCtx.putImageData(imageData, 0, 0);
        }
        pCtx.restore();
        ctx.save();
        if (cfg.shape === 'circle') { ctx.beginPath(); ctx.arc(size/2, size/2, size/2, 0, Math.PI*2); ctx.clip(); }
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

  const handlePiPToggle = async () => {
    const video = pipVideoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    // ตรวจสอบว่ากำลังเปิด PiP อยู่หรือไม่
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

    // พยายามเข้าโหมด PiP
    try {
      // 1. ดึง Stream จาก Canvas (ต้องทำภายใน Event Click ของผู้ใช้เท่านั้น Safari ถึงจะยอม)
      const stream = canvas.captureStream(30);
      video.srcObject = stream;
      
      // 2. สั่งเล่นวิดีโอต้นทาง
      await video.play();
      
      // 3. รอให้ Buffer และ Metadata พร้อม (สำคัญมากสำหรับ Safari บน iPad)
      await new Promise(resolve => setTimeout(resolve, 300));

      // 4. เรียกใช้ API ตามลำดับความเสถียรของ iPadOS
      if ((video as any).webkitSetPresentationMode) {
        // วิธีนี้เสถียรที่สุดสำหรับ Safari บน iPad
        (video as any).webkitSetPresentationMode('picture-in-picture');
      } else if (video.requestPictureInPicture) {
        // มาตรฐานทั่วไป
        await video.requestPictureInPicture();
      } else {
        throw new Error("iPad ของคุณไม่รองรับโหมดนี้ในเบราว์เซอร์นี้ กรุณาใช้ Safari");
      }
      
      setIsPiPActive(true);
    } catch (e: any) {
      console.error("PiP Toggle Error:", e);
      alert("ไม่สามารถเปิดโหมดลอยได้: " + (e.message || "กรุณาใช้ Safari และตรวจสอบว่าไม่ได้เปิดโหมดประหยัดพลังงาน"));
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
      <video ref={videoRef} className="hidden" muted playsInline />
      <canvas ref={canvasRef} width={512} height={512} className="hidden" />
      
      {/* วิดีโอต้นทางสำหรับ PiP ต้องอยู่ในหน้าจอและมีขนาดจริง เพื่อให้ iPad ยอมรับ */}
      <video 
        ref={pipVideoRef} 
        style={{ 
          position: 'fixed', 
          top: '-1000px', 
          left: '-1000px', 
          width: '320px', 
          height: '240px', 
          pointerEvents: 'none',
          opacity: 0.1 
        }}
        muted 
        playsInline 
      />

      {/* Header */}
      <div className="absolute top-8 w-full text-center z-[10] px-6 pointer-events-none">
        <h1 className="text-3xl font-black tracking-tighter text-white/90 drop-shadow-2xl">
          iPad <span className="text-indigo-500 font-extrabold italic">Camera</span>
        </h1>
        {isPiPActive && (
          <div className="mt-4 animate-bounce">
            <span className="px-6 py-2 bg-indigo-600 text-white rounded-full text-[10px] font-black uppercase tracking-widest shadow-xl">
              หน้าต่างลอยเปิดแล้ว - ปัดหน้าจอขึ้นได้เลย!
            </span>
          </div>
        )}
      </div>

      {/* Settings / Actions */}
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
                className={`flex items-center gap-3 px-10 py-5 rounded-full font-black text-[10px] uppercase tracking-widest shadow-[0_0_40px_rgba(99,102,241,0.4)] transition-all active:scale-95 ${
                  isPiPActive ? 'bg-red-500 text-white' : 'bg-indigo-600 text-white'
                }`}
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
                </svg>
                {isPiPActive ? 'ปิดหน้าต่างลอย' : 'เปิดหน้าต่างลอย'}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Preview Area */}
      <div className="absolute inset-0 flex items-center justify-center p-8 pointer-events-none">
        <div className="pointer-events-auto">
          {!isCameraLoading && !cameraError && (
            <CameraBubble canvasRef={canvasRef} config={cameraConfig} position={pos} onPositionChange={setPos} />
          )}
        </div>
        
        {isCameraLoading && (
          <div className="glass p-16 rounded-[4rem] text-center space-y-6">
            <div className="w-14 h-14 border-4 border-indigo-500/10 border-t-indigo-500 rounded-full animate-spin mx-auto" />
            <p className="text-[10px] font-black text-white/30 uppercase tracking-[0.3em]">กำลังเปิดกล้อง...</p>
          </div>
        )}

        {cameraError && (
          <div className="glass p-12 rounded-[3.5rem] text-center space-y-8 max-w-xs border-red-500/20 shadow-2xl">
            <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center mx-auto">
              <span className="text-4xl">⚠️</span>
            </div>
            <div className="space-y-2">
              <h3 className="text-lg font-black uppercase tracking-tight">ไม่สามารถใช้กล้องได้</h3>
              <p className="text-sm text-white/50 leading-relaxed">{cameraError}</p>
            </div>
            <button 
              onClick={() => window.location.reload()} 
              className="w-full py-5 bg-white text-black rounded-3xl font-black text-[10px] uppercase tracking-widest hover:bg-gray-200 transition-colors"
            >
              โหลดหน้าใหม่
            </button>
          </div>
        )}
      </div>

      {/* Instruction Toast */}
      {!isUIVisible && !isPiPActive && (
        <div className="absolute bottom-12 w-full text-center pointer-events-none animate-bounce">
          <p className="text-[10px] font-black text-white/20 uppercase tracking-[0.5em]">
            ลากวงกลมเพื่อย้าย • กดปุ่มเพื่อลอยหน้าต่าง
          </p>
        </div>
      )}
    </div>
  );
};

export default App;
