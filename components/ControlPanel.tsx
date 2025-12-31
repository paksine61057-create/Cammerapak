
import React, { useRef } from 'react';
import { CameraConfig } from '../types';

interface ControlPanelProps {
  config: CameraConfig;
  onConfigChange: (config: CameraConfig) => void;
  onHideUI: () => void;
}

export const ControlPanel: React.FC<ControlPanelProps> = ({
  config,
  onConfigChange,
  onHideUI
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const presets = [
    { name: 'None', url: null },
    { name: 'Modern', url: 'https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&q=80&w=400' },
    { name: 'Studio', url: 'https://images.unsplash.com/photo-1524758631624-e2822e304c36?auto=format&fit=crop&q=80&w=400' },
    { name: 'Abstract', url: 'https://images.unsplash.com/photo-1557683316-973673baf926?auto=format&fit=crop&q=80&w=400' },
  ];

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      onConfigChange({ ...config, backgroundUrl: url });
    }
  };

  // ตรวจสอบว่า URL ปัจจุบันคือ preset หรือไม่
  const isCustomUrl = config.backgroundUrl && !presets.some(p => p.url === config.backgroundUrl);

  return (
    <div className="z-[100] w-full animate-in slide-in-from-top-10">
      <div className="glass p-7 rounded-[2.5rem] shadow-2xl space-y-6 border-white/5 overflow-y-auto max-h-[75vh] scrollbar-hide">
        
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-white/30 uppercase tracking-widest">ขนาดกรอบ (Size)</label>
            <input 
              type="range" min="120" max="450" value={config.size}
              onChange={(e) => onConfigChange({ ...config, size: parseInt(e.target.value) })}
              className="w-full h-1.5 bg-white/10 rounded-lg appearance-none accent-indigo-500"
            />
          </div>
          <div className="flex bg-white/5 p-1 rounded-2xl self-end h-10">
            <button 
              onClick={() => onConfigChange({ ...config, shape: 'circle' })}
              className={`flex-1 text-[9px] font-black rounded-xl transition-all ${config.shape === 'circle' ? 'bg-indigo-600 text-white shadow-lg' : 'text-white/40'}`}
            >
              CIRCLE
            </button>
            <button 
              onClick={() => onConfigChange({ ...config, shape: 'rect' })}
              className={`flex-1 text-[9px] font-black rounded-xl transition-all ${config.shape === 'rect' ? 'bg-indigo-600 text-white shadow-lg' : 'text-white/40'}`}
            >
              SQUARE
            </button>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <label className="text-[10px] font-black text-white/30 uppercase tracking-widest block">ภาพพื้นหลัง (Background)</label>
            <button 
              onClick={() => fileInputRef.current?.click()}
              className="text-[9px] font-black text-indigo-400 uppercase tracking-wider hover:text-indigo-300 transition-colors"
            >
              + อัปโหลดภาพเอง
            </button>
            <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept="image/*" className="hidden" />
          </div>
          
          <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
            {/* รายการภาพที่ผู้ใช้อัปโหลดเอง (ถ้ามี) */}
            {isCustomUrl && (
              <button
                onClick={() => onConfigChange({ ...config, backgroundUrl: config.backgroundUrl })}
                className="group relative flex-shrink-0 w-16 h-16 rounded-2xl bg-white/5 overflow-hidden border-2 border-indigo-500 scale-105 shadow-[0_0_20px_rgba(99,102,241,0.3)] transition-all"
              >
                <img src={config.backgroundUrl!} alt="Custom" className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                  <span className="text-[8px] font-black text-white uppercase">Custom</span>
                </div>
              </button>
            )}

            {presets.map((bg) => (
              <button
                key={bg.name}
                onClick={() => onConfigChange({ ...config, backgroundUrl: bg.url })}
                className={`group relative flex-shrink-0 w-16 h-16 rounded-2xl bg-white/5 overflow-hidden border-2 transition-all ${
                  config.backgroundUrl === bg.url ? 'border-indigo-500 scale-105 shadow-[0_0_20px_rgba(99,102,241,0.3)]' : 'border-transparent opacity-60'
                }`}
              >
                {bg.url ? (
                  <img src={bg.url} alt={bg.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-[8px] font-bold text-white/40 italic">None</div>
                )}
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                  <span className="text-[8px] font-black">{bg.name}</span>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="bg-white/5 p-5 rounded-[2rem] space-y-5 border border-white/5">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-[10px] font-black text-white/80 uppercase tracking-widest block">Chroma Key</span>
              <span className="text-[8px] text-white/30 font-bold uppercase block">ตัดพื้นหลังคนออก</span>
            </div>
            <button 
              onClick={() => onConfigChange({ ...config, useChromaKey: !config.useChromaKey })}
              className={`w-14 h-7 rounded-full transition-all relative ${config.useChromaKey ? 'bg-green-500 shadow-[0_0_15px_rgba(34,197,94,0.4)]' : 'bg-white/10'}`}
            >
              <div className={`absolute top-1 w-5 h-5 rounded-full bg-white transition-all shadow-md ${config.useChromaKey ? 'right-1' : 'left-1'}`} />
            </button>
          </div>

          <div className="space-y-3">
            <div className="flex justify-between items-center text-[10px] font-black text-white/30 uppercase tracking-widest">
              <span>ขยายภาพ (Zoom)</span>
              <span className="text-indigo-400 font-black">{config.zoom.toFixed(1)}x</span>
            </div>
            <input 
              type="range" min="1.0" max="2.5" step="0.1" value={config.zoom}
              onChange={(e) => onConfigChange({ ...config, zoom: parseFloat(e.target.value) })}
              className="w-full h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-indigo-500"
            />
          </div>
        </div>

        <button
          onClick={onHideUI}
          className="w-full py-5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl text-[10px] font-black transition-all shadow-xl uppercase tracking-[0.2em]"
        >
          ตกลงและบันทึก
        </button>
      </div>
    </div>
  );
};
