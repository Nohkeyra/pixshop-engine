# Pixshop - Urban Neural Synthesis Engine

## Overview

Pixshop is a creative AI-powered image generation and manipulation application built with React and TypeScript. It leverages the Google Gemini API to provide various image transformation capabilities including style extraction, filters, lighting adjustments, typography, and vector art generation. The application has a distinct urban/street art aesthetic with a cyberpunk-inspired UI.

The app is designed as a Progressive Web App (PWA) with Capacitor support for potential native mobile deployment.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Framework
- **React 18** with TypeScript for type safety
- **Vite** as the build tool and dev server
- **Tailwind CSS** for styling with a custom urban/cyberpunk theme
- Component architecture with React.memo for performance optimization

### State Management
- **React Context API** (AppContext) for global state including:
  - Loading states
  - Theme preferences
  - Audio settings
  - Device detection (mobile vs desktop)
  - Image model selection

### Core Panels/Features
The app is organized around several functional panels, each handling different AI-powered transformations:
- **FluxPanel**: Text-to-image generation with style presets
- **FilterPanel**: Apply visual filters and effects to images
- **LightPanel**: Lighting and color grading adjustments
- **TypographicPanel**: Street-style typography generation
- **VectorArtPanel**: Vector illustration and logo creation
- **StyleExtractorPanel**: Analyze images to extract and reuse visual styles

### AI Integration
- **Google Gemini API** (`@google/genai`) for all AI operations
- Two model options: `gemini-2.5-flash-image` (default) and `gemini-3-pro-image-preview` (advanced)
- Service layer (`geminiService.ts`) handles all API communication with protocols for different creative roles (artist, editor, designer, typographer)

### Data Persistence
- **IndexedDB** for client-side storage via `persistence.ts`
- Stores: history, style presets, app configuration
- Supports saving/loading user-created presets and session history

### Audio System
- Custom audio service for UI sound effects
- Supports custom drone audio upload and persistence
- Web Audio API for synthesized sounds

### Mobile Support
- Capacitor configuration for Android deployment
- PWA manifest for installability
- Safe area insets handling for notched devices
- Touch-optimized UI with gesture support

### Debug Infrastructure
- Custom debug console component
- Console interception for log aggregation
- Error boundary for graceful failure handling

## External Dependencies

### AI/ML Services
- **Google Gemini API**: Primary AI backend for image generation and analysis. Requires `GEMINI_API_KEY` environment variable.

### NPM Packages
- `@google/genai`: Google's Generative AI SDK
- `react` / `react-dom`: UI framework
- `lucide-react`: Icon library
- `tailwindcss` / `autoprefixer` / `postcss`: Styling
- `vite` / `@vitejs/plugin-react`: Build tooling
- `typescript`: Type checking

### Browser APIs Used
- IndexedDB for persistence
- Web Audio API for sound effects
- MediaDevices API for camera capture
- Clipboard API for copy functionality

### Fonts (Google Fonts)
- Inter (sans-serif)
- Orbitron (monospace/display)
- Koulen (display)
- Rubik Wet Paint (decorative)