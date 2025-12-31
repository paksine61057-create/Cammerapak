
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
    const pc = document.createElement('canvas');
    pc.width = 400;
    pc.height = 400;
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
          throw new Error("เบราว์เซอร์ไม่รองรับการเข้าถึงกล้อง");
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
            videoRef.current?.play().catch(e => console.error(e));
            setIsCameraLoading(false);
          };
        }
      } catch (err: any) {
        setCameraError("ไม่สามารถเข้าถึงกล้องได้: " + (err.message || "Unknown Error"));
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
      
      // Clear and draw background
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

  const togglePiP = async () => {
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
        setIsPiPActive(false);
      } else if (pipVideoRef.current && canvasRef.current) {
        pipVideoRef.current.srcObject = canvasRef.current.captureStream(30);
        await pipVideoRef.current.requestPictureInPicture();
        setIsPiPActive(true);
      }
    } catch (e) { console.error(e); }
  };

  return (
    <div className="relative w-full h-full bg-[#020617] text-white overflow-hidden select-none">
      {/* Hidden elements for processing */}
      <video ref={videoRef} className="hidden" muted playsInline />
      <canvas ref={canvasRef} width={512} height={512} className="hidden" />
      <video ref={pipVideoRef} className="hidden" muted playsInline />

      {/* Header UI - Always Visible */}
      <div className="absolute top-12 w-full text-center z-[20] px-6 pointer-events-none">
        <h1 className="text-4xl font-black tracking-tight text-white drop-shadow-lg">
          Camera <span className="text-indigo-500">Zoomer</span>
        </h1>
        <p className="text-white/40 text-[10px] uppercase tracking-[0.3em] mt-2">Professional Presenter Tool</p>
      </div>

      {/* Status Notifications */}
      {(isCameraLoading || cameraError) && (
        <div className="absolute inset-0 flex items-center justify-center z-[30] bg-[#020617]/40 pointer-events-none">
          <div className="glass p-8 rounded-[2.5rem] text-center space-y-4 max-w-xs pointer-events-auto">
            {isCameraLoading ? (
              <div className="w-12 h-12 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin mx-auto" />
            ) : (
              <div className="text-red-400 text-sm font-bold">{cameraError}</div>
            )}
            <p className="text-xs text-white/60">
              {isCameraLoading ? "กำลังเปิดใช้งานกล้อง..." : "กรุณาให้สิทธิ์เข้าถึงกล้องแล้วรีโหลด"}
            </p>
            {cameraError && (
              <button onClick={() => window.location.reload()} className="px-6 py-2 bg-white text-black rounded-full font-bold text-xs">RETRY</button>
            )}
          </div>
        </div>
      )}

      {/* Camera Bubble Preview */}
      {!isPiPActive && !isCameraLoading && (
        <CameraBubble 
          canvasRef={canvasRef} 
          config={cameraConfig} 
          position={pos}
          onPositionChange={setPos}
        />
      )}

      {/* Controls UI */}
      <div className="absolute inset-x-0 bottom-0 z-[100] flex justify-center pb-10 pointer-events-none">
        {isUIVisible ? (
          <div className="pointer-events-auto w-full max-w-md px-4">
            <ControlPanel 
              config={cameraConfig}
              onConfigChange={setCameraConfig}
              onHideUI={() => setIsUIVisible(false)}
            />
          </div>
        ) : (
          <div className="flex gap-4 pointer-events-auto">
             <button 
              onClick={() => setIsUIVisible(true)}
              className="px-8 py-4 glass rounded-full text-[10px] font-black tracking-widest text-white/70 hover:text-white transition-all shadow-xl border border-white/10 uppercase"
            >
              Open Settings
            </button>
            {!isPiPActive && !cameraError && (
              <button 
                onClick={togglePiP}
                className="w-12 h-12 glass rounded-full flex items-center justify-center text-indigo-400 hover:text-indigo-300 shadow-xl"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
                </svg>
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default App;
