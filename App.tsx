
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
  const [isPreparingPiP, setIsPreparingPiP] = useState(false);
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

  const preparePiP = () => {
    const v = pipVideoRef.current;
    if (!v) return;

    // Toggle PiP off if active
    const isCurrentlyPiP = document.pictureInPictureElement || (v as any).webkitPresentationMode === 'picture-in-picture';
    if (isCurrentlyPiP) {
      if (document.exitPictureInPicture) {
        document.exitPictureInPicture();
      } else if ((v as any).webkitSetPresentationMode) {
        (v as any).webkitSetPresentationMode('inline');
      }
      setIsPiPActive(false);
      return;
    }

    if (canvasRef.current) {
      setIsPreparingPiP(true);
    }
  };

  const startPiP = async () => {
    const video = pipVideoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    try {
      // 1. สร้าง Stream และผูกกับ Video ทันทีที่กด
      const stream = canvas.captureStream(30);
      video.srcObject = stream;
      
      // 2. เริ่มเล่น และรอเล็กน้อยให้ Buffer พร้อม
      await video.play();
      await new Promise(r => setTimeout(r, 600));

      // 3. เรียกใช้ API ตามลำดับความสำคัญสำหรับ iPad
      if (video.requestPictureInPicture) {
        await video.requestPictureInPicture();
        setIsPiPActive(true);
      } else if ((video as any).webkitSupportsPresentationMode && (video as any).webkitSupportsPresentationMode('picture-in-picture')) {
        (video as any).webkitSetPresentationMode('picture-in-picture');
        setIsPiPActive(true);
      } else {
        throw new Error("iPad ของคุณต้องการ Safari เพื่อใช้งานโหมดนี้");
      }

      setIsPreparingPiP(false);
    } catch (e: any) {
      console.error("PiP Activation Failed:", e);
      alert("ไม่สามารถเปิดโหมดลอยได้: " + (e.message || "เบราว์เซอร์ของคุณบล็อกการทำงานนี้"));
      setIsPreparingPiP(false);
    }
  };

  useEffect(() => {
    const video = pipVideoRef.current;
    const handleExit = () => setIsPiPActive(false);
    
    video?.addEventListener('leavepictureinpicture', handleExit);
    video?.addEventListener('webkitpresentationmodechanged', () => {
      if ((video as any).webkitPresentationMode === 'inline') setIsPiPActive(false);
      if ((video as any).webkitPresentationMode === 'picture-in-picture') setIsPiPActive(true);
    });

    return () => {
      video?.removeEventListener('leavepictureinpicture', handleExit);
    };
  }, []);

  return (
    <div className="relative w-full h-full bg-[#020617] text-white overflow-hidden select-none font-sans">
      <video ref={videoRef} className="hidden" muted playsInline />
      <canvas ref={canvasRef} width={512} height={512} className="hidden" />
      
      {/* วิดีโอต้นฉบับสำหรับ PiP ต้องมีขนาดที่มองเห็นได้จริงเพื่อให้ iPad ยอมรับ */}
      <video 
        ref={pipVideoRef} 
        style={{ width: '100px', height: '100px', opacity: 0.01, pointerEvents: 'none', position: 'fixed', bottom: 0, right: 0, zIndex: -1 }}
        muted 
        playsInline 
        autoPlay
      />

      {/* PiP Confirm Overlay */}
      {isPreparingPiP && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/95 backdrop-blur-2xl animate-in fade-in duration-300">
          <div className="text-center space-y-12 p-8 max-w-sm">
            <div className="relative">
              <div className="absolute inset-0 bg-indigo-500/30 blur-[100px] rounded-full animate-pulse scale-150" />
              <button 
                onClick={startPiP}
                className="relative w-32 h-32 bg-white text-black rounded-full flex items-center justify-center shadow-2xl active:scale-90 transition-all"
              >
                <svg className="w-16 h-16 ml-2" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" />
                </svg>
              </button>
            </div>
            
            <div className="space-y-6">
              <h2 className="text-3xl font-black tracking-tight">ยืนยันการเปิด</h2>
              <div className="bg-white/5 border border-white/10 p-6 rounded-[2.5rem] text-left space-y-4">
                <p className="text-white/70 text-sm leading-relaxed">
                  1. แตะปุ่ม <span className="text-indigo-400 font-bold">Play</span> ด้านบน<br/>
                  2. เมื่อหน้าต่างลอยปรากฏ ให้ <span className="text-white font-bold">ปัดแอปนี้ออก</span> เพื่อเริ่มการนำเสนอ
                </p>
                <div className="p-3 bg-indigo-500/10 rounded-2xl border border-indigo-500/20 text-[10px] text-indigo-300 font-bold uppercase tracking-wider text-center">
                  แนะนำให้ใช้บน Safari (iPad)
                </div>
              </div>
            </div>

            <button onClick={() => setIsPreparingPiP(false)} className="text-[10px] font-black text-white/30 uppercase tracking-[0.4em]">ยกเลิก</button>
          </div>
        </div>
      )}

      {/* UI Elements */}
      <div className="absolute top-8 w-full text-center z-[10] px-6 pointer-events-none">
        <h1 className="text-3xl font-black tracking-tighter text-white/90">
          iPad <span className="text-indigo-500">Presenter</span>
        </h1>
        {isPiPActive && (
          <div className="mt-3 inline-block px-4 py-1.5 bg-green-500 text-black text-[10px] font-black rounded-full uppercase tracking-widest shadow-xl">
            Floating Mode Active
          </div>
        )}
      </div>

      <div className="absolute inset-x-0 top-24 z-[100] flex flex-col items-center pointer-events-none">
        {isUIVisible ? (
          <div className="pointer-events-auto w-full max-w-md px-4">
            <ControlPanel config={cameraConfig} onConfigChange={setCameraConfig} onHideUI={() => setIsUIVisible(false)} />
          </div>
        ) : (
          <div className="flex gap-4 pointer-events-auto items-center p-4">
            <button onClick={() => setIsUIVisible(true)} className="px-8 py-4 glass rounded-full text-[10px] font-black tracking-widest uppercase border border-white/10">ตั้งค่า</button>
            {!cameraError && !isCameraLoading && (
              <button 
                onClick={preparePiP}
                className={`flex items-center gap-3 px-8 py-4 rounded-full font-black text-[10px] uppercase tracking-widest shadow-2xl transition-all ${isPiPActive ? 'bg-red-500' : 'bg-indigo-600'}`}
              >
                {isPiPActive ? 'ปิดหน้าต่าง' : 'เปิดหน้าต่างลอย'}
              </button>
            )}
          </div>
        )}
      </div>

      <div className="absolute inset-0 flex items-center justify-center p-8 pointer-events-none">
        <div className="pointer-events-auto">
          {!isCameraLoading && !cameraError && !isPreparingPiP && (
            <CameraBubble canvasRef={canvasRef} config={cameraConfig} position={pos} onPositionChange={setPos} />
          )}
        </div>
        
        {isCameraLoading && (
          <div className="glass p-12 rounded-[3rem] text-center space-y-4">
            <div className="w-12 h-12 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin mx-auto" />
            <p className="text-xs font-bold text-white/40 uppercase tracking-widest">Starting Camera...</p>
          </div>
        )}

        {cameraError && (
          <div className="glass p-10 rounded-[3rem] text-center space-y-6 max-w-xs border-red-500/20">
            <div className="text-red-500 text-4xl">⚠️</div>
            <p className="text-sm font-bold">{cameraError}</p>
            <button onClick={() => window.location.reload()} className="w-full py-4 bg-white text-black rounded-2xl font-black text-xs">TRY AGAIN</button>
          </div>
        )}
      </div>
    </div>
  );
};

export default App;
