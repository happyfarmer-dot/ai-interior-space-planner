/**
 * Local content-addressed cache for Gemini API requests.
 * Keys are generated from SHA-256 hash of (source image bytes + operation + JSON parameters + model).
 * Prevents duplicate API calls and redundant token charges when switching back to previously generated conditions.
 */

const memoryCache = new Map<string, unknown>();
const MAX_MEMORY_ENTRIES = 45;
const STORAGE_PREFIX = 'spatialmind_ai_cache_v1_';

function fallbackHash(str: string): string {
  let h1 = 0xdeadbeef ^ str.length;
  let h2 = 0x41c6ce57 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16);
}

export async function computeContentHash(content: string): Promise<string> {
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    try {
      const encoder = new TextEncoder();
      const buf = encoder.encode(content);
      const digest = await crypto.subtle.digest('SHA-256', buf);
      const bytes = new Uint8Array(digest);
      let hex = '';
      for (let i = 0; i < bytes.length; i++) {
        hex += bytes[i].toString(16).padStart(2, '0');
      }
      return hex.slice(0, 32);
    } catch {
      return fallbackHash(content);
    }
  }
  return fallbackHash(content);
}

export async function buildAiCacheKey(
  operation: string,
  imageContentOrUrl: string,
  params: Record<string, unknown>
): Promise<string> {
  const imageHash = await computeContentHash(imageContentOrUrl || 'no_img');
  const paramStr = JSON.stringify(params, Object.keys(params).sort());
  const paramHash = await computeContentHash(`${operation}::${paramStr}`);
  return `${operation}_${imageHash.slice(0, 16)}_${paramHash.slice(0, 16)}`;
}

export function getAiCacheEntry<T>(key: string): T | null {
  if (memoryCache.has(key)) {
    const val = memoryCache.get(key) as T;
    // Refresh LRU order
    memoryCache.delete(key);
    memoryCache.set(key, val);
    return structuredClone(val);
  }

  if (typeof window !== 'undefined' && window.sessionStorage) {
    try {
      const raw = window.sessionStorage.getItem(STORAGE_PREFIX + key);
      if (raw) {
        const parsed = JSON.parse(raw) as T;
        memoryCache.set(key, parsed);
        return structuredClone(parsed);
      }
    } catch {
      // ignore sessionStorage read errors
    }
  }
  return null;
}

export function setAiCacheEntry<T>(key: string, value: T): void {
  if (memoryCache.size >= MAX_MEMORY_ENTRIES) {
    const oldestKey = memoryCache.keys().next().value;
    if (oldestKey) memoryCache.delete(oldestKey);
  }
  const cloned = structuredClone(value);
  memoryCache.set(key, cloned);

  if (typeof window !== 'undefined' && window.sessionStorage) {
    try {
      const serialized = JSON.stringify(cloned);
      // Persist compact entries (< 450KB) to sessionStorage as well
      if (serialized.length < 450 * 1024) {
        window.sessionStorage.setItem(STORAGE_PREFIX + key, serialized);
      }
    } catch {
      // sessionStorage quota reached — memoryCache still holds entry
    }
  }
}

export function getAiCacheStats(): { entries: number } {
  return { entries: memoryCache.size };
}
