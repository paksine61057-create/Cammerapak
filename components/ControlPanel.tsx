
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
    { name: 'Red Festive', url: 'https://images.unsplash.com/photo-1543589077-47d81606c1ad?auto=format&fit=crop&q=80&w=800' },
    { name: 'Gold Studio', url: 'https://images.unsplash.com/photo-1512389142860-9c449e58a543?auto=format&fit=crop&q=80&w=800' },
    { name: 'Office', url: 'https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&q=80&w=800' },
  ];

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const result = event.target?.result as string;
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const maxDim = 1200;
          let w = img.width, h = img.height;
          if (w > h) { if (w > maxDim) { h *= maxDim / w; w = maxDim; } }
          else { if (h > maxDim) { w *= maxDim / h; h = maxDim; } }
          canvas.width = w; canvas.height = h;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, w, h);
          onConfigChange({ ...config, backgroundUrl: canvas.toDataURL('image/jpeg', 0.9) });
        };
        img.src = result;
      };
      reader.readAsDataURL(file);
    }
  };

  const isCustom = config.backgroundUrl && config.backgroundUrl.startsWith('data:');

  return (
    <div className="z-[100] w-full animate-in zoom-in-95 slide-in-from-top-10 duration-500">
      <div className="glass p-8 rounded-[3rem] shadow-[0_40px_100px_rgba(0,0,0,0.8)] space-y-8 border-white/10 overflow-y-auto max-h-[85vh] scrollbar-hide">
        
        <header className="flex justify-between items-center border-b border-white/5 pb-4">
          <div className="flex flex-col">
            <h2 className="text-xs font-black text-white uppercase tracking-[0.4em]">Settings Panel</h2>
            <span className="text-[9px] font-bold text-red-500/80 uppercase">Pure Person Overlay</span>
          </div>
          <span className="text-[9px] font-bold text-red-500/50 uppercase bg-red-500/10 px-3 py-1 rounded-full">Transparent Ready</span>
        </header>

        {/* Frame Settings */}
        <section className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-3 bg-white/5 p-4 rounded-3xl">
              <label className="text-[10px] font-black text-white/30 uppercase tracking-widest block">ขนาดวงกลม</label>
              <input 
                type="range" min="180" max="500" value={config.size}
                onChange={(e) => onConfigChange({ ...config, size: parseInt(e.target.value) })}
                className="w-full h-1.5 bg-white/10 rounded-lg appearance-none accent-red-600"
              />
            </div>
            <div className="flex bg-white/5 p-2 rounded-3xl self-stretch h-full">
              <button 
                onClick={() => onConfigChange({ ...config, shape: 'circle' })}
                className={`flex-1 text-[10px] font-black rounded-2xl transition-all ${config.shape === 'circle' ? 'bg-red-600 text-white shadow-lg' : 'text-white/30'}`}
              >
                วงกลม
              </button>
              <button 
                onClick={() => onConfigChange({ ...config, shape: 'rect' })}
                className={`flex-1 text-[10px] font-black rounded-2xl transition-all ${config.shape === 'rect' ? 'bg-red-600 text-white shadow-lg' : 'text-white/30'}`}
              >
                สี่เหลี่ยม
              </button>
            </div>
          </div>
        </section>

        {/* Background Selection */}
        <section className="space-y-6 bg-white/5 p-6 rounded-[2.5rem] border border-white/5">
          <div className="flex justify-between items-center mb-2">
            <div className="flex flex-col">
              <span className="text-[10px] font-black text-white uppercase tracking-widest">ชั้นพื้นหลัง (Virtual Background)</span>
              <span className="text-[8px] text-white/30 uppercase">เลือก "ปิด" เพื่อให้ฉากหลังโปร่งใส</span>
            </div>
            <button 
              onClick={() => fileInputRef.current?.click()}
              className="px-4 py-2 bg-white/10 text-white text-[9px] font-black rounded-full hover:bg-white/20 transition-colors uppercase tracking-widest"
            >
              + อัปโหลดรูป
            </button>
            <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept="image/*" className="hidden" />
          </div>
          
          <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide">
            {/* Option: Transparent / None */}
            <button
              onClick={() => onConfigChange({ ...config, backgroundUrl: null, blur: 0 })}
              className={`flex-shrink-0 w-20 h-20 rounded-2xl bg-black/40 flex flex-col items-center justify-center border-2 transition-all ${
                config.backgroundUrl === null ? 'border-red-500 scale-105 shadow-2xl bg-red-600/10' : 'border-white/10 opacity-60'
              }`}
            >
              <div className="w-8 h-8 border-2 border-dashed border-white/20 rounded-full mb-1 flex items-center justify-center">
                <span className="text-white/40 text-[14px]">∅</span>
              </div>
              <span className="text-[8px] font-black uppercase text-white/60">ไม่มี (ใส)</span>
            </button>

            {isCustom && (
              <div className="flex-shrink-0 relative w-20 h-20 rounded-2xl border-2 border-red-500 scale-105 overflow-hidden shadow-2xl">
                <img src={config.backgroundUrl!} className="w-full h-full object-cover" alt="Custom" />
                <div className="absolute inset-0 bg-red-600/40 flex items-end p-1">
                  <span className="text-[6px] font-black text-white uppercase w-full text-center bg-red-600 py-0.5 rounded">ใช้งานอยู่</span>
                </div>
              </div>
            )}
            {presets.map((bg) => (
              <button
                key={bg.name}
                onClick={() => onConfigChange({ ...config, backgroundUrl: bg.url })}
                className={`flex-shrink-0 w-20 h-20 rounded-2xl bg-white/5 overflow-hidden border-2 transition-all ${
                  config.backgroundUrl === bg.url ? 'border-red-500 scale-105 shadow-2xl' : 'border-transparent opacity-50 hover:opacity-100'
                }`}
              >
                <img src={bg.url} className="w-full h-full object-cover" alt={bg.name} />
              </button>
            ))}
          </div>

          {config.backgroundUrl && (
            <div className="space-y-3 pt-2 animate-in fade-in duration-300">
              <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest">
                <span className="text-white/60">ความเบลอพื้นหลัง</span>
                <span className="text-red-500">{config.blur}px</span>
              </div>
              <input 
                type="range" min="0" max="25" step="1" value={config.blur}
                onChange={(e) => onConfigChange({ ...config, blur: parseInt(e.target.value) })}
                className="w-full h-1.5 bg-white/10 rounded-lg appearance-none accent-red-600"
              />
            </div>
          )}
        </section>

        {/* Person Settings */}
        <section className="space-y-6 bg-red-600/5 p-6 rounded-[2.5rem] border border-red-500/10 shadow-inner">
          <div className="flex items-center justify-between">
            <div className="flex flex-col">
              <span className="text-[10px] font-black text-red-500 uppercase tracking-widest">ตัวคน (Person Overlay)</span>
              <span className="text-[8px] text-red-500/40 uppercase">ตัดขอบสีพื้นหลังห้องคุณออก</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-[9px] font-black text-white/40 uppercase">ตัดฉากหลัง</span>
              <button 
                onClick={() => onConfigChange({ ...config, useChromaKey: !config.useChromaKey })}
                className={`w-14 h-7 rounded-full transition-all relative ${config.useChromaKey ? 'bg-green-500 shadow-[0_0_20px_rgba(34,197,94,0.4)]' : 'bg-white/10'}`}
              >
                <div className={`absolute top-1 w-5 h-5 rounded-full bg-white transition-all shadow-md ${config.useChromaKey ? 'right-1' : 'left-1'}`} />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-3">
              <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest">
                <span className="text-white/60">ซูมหน้า</span>
                <span className="text-red-500">{config.zoom.toFixed(1)}x</span>
              </div>
              <input 
                type="range" min="1.0" max="2.5" step="0.1" value={config.zoom}
                onChange={(e) => onConfigChange({ ...config, zoom: parseFloat(e.target.value) })}
                className="w-full h-1.5 bg-white/10 rounded-lg appearance-none accent-red-600"
              />
            </div>

            {config.useChromaKey && (
              <div className="space-y-3">
                <div className="flex justify-between items-center text-[10px] font-black text-green-500 uppercase tracking-widest">
                  <span>ความละเอียดการตัดขอบ</span>
                  <span className="font-black bg-green-500/10 px-2 py-0.5 rounded">{config.threshold}</span>
                </div>
                <input 
                  type="range" min="10" max="120" step="1" value={config.threshold}
                  onChange={(e) => onConfigChange({ ...config, threshold: parseInt(e.target.value) })}
                  className="w-full h-1.5 bg-white/10 rounded-lg appearance-none accent-green-500"
                />
              </div>
            )}
          </div>
        </section>

        <button
          onClick={onHideUI}
          className="w-full py-6 bg-red-600 hover:bg-red-500 text-white rounded-[2rem] text-xs font-black transition-all shadow-xl uppercase tracking-[0.3em] active:scale-95"
        >
          ตกลง (ซ่อนเมนู)
        </button>
      </div>
    </div>
  );
};
