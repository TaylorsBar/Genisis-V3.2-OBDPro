
let memoryCache = new Map<string, any>();

export async function getCachedData<T>(key: string): Promise<T | null> {
  if (typeof window === 'undefined') {
    return memoryCache.get(key) || null;
  }
  try {
    const { get } = await import('idb-keyval');
    const val = await get<T>(key);
    return val !== undefined ? val : null;
  } catch (error) {
    console.error(`Error reading from cache for ${key}:`, error);
    return null;
  }
}

export async function setCachedData<T>(key: string, data: T): Promise<void> {
  if (typeof window === 'undefined') {
    memoryCache.set(key, data);
    return;
  }
  try {
    const { set } = await import('idb-keyval');
    await set(key, data);
  } catch (error) {
    console.error(`Error saving to cache for ${key}:`, error);
  }
}
