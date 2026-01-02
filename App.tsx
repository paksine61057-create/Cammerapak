
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { CameraBubble } from './components/CameraBubble';
import { CameraConfig, Position } from './types';

const DEFAULT_CONFIG: CameraConfig = {
  shape: 'rect',
  size: 340,
  mirrored: true,
  backgroundUrl: null,
  blur: 0,
  videoOpacity: 1.0,
  zoom: 1.0,
  useChromaKey: false,
  chromaKeyColor: { r: 255, g: 255, b: 255 }, 
  threshold: 45,
};

const App: React.FC = () => {
  const [cameraConfig] = useState<CameraConfig>(DEFAULT_CONFIG);
  const [pos, setPos] = useState<Position>({ x: window.innerWidth / 2 - 170, y: window.innerHeight / 2 - 200 });
  const [isPiPActive, setIsPiPActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isCameraLoading, setIsCameraLoading] = useState(true);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pipVideoRef = useRef<HTMLVideoElement>(null);

  // เริ่มต้นกล้อง
  useEffect(() => {
    let stream: MediaStream | null = null;
    const startCamera = async () => {
      setIsCameraLoading(true);
      try {
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
            videoRef.current?.play().catch(e => console.error("Video play error:", e));
            setIsCameraLoading(false);
          };
        }
      } catch (err: any) {
        setCameraError("เข้าถึงกล้องไม่ได้ กรุณาตรวจสอบสิทธิ์การใช้งาน");
        setIsCameraLoading(false);
      }
    };
    startCamera();
    return () => stream?.getTracks().forEach(t => t.stop());
  }, []);

  // วาดภาพสดลง Canvas (ใช้ความละเอียดสูงขึ้นเพื่อความชัดในโหมดลอย)
  const renderFrame = useCallback(() => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video || video.readyState < 2) return;
    
    const ctx = canvas.getContext('2d', { alpha: false }); // ปิด alpha เพื่อประสิทธิภาพ
    if (!ctx) return;

    const size = canvas.width;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, size, size);
    
    ctx.save();
    
    // Masking
    const radius = 30;
    ctx.beginPath();
    ctx.moveTo(radius, 0); ctx.lineTo(size - radius, 0); ctx.quadraticCurveTo(size, 0, size, radius);
    ctx.lineTo(size, size - radius); ctx.quadraticCurveTo(size, size, size - radius, size);
    ctx.lineTo(radius, size); ctx.quadraticCurveTo(0, size, 0, size - radius);
    ctx.lineTo(0, radius); ctx.quadraticCurveTo(0, 0, radius, 0);
    ctx.closePath();
    ctx.clip();

    if (cameraConfig.mirrored) { 
      ctx.translate(size, 0); 
      ctx.scale(-1, 1); 
    }
    
    const videoRatio = video.videoWidth / video.videoHeight;
    let sx, sy, sw, sh;
    if (videoRatio > 1) {
      sh = video.videoHeight; sw = video.videoHeight;
      sx = (video.videoWidth - sw) / 2; sy = 0;
    } else {
      sw = video.videoWidth; sh = video.videoWidth;
      sx = 0; sy = (video.videoHeight - sh) / 2;
    }

    ctx.drawImage(video, sx, sy, sw, sh, 0, 0, size, size);
    ctx.restore();
  }, [cameraConfig.mirrored]);

  useEffect(() => {
    const ticker = setInterval(renderFrame, 1000/30);
    return () => clearInterval(ticker);
  }, [renderFrame]);

  // ติดตามสถานะ PiP
  useEffect(() => {
    const video = pipVideoRef.current;
    if (!video) return;

    const onExit = () => setIsPiPActive(false);
    const onEnter = () => setIsPiPActive(true);

    video.addEventListener('leavepictureinpicture', onExit);
    video.addEventListener('enterpictureinpicture', onEnter);
    return () => {
      video.removeEventListener('leavepictureinpicture', onExit);
      video.removeEventListener('enterpictureinpicture', onEnter);
    };
  }, []);

  const handlePiPToggle = async () => {
    const pipVideo = pipVideoRef.current;
    const canvas = canvasRef.current;
    
    if (!pipVideo || !canvas) return;

    if (document.pictureInPictureElement) {
      try {
        await document.exitPictureInPicture();
        return;
      } catch (e) { console.error(e); }
    }

    try {
      if (!document.pictureInPictureEnabled) {
        alert("เบราว์เซอร์ของคุณไม่รองรับโหมดหน้าต่างลอย");
        return;
      }

      // ดึง Stream จาก Canvas
      const stream = canvas.captureStream(30);
      pipVideo.srcObject = stream;
      
      // ต้องเล่นวิดีโอก่อนเสมอ
      await pipVideo.play();
      await pipVideo.requestPictureInPicture();
      
    } catch (e) {
      console.error("PiP Error:", e);
      alert("ไม่สามารถเริ่มโหมดลอยได้: " + (e instanceof Error ? e.message : "โปรดลองใหม่อีกครั้ง"));
    }
  };

  return (
    <div className="relative w-full h-full bg-[#020617] text-white overflow-hidden select-none font-sans flex flex-col items-center justify-center">
      {/* ระบบหลังบ้าน */}
      <video ref={videoRef} style={{ display: 'none' }} muted playsInline />
      <canvas ref={canvasRef} width={640} height={640} className="fixed -top-[3000px] pointer-events-none" />
      <video 
        ref={pipVideoRef} 
        muted 
        playsInline 
        style={{ position: 'fixed', width: '1px', height: '1px', opacity: 0, pointerEvents: 'none' }} 
      />

      <div className="max-w-lg w-full px-8 flex flex-col items-center text-center">
        {/* Preview Bubble */}
        {!isCameraLoading && !cameraError && (
          <div className={`mb-12 transition-all duration-700 ${isPiPActive ? 'opacity-20 scale-90 blur-sm' : 'opacity-100 scale-100'}`}>
            <CameraBubble 
              canvasRef={canvasRef} 
              config={cameraConfig} 
              position={pos} 
              onPositionChange={setPos} 
            />
          </div>
        )}

        {/* UI Controls */}
        <div className="space-y-8 w-full">
          {!isCameraLoading && !cameraError ? (
            <div className="flex flex-col items-center gap-10">
              <button 
                onClick={handlePiPToggle} 
                className={`group relative overflow-hidden flex items-center gap-6 px-12 py-7 rounded-[2.5rem] font-black text-lg uppercase tracking-widest transition-all active:scale-90 ${
                  isPiPActive 
                  ? 'bg-zinc-800 text-zinc-500 cursor-default' 
                  : 'bg-white text-black hover:bg-zinc-200 shadow-[0_20px_50px_rgba(255,255,255,0.1)]'
                }`}
              >
                <span className="text-2xl">{isPiPActive ? '✓' : '📺'}</span>
                {isPiPActive ? 'กำลังลอยหน้าต่างอยู่' : 'เปิดโหมดหน้าต่างลอย'}
              </button>

              {isPiPActive && (
                <div className="animate-in fade-in slide-in-from-bottom-4 duration-1000">
                  <p className="text-white font-bold text-lg mb-2">สำเร็จ! กล้องกำลังลอยอยู่</p>
                  <p className="text-white/40 text-xs max-w-[280px] leading-relaxed mx-auto uppercase tracking-wider">
                    คุณสามารถพับหน้าต่างเบราว์เซอร์นี้ลง <br/>
                    และไปใช้งานแอปอื่นได้ทันที
                  </p>
                </div>
              )}
            </div>
          ) : isCameraLoading ? (
            <div className="space-y-4">
              <div className="w-10 h-10 border-2 border-white/10 border-t-white rounded-full animate-spin mx-auto" />
              <p className="text-[10px] font-bold text-white/20 uppercase tracking-[0.4em]">เตรียมสัญญาณวิดีโอ...</p>
            </div>
          ) : (
            <div className="bg-red-500/10 p-8 rounded-3xl border border-red-500/20">
              <p className="text-red-400 font-bold mb-4">{cameraError}</p>
              <button onClick={() => window.location.reload()} className="bg-white/10 px-8 py-3 rounded-full text-[10px] font-black uppercase tracking-widest hover:bg-white/20">ลองเชื่อมใหม่</button>
            </div>
          )}
        </div>
      </div>

      {!isPiPActive && !isCameraLoading && !cameraError && (
        <div className="absolute bottom-10 text-[9px] font-bold text-white/10 uppercase tracking-[0.6em] animate-pulse">
          Click the button above to start floating mode
        </div>
      )}
    </div>
  );
};

export default App;
