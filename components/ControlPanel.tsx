
import React from 'react';
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
  const backgrounds = [
    { name: 'None', url: null },
    { name: 'Modern', url: 'https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&q=80&w=400' },
    { name: 'Studio', url: 'https://images.unsplash.com/photo-1524758631624-e2822e304c36?auto=format&fit=crop&q=80&w=400' },
    { name: 'Abstract', url: 'https://images.unsplash.com/photo-1557683316-973673baf926?auto=format&fit=crop&q=80&w=400' },
  ];

  const chromaPresets = [
    { name: 'Green', r: 0, g: 255, b: 0 },
    { name: 'White', r: 255, g: 255, b: 255 },
    { name: 'Blue', r: 0, g: 0, b: 255 },
    { name: 'Gray', r: 128, g: 128, b: 128 },
  ];

  return (
    /* Changed from bottom-8 to bottom-32 */
    <div className="absolute bottom-32 left-1/2 -translate-x-1/2 z-[100] w-[92%] max-w-md animate-in slide-in-from-bottom-10">
      <div className="glass p-7 rounded-[2.5rem] shadow-2xl space-y-6 border-white/5 overflow-y-auto max-h-[60vh] scrollbar-hide">
        
        {/* Chroma Key & Zoom Section */}
        <div className="bg-white/5 p-5 rounded-3xl space-y-5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black text-white/60 uppercase tracking-widest">Remove Background</span>
            <button 
              onClick={() => onConfigChange({ ...config, useChromaKey: !config.useChromaKey })}
              className={`w-12 h-6 rounded-full transition-all relative ${config.useChromaKey ? 'bg-blue-500' : 'bg-white/10'}`}
            >
              <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${config.useChromaKey ? 'right-1' : 'left-1'}`} />
            </button>
          </div>

          <div className="space-y-3">
            <div className="flex justify-between items-center text-[10px] font-black text-white/30 uppercase tracking-widest">
              <span>Camera Zoom (Narrow Angle)</span>
              <span className="text-white/60">{config.zoom.toFixed(1)}x</span>
            </div>
            <input 
              type="range" min="1.0" max="2.5" step="0.1" value={config.zoom}
              onChange={(e) => onConfigChange({ ...config, zoom: parseFloat(e.target.value) })}
              className="w-full h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-indigo-400"
            />
          </div>

          {config.useChromaKey && (
            <div className="space-y-4 pt-2 border-t border-white/5 animate-in fade-in zoom-in-95 duration-200">
              <div className="flex gap-2">
                {chromaPresets.map(color => (
                  <button
                    key={color.name}
                    onClick={() => onConfigChange({ ...config, chromaKeyColor: { r: color.r, g: color.g, b: color.b } })}
                    className={`flex-1 py-2 text-[8px] font-bold rounded-xl border-2 transition-all ${
                      config.chromaKeyColor.r === color.r && config.chromaKeyColor.g === color.g ? 'border-white bg-white/20' : 'border-transparent bg-white/5'
                    }`}
                    style={{ color: `rgb(${color.r},${color.g},${color.b})` }}
                  >
                    {color.name}
                  </button>
                ))}
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-[8px] font-bold text-white/30 uppercase">
                  <span>Threshold</span>
                  <span>{config.threshold}</span>
                </div>
                <input 
                  type="range" min="10" max="150" value={config.threshold}
                  onChange={(e) => onConfigChange({ ...config, threshold: parseInt(e.target.value) })}
                  className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-blue-400"
                />
              </div>
            </div>
          )}
        </div>

        {/* Basic Size & Shape */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-[8px] font-black text-white/30 uppercase tracking-widest">Bubble Size</label>
            <input 
              type="range" min="120" max="450" value={config.size}
              onChange={(e) => onConfigChange({ ...config, size: parseInt(e.target.value) })}
              className="w-full h-1.5 bg-white/10 rounded-lg appearance-none accent-white"
            />
          </div>
          <div className="flex bg-white/5 p-1 rounded-2xl self-end h-10">
            <button 
              onClick={() => onConfigChange({ ...config, shape: 'circle' })}
              className={`flex-1 text-[9px] font-black rounded-xl transition-all ${config.shape === 'circle' ? 'bg-white text-black' : 'text-white/40'}`}
            >
              CIRCLE
            </button>
            <button 
              onClick={() => onConfigChange({ ...config, shape: 'rect' })}
              className={`flex-1 text-[9px] font-black rounded-xl transition-all ${config.shape === 'rect' ? 'bg-white text-black' : 'text-white/40'}`}
            >
              RECT
            </button>
          </div>
        </div>

        {/* Virtual Backgrounds */}
        <div className="space-y-3">
          <label className="text-[10px] font-black text-white/30 uppercase tracking-widest block">Virtual Stage</label>
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
            {backgrounds.map((bg) => (
              <button
                key={bg.name}
                onClick={() => onConfigChange({ ...config, backgroundUrl: bg.url })}
                style={{ backgroundImage: bg.url ? `url(${bg.url})` : 'none' }}
                className={`flex-shrink-0 w-12 h-12 rounded-2xl bg-white/5 bg-cover bg-center border-2 transition-all ${
                  config.backgroundUrl === bg.url ? 'border-indigo-500 scale-110 shadow-lg' : 'border-transparent'
                }`}
              />
            ))}
          </div>
        </div>

        <button
          onClick={onHideUI}
          className="w-full py-4 bg-white/5 hover:bg-white/10 text-white rounded-2xl text-[10px] font-black transition-all border border-white/5 uppercase tracking-[0.2em]"
        >
          Close Settings
        </button>
      </div>
    </div>
  );
};
