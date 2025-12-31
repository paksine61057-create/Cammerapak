
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
  const [pos, setPos] = useState<Position>({ x: 40, y: 150 }); // Adjust initial position to not be at the very top
  const [isPiPActive, setIsPiPActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isCameraLoading, setIsCameraLoading] = useState(true);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const processingCanvasRef = useRef<HTMLCanvasElement>(null);
  const pipVideoRef = useRef<HTMLVideoElement>(null);
  const bgImageRef = useRef<HTMLImageElement | null>(null);

  // Initialize processing canvas
  useEffect(() => {
    const pc = document.createElement('canvas');
    pc.width = 512;
    pc.height = 512;
    processingCanvasRef.current = pc;
  }, []);

  // Background Loader
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
        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error("iPad/Browser ของคุณไม่รองรับโหมดนี้");
        }

        stream = await navigator.mediaDevices.getUserMedia({ 
          video: { 
            facingMode: "user", 
            width: { ideal: 1280 }, 
            height: { ideal: 720 } 
          }
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

  // Main Render Loop for Custom Effects
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
      
      // Draw Background
      ctx.fillStyle = '#020617';
      ctx.fillRect(0, 0, size, size);

      if (bgImageRef.current) {
        ctx.drawImage(bgImageRef.current, 0, 0, size, size);
      }

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

      animationId = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(animationId);
  }, []);

  // PiP Activation Logic
  const togglePiP = async () => {
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
        setIsPiPActive(false);
      } else if (pipVideoRef.current && canvasRef.current) {
        const stream = canvasRef.current.captureStream(30);
        pipVideoRef.current.srcObject = stream;
        
        pipVideoRef.current.onloadedmetadata = async () => {
          try {
            await pipVideoRef.current?.requestPictureInPicture();
            setIsPiPActive(true);
          } catch (e) {
            alert("iPad ของคุณต้องการให้กดปุ่ม 'Play' บนหน้าต่างวิดีโอก่อนเข้าโหมด PiP");
          }
        };
      }
    } catch (e) {
      console.error("PiP Failed:", e);
      alert("ไม่สามารถเปิดโหมดลอยตัวได้ กรุณาลองใหม่อีกครั้ง");
    }
  };

  // Auto-exit PiP state listener
  useEffect(() => {
    const handleExitPiP = () => setIsPiPActive(false);
    const video = pipVideoRef.current;
    video?.addEventListener('leavepictureinpicture', handleExitPiP);
    return () => video?.removeEventListener('leavepictureinpicture', handleExitPiP);
  }, []);

  return (
    <div className="relative w-full h-full bg-[#020617] text-white overflow-hidden select-none font-sans">
      <video ref={videoRef} className="hidden" muted playsInline />
      <canvas ref={canvasRef} width={512} height={512} className="hidden" />
      <video ref={pipVideoRef} style={{ display: 'none' }} muted playsInline autoPlay />

      {/* Hero Header - Positioned at the very top */}
      <div className="absolute top-6 w-full text-center z-[10] px-6 pointer-events-none">
        <h1 className="text-3xl font-black tracking-tighter text-white/90 drop-shadow-2xl">
          iPad <span className="text-indigo-500">Presenter</span>
        </h1>
      </div>

      {/* Toolbar / Settings - MOVED TO THE TOP (top-20) */}
      <div className="absolute inset-x-0 top-20 z-[100] flex flex-col items-center pointer-events-none">
        {isUIVisible ? (
          <div className="pointer-events-auto w-full max-w-md px-4">
            <ControlPanel 
              config={cameraConfig}
              onConfigChange={setCameraConfig}
              onHideUI={() => setIsUIVisible(false)}
            />
          </div>
        ) : (
          <div className="flex gap-4 pointer-events-auto items-center">
            <button 
              onClick={() => setIsUIVisible(true)}
              className="px-8 py-4 glass rounded-full text-xs font-black tracking-widest text-white/80 hover:text-white transition-all shadow-2xl border border-white/20 uppercase"
            >
              ตั้งค่ากล้อง
            </button>
            
            {!cameraError && !isCameraLoading && (
              <button 
                onClick={togglePiP}
                className={`flex items-center gap-3 px-6 py-4 rounded-full font-black text-xs uppercase tracking-widest shadow-2xl transition-all active:scale-95 ${
                  isPiPActive ? 'bg-red-500 text-white' : 'bg-indigo-600 text-white'
                }`}
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
                </svg>
                {isPiPActive ? 'ปิดหน้าต่างลอย' : 'เปิดหน้าต่างลอย'}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Main Action Area */}
      <div className="absolute inset-0 flex flex-col items-center justify-center p-8">
        {!isPiPActive && !isCameraLoading && !cameraError && (
          <CameraBubble 
            canvasRef={canvasRef} 
            config={cameraConfig} 
            position={pos}
            onPositionChange={setPos}
          />
        )}

        {(isCameraLoading || cameraError) && (
          <div className="glass p-10 rounded-[3rem] text-center space-y-6 max-w-sm border-white/10 shadow-2xl">
            {isCameraLoading ? (
              <div className="w-16 h-16 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin mx-auto" />
            ) : (
              <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto">
                <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
            )}
            <div>
              <h2 className="text-xl font-bold mb-2">{isCameraLoading ? "กำลังเริ่มต้น..." : "มีข้อผิดพลาด"}</h2>
              <p className="text-sm text-white/50">{cameraError || "กำลังขอสิทธิ์เข้าถึงกล้องหน้า iPad ของคุณ"}</p>
            </div>
            {cameraError && (
              <button onClick={() => window.location.reload()} className="w-full py-4 bg-white text-black rounded-3xl font-black text-sm uppercase tracking-widest">ลองใหม่อีกครั้ง</button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default App;
