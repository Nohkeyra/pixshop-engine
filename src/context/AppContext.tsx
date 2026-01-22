/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { createContext, useState, ReactNode, useEffect, useCallback } from 'react';
import { audioService } from '../services/audioService';

type Theme = 'dark' | 'light';
// Updated to include 'gemini-2.0-pro-exp-02-05' for advanced tasks
export type ImageModel = 'gemini-3-flash' | 'gemini-2.0-pro-exp-02-05'; 

interface AppContextType {
    isLoading: boolean;
    setIsLoading: (loading: boolean) => void;
    isFastAiEnabled: boolean;
    setIsFastAiEnabled: React.Dispatch<React.SetStateAction<boolean>>;
    theme: Theme;
    toggleTheme: () => void;
    pixelRatio: number;
    density: 'compact' | 'standard' | 'large';
    imageModel: ImageModel;
    // Removed setImageModel from type as it's no longer user-selectable
    isAudioMuted: boolean;
    toggleAudio: () => void;
    isMobile: boolean; // New boolean for explicit mobile detection
}

export const AppContext = createContext<AppContextType>({
    isLoading: false,
    setIsLoading: () => {},
    isFastAiEnabled: false,
    setIsFastAiEnabled: () => {},
    theme: 'dark',
    toggleTheme: () => {},
    pixelRatio: 1,
    density: 'standard',
    imageModel: 'gemini-3-flash', // Default value
    // setImageModel: () => {}, // Removed
    isAudioMuted: false,
    toggleAudio: () => {},
    isMobile: false,
});

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [isLoading, setIsLoading] = useState(false);
    const [isFastAiEnabled, setIsFastAiEnabled] = useState(false);
    const [pixelRatio, setPixelRatio] = useState(window.devicePixelRatio || 1);
    const [density, setDensity] = useState<'compact' | 'standard' | 'large'>('standard');
    const [isMobile, setIsMobile] = useState(false);
    
    // imageModel state is still maintained to reflect the currently chosen model based on isFastAiEnabled
    // but not directly user-selectable via setImageModel
    const [imageModel, setImageModel] = useState<ImageModel>('gemini-3-flash');

    const [isAudioMuted, setIsAudioMuted] = useState(() => {
        try {
            return localStorage.getItem('app-audio-muted') === 'true';
        } catch {
            return false;
        }
    });

    const [theme, setTheme] = useState<Theme>(() => {
        try {
            const saved = localStorage.getItem('app-theme');
            return (saved === 'light') ? 'light' : 'dark';
        } catch {
            return 'dark';
        }
    });

    // Update imageModel based on isFastAiEnabled
    useEffect(() => {
        if (isFastAiEnabled) {
            setImageModel('gemini-3-flash');
        } else {
            setImageModel('gemini-2.0-pro-exp-02-05');
        }
    }, [isFastAiEnabled]);

    // Initialize Audio Service
    useEffect(() => {
        const initAudio = async () => {
            await audioService.init(); // Ensure init is awaited to load custom drone
            audioService.setMuted(isAudioMuted);
        };
        initAudio();
    }, [isAudioMuted]);

    const updateMetrics = useCallback(() => {
        const pr = window.devicePixelRatio || 1;
        const width = window.innerWidth;
        const height = window.innerHeight;
        setPixelRatio(pr);
        
        // Comprehensive Device Detection
        const userAgent = navigator.userAgent.toLowerCase();
        const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
        const mobileCheck = window.matchMedia('(max-width: 1024px)').matches || /iphone|ipad|ipod|android|blackberry|mini|windows\sce|palm/i.test(userAgent);
        
        setIsMobile(mobileCheck);

        // Density Logic based on Resolution and DPI
        let d: 'compact' | 'standard' | 'large' = 'standard';
        
        if (width < 640 || (isTouchDevice && width < 1024)) {
            d = 'compact'; // Mobile/Small Tablet
        } else if (width > 1920 || pr > 2) {
            d = 'large'; // High DPI or UltraWide
        }
        
        setDensity(d);
        
        // Set CSS variables for fluid typography and spacing
        const root = document.documentElement;
        root.style.setProperty('--ui-density', d === 'compact' ? '0.85' : (d === 'large' ? '1.15' : '1'));
        root.style.setProperty('--vh', `${height * 0.01}px`);
        root.style.setProperty('--dpr', pr.toString());
        
        // Add specific classes to body for CSS targeting
        document.body.classList.toggle('is-mobile', mobileCheck);
        document.body.classList.toggle('is-high-dpi', pr > 1);
    }, []);

    useEffect(() => {
        updateMetrics();
        window.addEventListener('resize', updateMetrics);
        return () => window.removeEventListener('resize', updateMetrics);
    }, [updateMetrics]);

    const toggleTheme = () => {
        setTheme(prev => {
            const newTheme = prev === 'dark' ? 'light' : 'dark';
            localStorage.setItem('app-theme', newTheme);
            return newTheme;
        });
    };

    const toggleAudio = () => {
        setIsAudioMuted(prev => {
            const newState = !prev;
            localStorage.setItem('app-audio-muted', String(newState));
            audioService.setMuted(newState);
            return newState;
        });
    };

    return (
        <AppContext.Provider value={{ 
            isLoading, setIsLoading, isFastAiEnabled, setIsFastAiEnabled, 
            theme, toggleTheme, pixelRatio, density, imageModel, 
            isAudioMuted, toggleAudio, isMobile
        }}>
            {children}
        </AppContext.Provider>
    );
};