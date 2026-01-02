
import React, { useRef, useState, useEffect } from 'react';
import { CameraConfig, Position } from '../types';

interface CameraBubbleProps {
  canvasRef: React.RefObject<HTMLCanvasElement>;
  config: CameraConfig;
  position: Position;
  onPositionChange: (pos: Position) => void;
}

export const CameraBubble: React.FC<CameraBubbleProps> = ({ 
  canvasRef, 
  config, 
  position, 
  onPositionChange 
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);

  const handlePointerDown = (e: React.PointerEvent) => {
    setIsDragging(true);
    setDragOffset({
      x: e.clientX - position.x,
      y: e.clientY - position.y
    });
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging) return;
    const newX = e.clientX - dragOffset.x;
    const newY = e.clientY - dragOffset.y;
    onPositionChange({ x: newX, y: newY });
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    setIsDragging(false);
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);
  };

  useEffect(() => {
    const mainCanvas = canvasRef.current;
    const previewCanvas = previewCanvasRef.current;
    if (!mainCanvas || !previewCanvas) return;

    const ctx = previewCanvas.getContext('2d');
    if (!ctx) return;

    let animationId: number;
    const sync = () => {
      ctx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
      ctx.drawImage(mainCanvas, 0, 0, previewCanvas.width, previewCanvas.height);
      animationId = requestAnimationFrame(sync);
    };
    sync();
    return () => cancelAnimationFrame(animationId);
  }, [canvasRef]);

  return (
    <div
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      style={{
        width: `${config.size}px`,
        height: `${config.size}px`,
        cursor: isDragging ? 'grabbing' : 'grab',
        touchAction: 'none',
      }}
      className={`relative overflow-hidden shadow-[0_40px_100px_rgba(0,0,0,0.6)] border-2 border-white/10 rounded-[2.5rem] transition-transform duration-200 ${isDragging ? 'scale-95 opacity-80' : 'scale-100'}`}
    >
      <canvas
        ref={previewCanvasRef}
        width={512}
        height={512}
        className="w-full h-full object-cover pointer-events-none bg-zinc-900"
      />
    </div>
  );
};
