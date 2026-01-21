/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState, useRef, useEffect, useCallback, useContext } from 'react';
import { RinneganIcon, XIcon, BoltIcon, RefreshIcon, TrashIcon, SparklesIcon, KeyIcon, UploadIcon } from './icons'; // Updated import
import { AppContext, ImageModel } from '../context/AppContext';
import { audioService } from '../services/audioService';

// Removed AIStudio and Window.aistudio types as API key selection is no longer handled in UI
// declare global {
//   interface AIStudio {
//     hasSelectedApiKey: () => Promise<boolean>;
//     openSelectKey: () => Promise<void>;
//   }
//   interface Window {
//     aistudio?: AIStudio;
//   }
// }

interface SystemConfigWidgetProps {
  onSoftFix: () => void;
  onHardFix: () => void;
  onOpenDebugger: () => void;
}

interface Position {
  x: number;
  y: number;
}

export const SystemConfigWidget = React.memo((({ 
  onSoftFix, 
  onHardFix,
  onOpenDebugger 
}) => {
  // Removed setImageModel from context destructuring as model selection is removed
  const { isFastAiEnabled, setIsFastAiEnabled, isAudioMuted, toggleAudio } = useContext(AppContext);
  const [isOpen, setIsOpen] = useState(false);
  const [hasKey, setHasKey] = useState<boolean>(false); // Still useful for general API_KEY presence
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Default position: Bottom Right, slightly offset
  const [position, setPosition] = useState<Position>(() => {
    try {
      if (typeof window !== 'undefined') {
        const saved = localStorage.getItem('system-widget-position');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed.x !== undefined && parsed.y !== undefined) return parsed;
        }
      }
    } catch (e) {}
    return { x: 20, y: 100 }; // Fallback to safe zone
  });

  const [isDragging, setIsDragging] = useState(false);
  const [isHolding, setIsHolding] = useState(false);
  const widgetRef = useRef<HTMLDivElement>(null);
  const dragStartPos = useRef({ x: 0, y: 0 }); 
  const widgetOffset = useRef({ x: 0, y: 0 }); 
  const longPressTimer = useRef<number | null>(null);
  const touchIdentifierRef = useRef<number | null>(null);

  // Bounds Check: Ensure widget stays on screen on resize or initial load
  useEffect(() => {
      const checkBounds = () => {
          const maxX = window.innerWidth - 60;
          const maxY = window.innerHeight - 60;
          let newX = position.x;
          let newY = position.y;
          let changed = false;

          if (newX > maxX) { newX = maxX; changed = true; }
          if (newX < 0) { newX = 10; changed = true; }
          if (newY > maxY) { newY = maxY; changed = true; }
          if (newY < 0) { newY = 50; changed = true; }

          if (changed) {
              setPosition({ x: newX, y: newY });
          }
      };

      checkBounds();
      window.addEventListener('resize', checkBounds);
      return () => window.removeEventListener('resize', checkBounds);
  }, [position]);

  useEffect(() => {
    // Simplified key check: just check for process.env.API_KEY
    if (process.env.API_KEY) {
        setHasKey(true);
        setIsFastAiEnabled(true); // Assume enabled if API key is present
    } else {
        setHasKey(false);
        setIsFastAiEnabled(false);
    }
  }, [setIsFastAiEnabled]);

  useEffect(() => {
    try {
      localStorage.setItem('system-widget-position', JSON.stringify(position));
    } catch (e) {}
  }, [position]);

  const handlePointerDown = (e: React.MouseEvent | React.TouchEvent) => {
    let clientX: number;
    let clientY: number;
    if ('touches' in e) {
      const touch = e.touches[0];
      clientX = touch.clientX; clientY = touch.clientY;
      touchIdentifierRef.current = touch.identifier;
    } else {
      clientX = (e as React.MouseEvent).clientX; clientY = (e as React.MouseEvent).clientY;
    }
    dragStartPos.current = { x: clientX, y: clientY };
    widgetOffset.current = { x: clientX - position.x, y: clientY - position.y };
    setIsHolding(true);
    longPressTimer.current = window.setTimeout(() => {
      setIsDragging(true); setIsHolding(false);
    }, 400); 
  };

  const handlePointerMove = useCallback((e: MouseEvent | TouchEvent) => {
    let clientX: number; let clientY: number;
    if (window.TouchEvent && e instanceof TouchEvent) {
       const touch = Array.from(e.touches).find(t => t.identifier === touchIdentifierRef.current);
       if (!touch) return;
       clientX = touch.clientX; clientY = touch.clientY;
    } else {
       clientX = (e as MouseEvent).clientX; clientY = (e as MouseEvent).clientY;
    }
    if (isDragging) {
      const newX = clientX - widgetOffset.current.x;
      const newY = clientY - widgetOffset.current.y;
      setPosition({ 
        x: Math.max(0, Math.min(newX, window.innerWidth - 60)), 
        y: Math.max(0, Math.min(newY, window.innerHeight - 60)) 
      });
    } else if (isHolding) {
      const dist = Math.hypot(clientX - dragStartPos.current.x, clientY - dragStartPos.current.y);
      if (dist > 10) {
        if (longPressTimer.current) { clearTimeout(longPressTimer.current); longPressTimer.current = null; }
        setIsHolding(false);
      }
    }
  }, [isDragging, isHolding, position]); 

  const handlePointerUp = useCallback(() => {
    if (longPressTimer.current) { clearTimeout(longPressTimer.current); longPressTimer.current = null; }
    if (!isDragging && isHolding) setIsOpen(true);
    setIsDragging(false); setIsHolding(false);
    touchIdentifierRef.current = null;
  }, [isDragging, isHolding]);

  useEffect(() => {
    if (isHolding || isDragging) {
      window.addEventListener('mousemove', handlePointerMove);
      window.addEventListener('touchmove', handlePointerMove, { passive: false });
      window.addEventListener('mouseup', handlePointerUp);
      window.addEventListener('touchend', handlePointerUp);
    }
    return () => {
      window.removeEventListener('mousemove', handlePointerMove);
      window.removeEventListener('touchmove', handlePointerMove);
      window.removeEventListener('mouseup', handlePointerUp);
      window.removeEventListener('touchend', handlePointerUp);
    };
  }, [isHolding, isDragging, handlePointerMove, handlePointerUp]);

  // Removed handleOpenKey function as AI Studio key selection UI is removed
  // const handleOpenKey = async () => { ... };

  const handleAudioUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files[0]) {
          audioService.setCustomDrone(e.target.files[0]);
      }
      e.target.value = '';
  };

  const handleClearCustomDrone = () => {
      audioService.clearCustomDrone();
  };

  // Simplified color class, no longer dependent on `imageModel`
  const activeColorClass = hasKey ? 'text-primary' : 'text-zinc-500';

  return (
    <>
      {!isOpen ? (
        <div
          ref={widgetRef}
          style={{ position: 'fixed', top: `${position.y}px`, left: `${position.x}px`, zIndex: 9999, touchAction: 'none' }}
          onMouseDown={handlePointerDown}
          onTouchStart={handlePointerDown}
          className={`w-14 h-14 bg-zinc-950/80 backdrop-blur-xl border-2 transition-all cursor-move flex items-center justify-center rounded-full shadow-[0_0_20px_rgba(255,45,0,0.2)] ${isDragging ? 'scale-110 border-orange-500 shadow-[0_0_30px_rgba(255,92,0,0.5)]' : 'border-white/20 hover:border-orange-500/80 active:scale-95 hover:shadow-neon-flux'}`}
        >
          {/* Replaced SharinganIcon with RinneganIcon */}
          <RinneganIcon className={`w-7 h-7 transition-colors ${activeColorClass}`} /> 
          {/* Simplified API key presence indicator */}
          {hasKey && <div className={`absolute -top-1 -right-1 w-4 h-4 rounded-full border-2 border-black animate-pulse bg-matrix`} />}
        </div>
      ) : (
        <div className="fixed inset-0 z-[10000] bg-black/95 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in">
          <div className="glass-panel border-white/20 p-6 sm:p-8 w-full max-w-sm relative bg-zinc-950 shadow-[0_0_120px_rgba(0,0,0,1)] rounded-sm overflow-hidden">
            {/* Fire Gradient Accent */}
            <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-red-600 via-orange-500 to-amber-400" />
            
            <button 
                onClick={() => setIsOpen(false)} 
                className="absolute top-2 right-2 p-3 bg-red-950/30 border border-red-500/40 text-red-400 hover:text-white transition-colors rounded-none"
                title="Close System Terminal"
            >
              <XIcon className="w-6 h-6" />
            </button>
            <h3 className="text-xl font-black italic text-white/90 mb-8 uppercase tracking-[0.2em] font-display text-shadow-[0_0_10px_rgba(255,255,255,0.3)]">System_Terminal</h3>
            
            <div className="space-y-6">
              <div>
                <label className="text-[9px] font-mono text-white/50 uppercase tracking-[0.3em] block mb-3 font-black">Link_Protocol</label>
                <div className="grid grid-cols-2 gap-2">
                    <button 
                        onClick={() => setIsFastAiEnabled(!isFastAiEnabled)}
                        className={`py-4 px-3 border-2 transition-all flex flex-col items-center justify-center gap-1 rounded-sm group ${isFastAiEnabled ? 'bg-amber-500 border-amber-400 text-black shadow-[0_0_20px_rgba(251,191,36,0.4)]' : 'bg-zinc-900/50 border-white/10 text-white/40 hover:border-amber-500/30'}`}
                    >
                        <BoltIcon className={`w-4 h-4 ${isFastAiEnabled ? 'animate-pulse' : 'opacity-20'}`} />
                        <span className="text-[8px] font-black uppercase tracking-widest mt-1">Boost</span>
                    </button>
                    <button 
                        onClick={toggleAudio}
                        className={`py-4 px-3 border-2 transition-all flex flex-col items-center justify-center gap-1 rounded-sm group ${!isAudioMuted ? 'bg-vector border-vector text-black shadow-neon-matrix' : 'bg-zinc-900/50 border-white/10 text-white/40 hover:border-vector/30'}`}
                    >
                         <div className={`w-4 h-4 flex items-center justify-center border rounded-full ${!isAudioMuted ? 'border-black' : 'border-current'}`}>
                            <div className={`w-1 h-1 rounded-full ${!isAudioMuted ? 'bg-black' : 'bg-current'}`} />
                         </div>
                        <span className="text-[8px] font-black uppercase tracking-widest mt-1">Audio {isAudioMuted ? 'OFF' : 'ON'}</span>
                    </button>
                </div>
              </div>

              <div>
                <label className="text-[9px] font-mono text-white/50 uppercase tracking-[0.3em] block mb-3 font-black">Sonic_Injection</label>
                <div className="flex gap-2">
                    <button 
                        onClick={() => fileInputRef.current?.click()}
                        className="flex-1 py-3.5 px-5 border-2 border-white/10 bg-zinc-900/50 text-white/60 hover:text-white hover:border-white/30 transition-all flex items-center justify-center gap-3 rounded-sm group hover:shadow-[0_0_15px_rgba(255,255,255,0.1)]"
                    >
                        <UploadIcon className="w-4 h-4" />
                        <span className="text-[9px] font-black uppercase tracking-widest">Load Custom Drone SFX</span>
                    </button>
                    <button 
                        onClick={handleClearCustomDrone}
                        className="w-12 h-auto py-3.5 flex items-center justify-center border-2 border-red-900/50 bg-red-950/30 text-red-500 hover:bg-red-500 hover:text-black transition-all rounded-sm group hover:shadow-[0_0_15px_rgba(255,0,0,0.2)]"
                        title="Clear Custom Drone Audio"
                    >
                        <TrashIcon className="w-4 h-4" />
                    </button>
                </div>
                <input 
                    type="file" 
                    ref={fileInputRef} 
                    className="hidden" 
                    accept="audio/*,video/*" 
                    onChange={handleAudioUpload} 
                />
              </div>

              {/* Removed Core_Engine model selection */}
              {/* Removed Authentication section */}

              <div className="h-px bg-white/10 mt-2" />

              <div className="flex flex-col gap-2">
                <button onClick={() => { onSoftFix(); setIsOpen(false); }} className="w-full py-3 bg-zinc-900/60 border border-white/10 text-white/50 font-mono text-[9px] uppercase tracking-widest hover:border-orange-500/40 hover:text-orange-500 flex items-center justify-center gap-3 transition-all rounded-sm">
                  <RefreshIcon className="w-3.5 h-3.5" /> Re-sync
                </button>
                <div className="flex justify-between gap-2">
                    <button onClick={() => { onOpenDebugger(); setIsOpen(false); }} className="flex-1 py-2 text-zinc-700 font-mono text-[7px] uppercase tracking-widest hover:text-amber-400 transition-all text-left">
                        Logs
                    </button>
                    <button onClick={() => { onHardFix(); setIsOpen(false); }} className="flex-1 py-2 text-zinc-700 font-mono text-[7px] uppercase tracking-widest hover:text-red-500 transition-all text-right">
                        Format
                    </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
})) satisfies React.FC<SystemConfigWidgetProps>;