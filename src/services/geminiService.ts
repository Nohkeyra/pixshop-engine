/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { GoogleGenerativeAI, HarmBlockThreshold, HarmCategory, SchemaType } from "@google/generative-ai";
import type { ImageModel } from '../context/AppContext';

// Factory to always get the freshest instance
const getAiClient = () => {
    // Access Vite environment variables correctly
    const apiKey = (import.meta as any).env.VITE_API_KEY;
    
    if (!apiKey) {
        throw new Error("NEURAL_LINK_NULL: Authentication key missing. Initialize via System Config.");
    }
    return new GoogleGenerativeAI(apiKey);
};

/**
 * Normalize model id strings to avoid leading slashes, stray spaces, etc.
 * Examples:
 *   "/gemini-3- flash" -> "gemini-3-flash"
 */
const sanitizeModel = (m?: string): string => {
    if (!m) return 'gemini-1.5-flash';
    // trim, remove leading slashes, and collapse whitespace
    const trimmed = m.toString().trim().replace(/^\/*/, '');
    // replace any internal whitespace with a single dash:
    const normalized = trimmed.replace(/\s+/g, '-');
    
    // Map experimental or deprecated models to stable ones
    // Check for 1.5 versions first
    if (normalized.includes('1.5-flash')) return 'gemini-1.5-flash';
    if (normalized.includes('1.5-pro')) return 'gemini-1.5-pro';
    
    // Fallback mappings for other versions
    if (normalized.includes('gemini-3-flash')) return 'gemini-1.5-flash';
    if (normalized.includes('gemini-2.0-pro-exp')) return 'gemini-1.5-pro';
    
    // Default to gemini-1.5-flash if no match
    return 'gemini-1.5-flash';
};

export const PROTOCOLS = {
    ARTIST: `You are the PIXSHOP Synthesis Engine. Transform prompts into raw, high-fidelity urban visuals. Adhere to street-culture aesthetics: grit, neon, and high contrast.`,
    EDITOR: `Role: High-End Neural Retoucher. Apply technical adjustments with photographic precision.`,
    DESIGNER: `Role: Professional Urban Vector Designer. Output crisp, flat illustrations with bold silhouettes and isolated backgrounds.`,
    TYPOGRAPHER: `Role: Master Street Typographer. Render text as high-impact urban assets (stencil, wildstyle, chrome).`,
    IMAGE_TRANSFORMER: `Role: Stylistic Diffusion Core. Infuse the source subject with the target visual DNA.`,
    STYLE_ROUTER: `Analyze visual DNA and route to: 'filter_panel', 'vector_art_panel', 'typographic_panel'. Output STRICT JSON.`,
    PRESET_GENERATOR: `Analyze prompt and generate urban metadata. Output STRICT JSON.`
};

export interface ImageGenerationConfig {
    model?: ImageModel;
    aspectRatio?: string;
    isChaos?: boolean;
    systemInstructionOverride?: string;
    negativePrompt?: string; 
    denoisingInstruction?: string; 
    setViewerInstruction?: (text: string | null) => void;
    useGoogleSearch?: boolean;
}

// Unified response type for image generation
interface ImageGenerationResult {
    imageUrl: string;
    groundingUrls?: { uri: string; title?: string }[];
}

// --- FIX START: Explicitly Export RoutedStyle ---
export interface RoutedStyle {
    target_panel_id: 'filter_panel' | 'vector_art_panel' | 'typographic_panel';
    preset_data: { name: string; description: string; prompt: string; };
}
// --- FIX END ---

const fileToPart = async (file: File | string, setViewerInstruction?: (text: string | null) => void): Promise<{ inlineData: { mimeType: string; data: string; } }> => {
    if (typeof file === 'string') {
        const parts = file.split(',');
        const mimeType = parts[0].match(/:(.*?);/)?.[1] || 'image/png';
        const base64Data = parts.length > 1 ? parts[1] : '';
        return { inlineData: { mimeType, data: base64Data } };
    }
    
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            if (setViewerInstruction) setViewerInstruction("UPLOADING_VOXEL_MAP...");
            const result = reader.result as string;
            if (!result || !result.includes(',')) {
                console.error("FileReader result is invalid:", result);
                reject(new Error("IO_FAULT: Image sequence corrupted during read (invalid result)."));
                return;
            }
            const base64Data = result.split(',')[1] || ''; 
            resolve({ inlineData: { mimeType: file.type, data: base64Data } });
        };
        reader.onerror = (errorEvent) => {
            const error = reader.error || errorEvent;
            console.error("FileReader error during readAsDataURL:", error);
            reject(new Error(`IO_FAULT: Image sequence corrupted during read (${error.toString()}).`));
        };
        try {
            reader.readAsDataURL(file);
        } catch (e: any) {
            console.error("FileReader readAsDataURL throw:", e);
            reject(new Error(`IO_FAULT: Image sequence corrupted during read (${e.message}).`));
        }
    });
};

const handleApiResponse = (response: any, setViewerInstruction?: (text: string | null) => void): ImageGenerationResult => {
    if (setViewerInstruction) setViewerInstruction("DECODING_NEURAL_RESPONSE...");
    // Extraction depends on whether it's an image generation model or text
    // For now returning placeholder as the SDK doesn't directly support Imagen in the same way
    return { imageUrl: "https://via.placeholder.com/512?text=API+Response+Received" };
};

export const refineImagePrompt = async (prompt: string, useDeepThinking?: boolean, setViewerInstruction?: (text: string | null) => void): Promise<string> => {
    try {
        if (setViewerInstruction) setViewerInstruction("REFINING_PROMPT_GRAMMAR...");
        const ai = getAiClient();
        const modelId = sanitizeModel('gemini-1.5-flash');
        
        console.debug(`[gemini] refineImagePrompt → model: ${modelId}`);

        const model = ai.getGenerativeModel({
            model: modelId,
            safetySettings: [
                { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
                { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
                { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
                { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
            ],
        });

        const result = await model.generateContent(
            `Professionalize this urban synthesis prompt into a high-density AI generation directive: "${prompt}". Focus on lighting, texture, and composition terms.`
        );
        return result.response.text() || prompt;
    } catch (e: any) {
        if (e.message?.includes('403') || e.message?.includes('401')) throw new Error("AUTH_DENIED: Invalid Neural Link Key. Reset via Config.");
        if (e.message?.includes('429')) throw new Error("BUFFER_OVERFLOW: API rate limit reached. Cool down.");
        throw e;
    } finally {
        if (setViewerInstruction) setViewerInstruction(null);
    }
};

export const generateFluxTextToImage = async (prompt: string, config?: ImageGenerationConfig): Promise<ImageGenerationResult> => {
    if (config?.setViewerInstruction) config.setViewerInstruction("GENERATING_FLUX_FROM_TEXT...");
    const ai = getAiClient();
    const modelId = sanitizeModel(config?.model || 'gemini-1.5-flash');
    
    console.debug(`[gemini] generateFluxTextToImage → model: ${modelId}`);

    const model = ai.getGenerativeModel({
        model: modelId,
        safetySettings: [
            { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
            { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
            { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
            { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
        ],
    });

    let fullPrompt = `${prompt}${config?.negativePrompt ? ` --avoid ${config.negativePrompt}` : ''}`;

    try {
        const result = await model.generateContent(fullPrompt);
        // handleApiResponse needs to be updated too
        return { imageUrl: "https://via.placeholder.com/512?text=API+Response+Received" };
    } catch (err: any) {
        console.error("[gemini] text-to-image failed:", err);
        throw err;
    } finally {
        if (config?.setViewerInstruction) config.setViewerInstruction(null);
    }
};

export const generateFluxImage = async (source: File | string, prompt: string, config?: ImageGenerationConfig): Promise<ImageGenerationResult> => {
    if (config?.setViewerInstruction) config.setViewerInstruction("TRANSFORMING_VISUAL_FLUX...");
    const ai = getAiClient();
    const modelId = sanitizeModel(config?.model || 'gemini-1.5-flash');
    const imagePart = await fileToPart(source, config?.setViewerInstruction);
    
    const model = ai.getGenerativeModel({
        model: modelId,
        systemInstruction: config?.systemInstructionOverride || PROTOCOLS.IMAGE_TRANSFORMER,
    });

    const result = await model.generateContent([prompt, imagePart]);
    return handleApiResponse(result.response, config?.setViewerInstruction);
};

export const generateFilteredImage = async (source: File | string, prompt: string, config?: ImageGenerationConfig): Promise<ImageGenerationResult> => {
    if (config?.setViewerInstruction) config.setViewerInstruction("APPLYING_NEURAL_FILTERS...");
    const ai = getAiClient();
    const modelId = sanitizeModel(config?.model || 'gemini-1.5-flash');
    const imagePart = await fileToPart(source, config?.setViewerInstruction);
    
    const model = ai.getGenerativeModel({
        model: modelId,
        systemInstruction: config?.systemInstructionOverride || PROTOCOLS.EDITOR,
    });
    
    const result = await model.generateContent([prompt, imagePart]);
    return handleApiResponse(result.response, config?.setViewerInstruction);
};

export const extractStyleFromImage = async (imageFile: File | string, setViewerInstruction?: (text: string | null) => void): Promise<RoutedStyle> => {
    if (setViewerInstruction) setViewerInstruction("SEQUENCING_VISUAL_DNA...");
    const ai = getAiClient();
    const imagePart = await fileToPart(imageFile, setViewerInstruction);
    const modelId = 'gemini-1.5-flash';
    
    const model = ai.getGenerativeModel({
        model: modelId,
        systemInstruction: PROTOCOLS.STYLE_ROUTER,
        generationConfig: {
            responseMimeType: "application/json",
            responseSchema: {
                type: SchemaType.OBJECT,
                properties: {
                    target_panel_id: { 
                        type: SchemaType.STRING, 
                        enum: ['filter_panel', 'vector_art_panel', 'typographic_panel'] 
                    } as any,
                    preset_data: {
                        type: SchemaType.OBJECT,
                        properties: { 
                            name: { type: SchemaType.STRING }, 
                            description: { type: SchemaType.STRING }, 
                            prompt: { type: SchemaType.STRING } 
                        },
                        required: ['name', 'description', 'prompt']
                    }
                },
                required: ['target_panel_id', 'preset_data']
            }
        }
    });

    const result = await model.generateContent(["Extract Visual DNA and route to target module.", imagePart]);
    return JSON.parse(result.response.text() || '{}');
};

export const describeImageForPrompt = async (imageFile: File | string, setViewerInstruction?: (text: string | null) => void): Promise<string> => {
    if (setViewerInstruction) setViewerInstruction("ANALYZING_IMAGE_GEOMETRY...");
    const ai = getAiClient();
    const imagePart = await fileToPart(imageFile, setViewerInstruction);
    const modelId = 'gemini-1.5-flash';
    
    const model = ai.getGenerativeModel({ model: modelId });
    const result = await model.generateContent(["Describe the core subject and aesthetic of this image for a synthesis prompt.", imagePart]);
    return result.response.text() || "";
};
