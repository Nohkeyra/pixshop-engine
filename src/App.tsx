
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState, useCallback, useRef, useEffect, useMemo, useContext } from 'react';
import { clearState, nukeDatabase } from './services/persistence';
import { AppContext } from './context/AppContext';
import { Spinner } from './components/Spinner';
import { FilterPanel } from './components/FilterPanel';
import { LightPanel } from './components/LightPanel';
import { TypographicPanel } from './components/TypographicPanel';
import { VectorArtPanel } from './components/VectorArtPanel';
import { FluxPanel } from './components/FluxPanel';
import { StyleExtractorPanel } from './components/StyleExtractorPanel';
import { XIcon, HistoryIcon, BoltIcon, PaletteIcon, SunIcon, TypeIcon, VectorIcon, StyleExtractorIcon, CameraIcon, TrashIcon, UndoIcon, RedoIcon, UploadIcon, DownloadIcon, CheckIcon } from './components/icons';
import { SystemConfigWidget } from './components/SystemConfigWidget';
import { ImageUploadPlaceholder } from './components/ImageUploadPlaceholder';
import { StartScreen } from './components/StartScreen';
import * as geminiService from './services/geminiService';
import { RoutedStyle } from './services/geminiService';
import { HistoryGrid } from './components/HistoryGrid';
import { debugService } from './services/debugService';
import { DebugConsole } from './components/DebugConsole';
import { CameraCaptureModal } from './components/CameraCaptureModal';
import { LightningManager } from './components/LightningManager';
import { audioService } from './services/audioService';

export type ActiveTab = 'flux' | 'style_extractor' | 'filters' | 'light' | 'typography' | 'vector';

export interface HistoryItem {
    content: File | string;
    prompt?: string;
    type: 'upload' | 'generation' | 'edit' | 'transformation';
    timestamp: number;
    groundingUrls?: { uri: string; title?: string }[];
}

export type GenerationRequest = {
    type: ActiveTab;
    prompt?: string;
    useOriginal?: boolean;
    forceNew?: boolean;
    aspectRatio?: string;
    isChaos?: boolean;
    batchSize?: number;
    batchIndex?: number;
    systemInstructionOverride?: string;
    negativePrompt?: string; 
    denoisingInstruction?: string; 
    useGoogleSearch?: boolean; 
};

export const App: React.FC = () => {
    const { isLoading, setIsLoading, density, isFastAiEnabled } = useContext(AppContext);
    const [appStarted, setAppStarted] = useState(false);
    const [history, setHistory] = useState<HistoryItem[]>([]); 
    const [historyIndex, setHistoryIndex] = useState(-1); 
    const [error, setError] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<ActiveTab | null>('flux');
    const [viewerInstruction, setViewerInstruction] = useState<string | null>(null);
    const [showHistoryGrid, setShowHistoryGrid] = useState(false);
    const [showDebugger, setShowDebugger] = useState(false);
    const [showCamera, setShowCamera] = useState(false);
    
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [pendingPrompt, setPendingPrompt] = useState<string | null>(null);
    const [fluxPrompt, setFluxPrompt] = useState('');

    const [currentMediaUrl, setCurrentMediaUrl] = useState<string | null>(null);

    // Feedback states for action buttons
    const [downloadFeedbackStatus, setDownloadFeedbackStatus] = useState<'idle' | 'success'>('idle');
    const [deleteFeedbackStatus, setDeleteFeedbackStatus] = useState<'idle' | 'success'>('idle');
    const [clearFeedbackStatus, setClearFeedbackStatus] = useState<'idle' | 'success'>('idle');

    // Generic feedback trigger
    const triggerFeedback = useCallback((setStatus: React.Dispatch<React.SetStateAction<'idle' | 'success'>>) => {
        setStatus('success');
        const timer = setTimeout(() => {
            setStatus('idle');
        }, 1500); // Show feedback for 1.5 seconds
        return () => clearTimeout(timer);
    }, [],);

    // Debugging and Error Logging Integration
    useEffect(() => {
        debugService.init();
    }, []);

    // Audio Effects for Loading State
    useEffect(() => {
        if (isLoading) {
            audioService.startDrone();
        } else {
            audioService.stopDrone();
            if (viewerInstruction === "DNA_SAVED" || (viewerInstruction === null && !error)) {
                audioService.playSuccess(); // Play success if we just finished loading without error
            }
        }
    }, [isLoading, error, viewerInstruction]);

    // Manage current media Object URL
    useEffect(() => {
        const currentItem = history[historyIndex];
        let url: string | null = null;
        if (currentItem) {
            url = typeof currentItem.content === 'string' 
                ? currentItem.content 
                : URL.createObjectURL(currentItem.content);
        }
        setCurrentMediaUrl(url);

        return () => {
            if (url && url.startsWith('blob:')) {
                URL.revokeObjectURL(url);
            }
        };
    }, [history, historyIndex]);

    const handleImageUpload = useCallback((file: File) => {
        setError(null);
        setViewerInstruction(null);
        audioService.playClick();
        setHistory(prev => {
            const newHistory = [...prev.slice(0, historyIndex + 1), { content: file, type: 'upload', timestamp: Date.now() }];
            setHistoryIndex(newHistory.length - 1);
            return newHistory;
        });
        setActiveTab('flux'); // Default to flux panel after upload
        setFluxPrompt(''); // Clear flux prompt on new upload
    }, [historyIndex]);

    const handleGenerate = useCallback(async (request: GenerationRequest) => {
        if (isLoading) return;
        setIsLoading(true);
        setError(null);
        setViewerInstruction(null);
        audioService.playClick();

        try {
            // sourceImage can be File | string (data URL) | undefined
            const sourceImage = request.useOriginal 
                ? history.find(item => item.type === 'upload')?.content 
                : history[historyIndex]?.content;

            if (!sourceImage && !request.forceNew) {
                throw new Error("Missing_Source_Visual: Upload an image or force new generation.");
            }

            let result: { imageUrl: string; groundingUrls?: { uri: string; title?: string }[] };

            // Dynamic model selection based on `isFastAiEnabled`
            const imageGenerationModel = isFastAiEnabled ? 'gemini-2.5-flash-image' : 'gemini-3-pro-image-preview'; 

            if (request.type === 'flux') {
                if (sourceImage && !request.forceNew) { // If there's a source image (File or string) AND not forcing new
                    setViewerInstruction("TRANSFORMING_VISUAL_FLUX...");
                    result = await geminiService.generateFluxImage(sourceImage, request.prompt || '', { 
                        model: imageGenerationModel,
                        aspectRatio: request.aspectRatio, 
                        systemInstructionOverride: request.systemInstructionOverride,
                        negativePrompt: request.negativePrompt,
                        setViewerInstruction: setViewerInstruction,
                        useGoogleSearch: request.useGoogleSearch
                    });
                } else {
                    setViewerInstruction("GENERATING_FLUX_FROM_TEXT...");
                    const textToImagePrompt = `Urban high-fidelity visual: ${request.prompt}. Grit, neon, high contrast.`;
                    result = await geminiService.generateFluxTextToImage(textToImagePrompt, { 
                        model: imageGenerationModel,
                        aspectRatio: request.aspectRatio, 
                        systemInstructionOverride: request.systemInstructionOverride,
                        negativePrompt: request.negativePrompt,
                        setViewerInstruction: setViewerInstruction,
                        useGoogleSearch: request.useGoogleSearch
                    });
                }
            } else if (request.type === 'filters' || request.type === 'light' || request.type === 'vector' || request.type === 'typography') {
                if (!sourceImage) {
                    throw new Error("Missing_Source_Visual: Requires an image to apply filters/styles.");
                }
                setViewerInstruction(`APPLYING_NEURAL_${request.type.toUpperCase()}...`);
                result = await geminiService.generateFilteredImage(sourceImage, request.prompt || '', { 
                    model: imageGenerationModel,
                    aspectRatio: request.aspectRatio, 
                    systemInstructionOverride: request.systemInstructionOverride,
                    denoisingInstruction: request.denoisingInstruction,
                    setViewerInstruction: setViewerInstruction,
                    useGoogleSearch: request.useGoogleSearch
                });
            } else {
                throw new Error("UNKNOWN_PROTOCOL: Invalid generation request type.");
            }
            
            setHistory(prev => {
                const newHistory = [...prev.slice(0, historyIndex + 1), { 
                    content: result.imageUrl, 
                    prompt: request.prompt, 
                    type: request.type === 'flux' && request.forceNew ? 'generation' : 'transformation', 
                    timestamp: Date.now(),
                    groundingUrls: result.groundingUrls
                }];
                setHistoryIndex(newHistory.length - 1);
                return newHistory;
            });

        } catch (e: any) {
            setError(e.message || "Synthesis_Fault: Unknown error during generation.");
            console.error('Generation Error:', e.message || e);
        } finally {
            setIsLoading(false);
            setViewerInstruction(null);
            audioService.playClick();
        }
    }, [history, historyIndex, isLoading, setIsLoading, isFastAiEnabled]);

    const handleUndo = useCallback(() => {
        if (historyIndex > 0) {
            setHistoryIndex(prev => prev - 1);
            audioService.playClick();
        }
    }, [historyIndex]);

    const handleRedo = useCallback(() => {
        if (historyIndex < history.length - 1) {
            setHistoryIndex(prev => prev + 1);
            audioService.playClick();
        }
    }, [historyIndex, history.length]);

    const handleClearCanvas = useCallback(() => {
        if (confirm('CONFIRM_FULL_SYSTEM_WIPE? All generated visuals and history will be permanently purged.')) {
            setHistory([]);
            setHistoryIndex(-1);
            setError(null);
            setFluxPrompt('');
            setPendingPrompt(null);
            setViewerInstruction(null);
            audioService.playClick();
            triggerFeedback(setClearFeedbackStatus);
        }
    }, [triggerFeedback]);

    const handleRemoveCurrentHistoryItem = useCallback(() => {
        if (history.length === 0 || historyIndex === -1) return;

        if (confirm('CONFIRM_PURGE_SEQUENCE? The current visual will be deleted from history.')) {
            setHistory(prev => {
                const newHistory = prev.filter((_, idx) => idx !== historyIndex);
                const newIndex = Math.max(-1, historyIndex - 1);
                setHistoryIndex(newIndex);
                if (newHistory.length === 0) {
                    setFluxPrompt('');
                }
                return newHistory;
            });
            audioService.playClick();
            triggerFeedback(setDeleteFeedbackStatus);
        }
    }, [history, historyIndex, triggerFeedback]);

    const handleSoftFix = useCallback(() => {
        if (confirm('RE-SYNC_SYSTEM? This will clear current session data.')) {
            clearState().then(() => {
                window.location.reload();
            }).catch(e => {
                alert("Soft Fix Failed: " + e.message);
                console.error("Soft Fix Failed:", e);
            });
        }
    }, []);

    const handleHardFix = useCallback(() => {
        if (confirm('INITIATE_FORMAT_SEQUENCE? This will delete ALL application data, including presets and history.')) {
            nukeDatabase().then(() => {
                window.location.reload();
            }).catch(e => {
                alert("Hard Fix Failed: " + e.message);
                console.error("Hard Fix Failed:", e);
            });
        }
    }, []);

    const handleRouteStyle = useCallback((style: RoutedStyle) => {
        setActiveTab(style.target_panel_id);
        setPendingPrompt(style.preset_data.prompt);
        audioService.playClick();
    }, []);

    const handleDownloadImage = useCallback(() => {
        if (currentMediaUrl) {
            const link = document.createElement('a');
            link.href = currentMediaUrl;
            link.download = `pixshop_export_${Date.now()}.png`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            audioService.playClick();
            triggerFeedback(setDownloadFeedbackStatus);
        }
    }, [currentMediaUrl, triggerFeedback]);

    const currentImageFile = useMemo(() => {
        const item = history[historyIndex];
        if (item && item.content instanceof File) {
            return item.content;
        }
        return null; // Strings are handled directly inside generateFluxImage
    }, [history, historyIndex]);

    const hasImage = history.length > 0 && historyIndex !== -1;
    const headerHeight = density === 'compact' ? 'h-[72px]' : 'h-[100px]';

    const tabButtons = useMemo(() => [
        { id: 'flux', label: 'Flux', icon: BoltIcon, color: 'text-flux' },
        { id: 'filters', label: 'FX', icon: PaletteIcon, color: 'text-filter' },
        { id: 'light', label: 'Light', icon: SunIcon, color: 'text-highlight' },
        { id: 'typography', label: 'Type', icon: TypeIcon, color: 'text-type' },
        { id: 'vector', label: 'Vector', icon: VectorIcon, color: 'text-vector' },
        { id: 'style_extractor', label: 'DNA', icon: StyleExtractorIcon, color: 'text-dna' },
    ], []);

    if (!appStarted) {
        return <StartScreen onStart={(tab) => { setAppStarted(true); if (tab) setActiveTab(tab); }} />;
    }

    return (
        <div className="app-container relative flex flex-col h-full w-full bg-surface-deep text-white overflow-hidden gpu-accelerate">
            <div className="absolute inset-0 cyber-grid opacity-10" />
            <div className="absolute inset-0 neural-scanlines opacity-10 pointer-events-none"></div>

            <SystemConfigWidget 
                onSoftFix={handleSoftFix} 
                onHardFix={handleHardFix} 
                onOpenDebugger={() => setShowDebugger(true)} 
            />

            {showHistoryGrid && (
                <HistoryGrid 
                    history={history} 
                    setHistoryIndex={setHistoryIndex} 
                    onClose={() => setShowHistoryGrid(false)} 
                />
            )}
            {showDebugger && <DebugConsole onClose={() => setShowDebugger(false)} />}
            {showCamera && <CameraCaptureModal isOpen={showCamera} onClose={() => setShowCamera(false)} onCapture={handleImageUpload} />}

            <LightningManager />

            {/* Main Header */}
            <header className={`px-4 pb-2 pt-[max(1rem,env(safe-area-inset-top))] bg-zinc-950/90 backdrop-blur-xl border-b border-white/20 shrink-0 relative z-30 flex flex-col justify-center ${headerHeight}`}>
                <div className="w-full max-w-7xl mx-auto flex items-center justify-between">
                    <div onClick={() => { setAppStarted(false); audioService.playClick(); }} className="flex items-center gap-3 group cursor-pointer" title="Return to Start Screen">
                        <div className="w-10 h-10 rounded-full bg-white/10 backdrop-blur-md border border-white/30 flex items-center justify-center group-hover:bg-white/20 transition-all shadow-lg-neon-white">
                            <BoltIcon className="w-5 h-5 text-white" />
                        </div>
                        <div className="flex flex-col justify-center">
                            <h1 className="text-xl pixshop-wordmark leading-none text-white drop-shadow-md filter drop-shadow-[0_0_15px_#00FF9D]">PIXSH<span className="text-flux">O</span>P</h1>
                            <div className="text-[8px] font-mono text-white/60 uppercase tracking-[0.3em] font-bold">CORE_PROTOCOL</div>
                        </div>
                    </div>
                    
                    <div className="flex items-center gap-4">
                        {error && (
                            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-red-900/30 backdrop-blur-md border border-red-500/60 rounded-sm shadow-lg-neon-red">
                                <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse shadow-[0_0_20px_#ef4444]" />
                                <span className="text-[9px] font-bold font-mono text-red-300 uppercase tracking-widest">{error.split(':')[0].replace(/_/g, ' ')}</span>
                            </div>
                        )}
                        {hasImage && (
                            <button 
                                onClick={() => setShowHistoryGrid(true)}
                                className="px-3 py-1.5 bg-white/15 backdrop-blur-md border border-white/30 text-white/80 hover:text-white hover:border-white/50 transition-all text-[9px] font-bold font-mono uppercase tracking-widest shadow-lg-neon-white"
                            >
                                <HistoryIcon className="inline-block w-4 h-4 mr-2" />
                                HISTORY
                            </button>
                        )}
                    </div>
                </div>
            </header>

            {/* Main Content: Split Layout */}
            <main className="flex-1 flex flex-col md:flex-row overflow-hidden relative z-10 h-full">
                {/* Left Panel - Image Viewer (40% height on mobile, full width) */}
                <section 
                    className="relative flex items-center justify-center bg-black/50 border-r border-white/15 overflow-hidden shadow-inner w-full shrink-0 md:flex-1 md:h-auto md:w-auto h-[40dvh]"
                >
                    {viewerInstruction && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/80 backdrop-blur-sm z-40 text-primary animate-fade-in">
                            <Spinner instruction={viewerInstruction} />
                        </div>
                    )}

                    {isLoading && !viewerInstruction && (
                         <div className="absolute inset-0 flex items-center justify-center bg-black/80 backdrop-blur-sm z-40 text-primary animate-fade-in">
                            <Spinner />
                        </div>
                    )}

                    {error && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/90 backdrop-blur-sm z-40 p-8 animate-fade-in text-center">
                            <div className="text-red-500 text-6xl mb-4 animate-pulse">!</div>
                            <h3 className="text-red-400 font-display text-2xl uppercase italic tracking-tighter mb-2">ERROR_CRITICAL</h3>
                            <p className="text-red-300 font-mono text-sm leading-relaxed max-w-sm">{error}</p>
                            <button onClick={() => { setError(null); audioService.playClick(); }} className="mt-6 px-6 py-2 bg-red-600 text-white uppercase text-xs font-bold hover:bg-red-500 transition-colors shadow-lg-neon-red">
                                DISMISS
                            </button>
                        </div>
                    )}

                    {currentMediaUrl && !error ? (
                        <div className="w-full h-full relative group flex items-center justify-center p-2">
                            <img 
                                src={currentMediaUrl} 
                                alt="Neural Preview" 
                                className="max-w-full max-h-full object-contain shadow-2xl transition-all duration-300 ease-out"
                                style={{ imageRendering: 'auto' }}
                                loading="lazy"
                            />
                            
                            {/* Overlay Controls */}
                            <div className="absolute top-4 right-4 z-30 pointer-events-auto flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button 
                                    onClick={handleDownloadImage}
                                    className={`p-3 bg-black/40 backdrop-blur-xl border rounded-full text-white hover:bg-white/10 transition-all active:scale-90 shadow-2xl ${downloadFeedbackStatus === 'success' ? 'border-green-500 text-green-500' : 'border-white/10'}`}
                                >
                                    {downloadFeedbackStatus === 'success' ? <CheckIcon className="w-5 h-5" /> : <DownloadIcon className="w-5 h-5" />}
                                </button>
                                <button 
                                    onClick={handleClearCanvas}
                                    className={`p-3 bg-black/40 backdrop-blur-xl border rounded-full text-white hover:bg-red-500/10 transition-all active:scale-90 shadow-2xl ${clearFeedbackStatus === 'success' ? 'border-green-500 text-green-500' : 'border-white/10'}`}
                                >
                                    {clearFeedbackStatus === 'success' ? <CheckIcon className="w-5 h-5" /> : <XIcon className="w-5 h-5" />}
                                </button>
                            </div>

                            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-3 z-30 opacity-0 group-hover:opacity-100 transition-opacity">
                                {historyIndex > 0 && (
                                    <button onClick={handleUndo} className="p-3 bg-black/40 backdrop-blur-xl border border-white/20 rounded-full text-white hover:bg-white/10 transition-all active:scale-90 shadow-lg-neon-white">
                                        <UndoIcon className="w-5 h-5" />
                                    </button>
                                )}
                                {historyIndex < history.length - 1 && (
                                    <button onClick={handleRedo} className="p-3 bg-black/40 backdrop-blur-xl border border-white/20 rounded-full text-white hover:bg-white/10 transition-all active:scale-90 shadow-lg-neon-white">
                                        <RedoIcon className="w-5 h-5" />
                                    </button>
                                )}
                            </div>
                        </div>
                    ) : (
                        <ImageUploadPlaceholder onImageUpload={handleImageUpload} />
                    )}

                    {/* Quick Action Dock */}
                    <div className="absolute bottom-4 left-4 z-30 flex items-center gap-3">
                        <button onClick={() => fileInputRef.current?.click()} className="p-3 bg-white/15 backdrop-blur-md border border-white/30 rounded-full text-white hover:bg-white/20 transition-all active:scale-95 shadow-lg-neon-white">
                            <UploadIcon className="w-5 h-5" />
                        </button>
                        <button onClick={() => setShowCamera(true)} className="p-3 bg-white/15 backdrop-blur-md border border-white/30 rounded-full text-white hover:bg-white/20 transition-all active:scale-95 shadow-lg-neon-white">
                            <CameraIcon className="w-5 h-5" />
                        </button>
                        <input type="file" ref={fileInputRef} onChange={(e) => { if (e.target.files && e.target.files[0]) handleImageUpload(e.target.files[0]); e.target.value = ''; }} className="hidden" accept="image/*" />
                    </div>
                </section>

                {/* Right Panel - Controls (Takes remaining height, scrollable) */}
                <section className="flex flex-col bg-surface-panel border-l border-white/20 shadow-lg-neon-white overflow-hidden relative md:w-[350px] lg:w-[400px] md:h-auto md:flex-shrink-0 w-full flex-1 min-h-0">
                    <div className="absolute inset-0 bg-gradient-to-br from-black/50 via-transparent to-black/50 pointer-events-none z-0" />
                    {activeTab === 'flux' && <FluxPanel onRequest={handleGenerate} isLoading={isLoading} hasImage={hasImage} currentImageFile={currentImageFile} fluxPrompt={fluxPrompt} setFluxPrompt={setFluxPrompt} setViewerInstruction={setViewerInstruction} />}
                    {activeTab === 'filters' && <FilterPanel onRequest={handleGenerate} isLoading={isLoading} hasImage={hasImage} currentImageFile={currentImageFile} initialPrompt={pendingPrompt || undefined} setViewerInstruction={setViewerInstruction} />}
                    {activeTab === 'light' && <LightPanel onRequest={handleGenerate} isLoading={isLoading} setViewerInstruction={setViewerInstruction} currentMediaUrl={currentMediaUrl} hasImage={hasImage} />}
                    {activeTab === 'typography' && <TypographicPanel onRequest={handleGenerate} isLoading={isLoading} hasImage={hasImage} setViewerInstruction={setViewerInstruction} initialPrompt={pendingPrompt || undefined} />}
                    {activeTab === 'vector' && <VectorArtPanel onRequest={handleGenerate} isLoading={isLoading} hasImage={hasImage} currentImageFile={currentImageFile} setViewerInstruction={setViewerInstruction} initialPrompt={pendingPrompt || undefined} />}
                    {activeTab === 'style_extractor' && <StyleExtractorPanel isLoading={isLoading} hasImage={hasImage} currentImageFile={currentImageFile} onRouteStyle={handleRouteStyle} setViewerInstruction={setViewerInstruction} />}
                </section>
            </main>

            {/* Footer Navigation */}
            <footer className="w-full bg-black/95 backdrop-blur-xl border-t border-white/20 shrink-0 relative z-30 pb-[env(safe-area-inset-bottom)]">
                <div className="w-full max-w-7xl mx-auto flex justify-around items-center h-16 sm:h-20 px-4">
                    {tabButtons.map((tab) => (
                        <button 
                            key={tab.id}
                            onClick={() => { setActiveTab(tab.id as ActiveTab); audioService.playClick(); }}
                            className={`flex flex-col items-center justify-center p-2 rounded-none transition-all duration-200 group relative
                                ${activeTab === tab.id ? `bg-black/50 ${tab.color} border border-current shadow-[0_0_25px_currentColor] scale-105 -translate-y-1` : 'bg-white/10 border border-white/15 text-white/60 hover:bg-white/20 hover:border-white/20 hover:text-white'}`}
                            style={{ flex: 1, maxWidth: '120px' }}
                        >
                            <tab.icon className={`w-5 h-5 transition-colors ${activeTab === tab.id ? tab.color : 'text-white/60 group-hover:text-white'}`} />
                            <span className={`text-[9px] font-mono uppercase tracking-widest mt-1 transition-colors ${activeTab === tab.id ? tab.color : 'text-white/60 group-hover:text-white'}`}>{tab.label}</span>
                        </button>
                    ))}
                </div>
            </footer>
        </div>
    );
};
