/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { createContext, useState, ReactNode, useEffect, useCallback } from 'react';
import { audioService } from '../services/audioService';

type Theme = 'dark' | 'light';
// Updated to include 'gemini-1.5-pro' for advanced tasks
export type ImageModel = 'gemini-1.5-flash' | 'gemini-1.5-pro'; 

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
    imageModel: 'gemini-1.5-flash', // Default value
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
    const [imageModel, setImageModel] = useState<ImageModel>('gemini-1.5-flash');

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
            setImageModel('gemini-1.5-flash');
        } else {
            setImageModel('gemini-1.5-pro');
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
        setPixelRatio(pr);
        
        // Accurate Mobile Detection using matchMedia
        const mobileCheck = window.matchMedia('(max-width: 768px)').matches;
        setIsMobile(mobileCheck);

        let d: 'compact' | 'standard' | 'large' = 'standard';
        // Tailored for mobile viewports (e.g. Pixel 7 is ~412px width)
        if (width < 640) {
            d = 'compact';
        } else if (width > 1400) {
            d = 'large';
        }
        
        setDensity(d);
        document.documentElement.style.setProperty('--ui-density', d === 'compact' ? '0.8' : (d === 'large' ? '1.1' : '1'));
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