/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

const DB_NAME = 'PixshopDB';
const DB_VERSION = 3; // Bumped to 3 to force schema validation and recovery
const STORE_NAME = 'history';
const PRESETS_STORE = 'style_presets';
const CONFIG_STORE = 'app_config'; // New store for application-wide configs like custom drone audio

// Removed dataUrlToBlob as it is no longer used.

interface SerializedFile {
    name: string;
    type: string;
    lastModified: number;
    data: Blob | string; // data can be a Blob (for uploaded files) or a data URI string (for generated images)
}

interface StoredAppState {
    id: string;
    history: SerializedFile[];
    historyIndex: number;
    activeTab: string;
    hakiEnabled?: boolean;
    hakiColor?: string;
    hakiSize?: number;
    hakiSpeed?: number;
    isPlatinumTier?: boolean;
    timestamp: number;
}

interface AppState {
    history: (File | string)[];
    historyIndex: number;
    activeTab: string;
    hakiEnabled?: boolean;
    hakiColor?: string;
    hakiSize?: number;
    hakiSpeed?: number;
    isPlatinumTier?: boolean;
}

const openDB = (): Promise<IDBDatabase> => {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = (event) => {
            const db = (event.target as IDBOpenDBRequest).result;
            
            // Store 1: Session History
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME, { keyPath: 'id' });
            }

            // Store 2: Style Presets
            if (!db.objectStoreNames.contains(PRESETS_STORE)) {
                db.createObjectStore(PRESETS_STORE, { keyPath: 'id' });
            }

            // Store 3: App Config (for custom drone audio)
            if (!db.objectStoreNames.contains(CONFIG_STORE)) {
                db.createObjectStore(CONFIG_STORE, { keyPath: 'id' });
            }
        };

        request.onsuccess = (event) => {
            resolve((event.target as IDBOpenDBRequest).result);
        };

        request.onerror = (event) => {
            reject((event.target as IDBOpenDBRequest).error);
        };
    });
};

// Helper function to handle IndexedDB operations
const withStore = async <T>(storeName: string, mode: IDBTransactionMode, callback: (store: IDBObjectStore) => Promise<T>): Promise<T> => {
    const db = await openDB();
    const tx = db.transaction(storeName, mode);
    const store = tx.objectStore(storeName);
    const result = await callback(store);
    await new Promise((resolve, reject) => {
        tx.oncomplete = () => resolve(undefined as T); // Resolve with undefined as T might not be needed after callback
        tx.onerror = () => reject(tx.error);
    });
    return result;
};


export const saveState = async (
    history: (File | string)[], 
    historyIndex: number, 
    activeTab: string, 
    hakiEnabled: boolean,
    hakiColor: string = '#DB24E3',
    hakiSize: number = 1,
    hakiSpeed: number = 1,
    isPlatinumTier: boolean = true
): Promise<void> => {
    try {
        const serializedHistory: SerializedFile[] = await Promise.all(history.map(async (item) => {
            if (typeof item === 'string') {
                // If it's a data URL, store it directly as a string
                // Remote URLs are not explicitly handled here for persistence.
                return {
                    name: `generated-${Date.now()}.png`,
                    type: item.match(/:(.*?);/)?.[1] || 'image/png', // Extract mime type
                    lastModified: Date.now(),
                    data: item, // Store data URL as string
                };
            } else { // It's a File
                return {
                    name: item.name,
                    type: item.type,
                    lastModified: item.lastModified,
                    data: item, // IndexedDB will store the File as a Blob
                };
            }
        }));

        const db = await openDB();
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        
        const state: StoredAppState = {
            id: 'current',
            history: serializedHistory,
            historyIndex,
            activeTab,
            hakiEnabled,
            hakiColor,
            hakiSize,
            hakiSpeed,
            isPlatinumTier,
            timestamp: Date.now()
        };

        const request = store.put(state);
        
        return new Promise((resolve, reject) => {
            request.onsuccess = () => resolve();
            request.onerror = () => {
                console.error("IndexedDB Put Error:", request.error);
                reject(request.error);
            };
            tx.onerror = () => reject(tx.error);
        });
    } catch (e) {
        console.error("Persistence save failed:", e instanceof Error ? e.message : e);
        throw e;
    }
};

export const loadState = async (): Promise<AppState | null> => {
    try {
        const db = await openDB();
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const request = store.get('current');

        return new Promise((resolve, reject) => {
            request.onsuccess = () => {
                const result = request.result as StoredAppState | undefined;
                if (result) {
                    const history = result.history.map(f => {
                        if (typeof f.data === 'string') {
                            // It was stored as a data URL string
                            return f.data;
                        } else {
                            // It was stored as a File, which IndexedDB stores as a Blob.
                            // Convert the Blob back to a File object for consistency.
                            return new File([f.data], f.name, {type: f.type, lastModified: f.lastModified});
                        }
                    });
                    resolve({ ...result, history });
                } else {
                    resolve(null);
                }
            };
            request.onerror = () => reject(request.error);
        });
    } catch (e) {
        console.error("Persistence load failed:", e instanceof Error ? e.message : e);
        throw e;
    }
};

// --- Preset Management ---

interface UserPreset {
    id: string;
    name: string;
    description: string;
    applyPrompt: string;
    genPrompt?: string; // For vector presets
    recommendedPanel: string;
    isCustom: boolean;
    timestamp: number;
}

export const loadUserPresets = async (): Promise<UserPreset[]> => {
    return withStore(PRESETS_STORE, 'readonly', (store) => {
        return new Promise((resolve, reject) => {
            const request = store.getAll();
            request.onsuccess = () => resolve(request.result as UserPreset[]);
            request.onerror = () => reject(request.error);
        });
    });
};

export const addUserPreset = async (preset: UserPreset): Promise<void> => {
    return withStore(PRESETS_STORE, 'readwrite', (store) => {
        return new Promise((resolve, reject) => {
            const request = store.add(preset);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    });
};

export const deleteUserPreset = async (id: string): Promise<void> => {
    return withStore(PRESETS_STORE, 'readwrite', (store) => {
        return new Promise((resolve, reject) => {
            const request = store.delete(id);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    });
};

export const saveUserPresets = async (presets: UserPreset[]): Promise<void> => {
    return withStore(PRESETS_STORE, 'readwrite', async (store) => {
        await new Promise<void>((resolve, reject) => {
            const clearRequest = store.clear();
            clearRequest.onsuccess = () => resolve();
            clearRequest.onerror = () => reject(clearRequest.error);
        });
        for (const preset of presets) {
            await new Promise<void>((resolve, reject) => {
                const addRequest = store.add(preset);
                addRequest.onsuccess = () => resolve();
                addRequest.onerror = () => reject(addRequest.error);
            });
        }
    });
};

// --- Custom Drone Audio Management ---

const CUSTOM_DRONE_KEY = 'customDrone';

export const saveCustomDroneAudio = async (base64Audio: string): Promise<void> => {
    return withStore(CONFIG_STORE, 'readwrite', (store) => {
        return new Promise((resolve, reject) => {
            const request = store.put({ id: CUSTOM_DRONE_KEY, data: base64Audio, timestamp: Date.now() });
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    });
};

export const loadCustomDroneAudio = async (): Promise<string | null> => {
    return withStore(CONFIG_STORE, 'readonly', (store) => {
        return new Promise((resolve, reject) => {
            const request = store.get(CUSTOM_DRONE_KEY);
            request.onsuccess = () => resolve(request.result ? request.result.data : null);
            request.onerror = () => reject(request.error);
        });
    });
};

export const clearCustomDroneAudio = async (): Promise<void> => {
    return withStore(CONFIG_STORE, 'readwrite', (store) => {
        return new Promise((resolve, reject) => {
            const request = store.delete(CUSTOM_DRONE_KEY);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    });
};

// --- Global State Management ---

export const clearState = async (): Promise<void> => {
    return withStore(STORE_NAME, 'readwrite', (store) => {
        return new Promise((resolve, reject) => {
            const request = store.clear();
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    });
};

export const nukeDatabase = async (): Promise<void> => {
    return new Promise((resolve, reject) => {
        const request = indexedDB.deleteDatabase(DB_NAME);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
};