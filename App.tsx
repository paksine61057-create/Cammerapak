
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { CameraBubble } from './components/CameraBubble';
import { CameraConfig, Position } from './types';

const STORAGE_KEY = 'presenter_camera_config_v9';

const DEFAULT_CONFIG: CameraConfig = {
  shape: 'rect',
  size: 380,
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
  const [pos, setPos] = useState<Position>({ x: window.innerWidth / 2 - 190, y: window.innerHeight / 2 - 250 });
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
        setCameraError("ไม่สามารถเข้าถึงกล้องได้ กรุณาอนุญาตสิทธิ์การใช้กล้อง");
        setIsCameraLoading(false);
      }
    };
    startCamera();
    return () => stream?.getTracks().forEach(t => t.stop());
  }, []);

  // วาดภาพสดลง Canvas
  const renderFrame = useCallback(() => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video || video.readyState < 2) return;
    
    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    const size = canvas.width;
    ctx.clearRect(0, 0, size, size);
    ctx.save();
    
    // Masking แบบสี่เหลี่ยมมุมมนเล็กน้อย (ดูคลีนที่สุด)
    const radius = 20;
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
    
    ctx.drawImage(video, 0, 0, video.videoWidth, video.videoHeight, 0, 0, size, size);
    ctx.restore();
  }, [cameraConfig.mirrored]);

  useEffect(() => {
    const ticker = setInterval(renderFrame, 1000/30);
    return () => clearInterval(ticker);
  }, [renderFrame]);

  // จัดการสถานะเมื่อโหมดลอยถูกปิดจากตัวหน้าต่างเอง
  useEffect(() => {
    const video = pipVideoRef.current;
    if (!video) return;

    const handleLeavePiP = () => setIsPiPActive(false);
    video.addEventListener('leavepictureinpicture', handleLeavePiP);
    return () => video.removeEventListener('leavepictureinpicture', handleLeavePiP);
  }, []);

  const handlePiPToggle = async () => {
    const video = pipVideoRef.current;
    const canvas = canvasRef.current;
    
    if (!video || !canvas) return;

    if (document.pictureInPictureElement) {
      try {
        await document.exitPictureInPicture();
        setIsPiPActive(false);
      } catch (e) {
        console.error("Exit PiP failed", e);
      }
      return;
    }

    try {
      // ตรวจสอบว่าเบราว์เซอร์รองรับหรือไม่
      if (!document.pictureInPictureEnabled) {
        throw new Error("Browser does not support Picture-in-Picture");
      }

      // ส่งภาพจาก Canvas ไปยัง Video Element สำหรับ PiP
      const stream = canvas.captureStream(30);
      video.srcObject = stream;
      
      await video.play();
      await video.requestPictureInPicture();
      setIsPiPActive(true);
    } catch (e) {
      console.error(e);
      alert("ไม่สามารถเปิดโหมดลอยได้: " + (e instanceof Error ? e.message : "โปรดตรวจสอบการตั้งค่าเบราว์เซอร์"));
    }
  };

  return (
    <div className="relative w-full h-full bg-[#020617] text-white overflow-hidden select-none font-sans">
      {/* องค์ประกอบลับสำหรับระบบ */}
      <video ref={videoRef} style={{ display: 'none' }} muted playsInline />
      <canvas ref={canvasRef} width={640} height={640} className="fixed -top-[2000px] pointer-events-none" />
      <video ref={pipVideoRef} style={{ position: 'fixed', opacity: 0, pointerEvents: 'none', zIndex: -1 }} muted playsInline />

      {/* Main UI */}
      <div className="absolute inset-0 flex flex-col items-center justify-center p-8">
        
        {/* ส่วนแสดงพรีวิว (กดลากได้) */}
        {!isCameraLoading && !cameraError && (
          <div className="mb-12 animate-in fade-in zoom-in duration-500">
            <CameraBubble 
              canvasRef={canvasRef} 
              config={cameraConfig} 
              position={pos} 
              onPositionChange={setPos} 
            />
          </div>
        )}

        {/* ปุ่มควบคุมกลาง */}
        <div className="z-[100] mt-[400px]">
          {!isCameraLoading && !cameraError ? (
            <button 
              onClick={handlePiPToggle} 
              className={`group flex items-center gap-6 px-16 py-8 rounded-full font-black text-xl uppercase tracking-widest shadow-2xl transition-all active:scale-90 border-2 ${
                isPiPActive 
                ? 'bg-zinc-900 border-zinc-700 text-zinc-400' 
                : 'bg-white border-transparent text-black hover:bg-zinc-200 shadow-white/10'
              }`}
            >
              <span className="text-2xl">{isPiPActive ? '⏹' : '📺'}</span>
              {isPiPActive ? 'กำลังแสดงโหมดลอย' : 'เปิดโหมดลอย'}
            </button>
          ) : isCameraLoading ? (
            <div className="flex flex-col items-center gap-4">
              <div className="w-12 h-12 border-4 border-white/10 border-t-white rounded-full animate-spin" />
              <p className="text-[10px] font-bold text-white/30 uppercase tracking-[0.4em]">กำลังทดสอบระบบกล้อง...</p>
            </div>
          ) : (
            <div className="bg-red-500/10 border border-red-500/20 p-6 rounded-3xl text-center max-w-sm">
              <p className="text-red-400 font-bold text-sm mb-2">กล้องขัดข้อง</p>
              <p className="text-xs text-white/50 mb-4">{cameraError}</p>
              <button onClick={() => window.location.reload()} className="text-[10px] font-bold uppercase tracking-widest bg-white/5 px-4 py-2 rounded-full hover:bg-white/10">ลองใหม่</button>
            </div>
          )}
        </div>

        {/* คำแนะนำเล็กๆ */}
        {!isCameraLoading && !cameraError && (
          <p className="absolute bottom-10 text-[9px] font-medium text-white/20 uppercase tracking-[0.5em]">
            ลากย้ายตำแหน่งวิดีโอเพื่อทดสอบความลื่นไหล
          </p>
        )}
      </div>
    </div>
  );
};

export default App;
