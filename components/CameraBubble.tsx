
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
    
    const padding = 20;
    const boundedX = Math.max(padding, Math.min(newX, window.innerWidth - config.size - padding));
    const boundedY = Math.max(padding, Math.min(newY, window.innerHeight - config.size - padding));
    
    onPositionChange({ x: boundedX, y: boundedY });
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
        left: `${position.x}px`,
        top: `${position.y}px`,
        width: `${config.size}px`,
        height: `${config.size}px`,
        cursor: isDragging ? 'grabbing' : 'grab',
        zIndex: 50,
        touchAction: 'none',
      }}
      className={`absolute overflow-hidden shadow-2xl transition-transform duration-75 border border-white/10 ${
        config.shape === 'circle' ? 'rounded-full' : 'rounded-3xl'
      } ${isDragging ? 'scale-105' : 'scale-100'}`}
    >
      <canvas
        ref={previewCanvasRef}
        width={512}
        height={512}
        className="w-full h-full object-cover pointer-events-none bg-black"
      />
    </div>
  );
};
