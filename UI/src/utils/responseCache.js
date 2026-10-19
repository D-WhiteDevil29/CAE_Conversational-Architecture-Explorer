const CACHE_PREFIX = 'cae_cache_';
const CACHE_EXPIRY_HOURS = 24; // Cache expires after 24 hours
const MAX_CACHE_ENTRIES = 50;

function cleanupExpiredCache() {
  const now = Date.now();
  const keys = Object.keys(localStorage).filter(key => key.startsWith(CACHE_PREFIX));
  
  keys.forEach(key => {
    try {
      const item = localStorage.getItem(key);
      if (item) {
        const parsed = JSON.parse(item);
        if (parsed.expiresAt && parsed.expiresAt < now) {
          localStorage.removeItem(key);
        }
      }
    } catch (error) {
      localStorage.removeItem(key);
    }
  });
}

function limitCacheSize() {
  const keys = Object.keys(localStorage).filter(key => key.startsWith(CACHE_PREFIX));
  
  if (keys.length > MAX_CACHE_ENTRIES) {
    const entries = keys.map(key => {
      try {
        const item = localStorage.getItem(key);
        const parsed = JSON.parse(item);
        return { key, timestamp: parsed.timestamp || 0 };
      } catch {
        return { key, timestamp: 0 };
      }
    }).sort((a, b) => a.timestamp - b.timestamp);
    
    const toRemove = entries.slice(0, entries.length - MAX_CACHE_ENTRIES);
    toRemove.forEach(entry => localStorage.removeItem(entry.key));
  }
}

function generateCacheKey(query) {
  const normalized = query.toLowerCase().trim();
  return `${CACHE_PREFIX}${btoa(encodeURIComponent(normalized)).substring(0, 50)}`;
}

export function getCachedResponse(query) {
  cleanupExpiredCache();
  
  const key = generateCacheKey(query);
  const item = localStorage.getItem(key);
  
  if (!item) return null;
  
  try {
    const parsed = JSON.parse(item);
    const now = Date.now();
    
    if (parsed.expiresAt && parsed.expiresAt < now) {
      localStorage.removeItem(key);
      return null;
    }
    
    parsed.accessCount = (parsed.accessCount || 0) + 1;
    parsed.lastAccessed = now;
    localStorage.setItem(key, JSON.stringify(parsed));
    
    return parsed.response;
  } catch (error) {
    console.error('Error reading cache:', error);
    localStorage.removeItem(key);
    return null;
  }
}

export function cacheResponse(query, response) {
  try {
    const key = generateCacheKey(query);
    const now = Date.now();
    const expiryMs = CACHE_EXPIRY_HOURS * 60 * 60 * 1000;
    
    const cacheEntry = {
      query: query.substring(0, 100),
      response,
      timestamp: now,
      expiresAt: now + expiryMs,
      accessCount: 1,
      lastAccessed: now,
    };
    
    localStorage.setItem(key, JSON.stringify(cacheEntry));
    limitCacheSize();
    
    console.log(`Cached response for query (expires in ${CACHE_EXPIRY_HOURS}h)`);
  } catch (error) {
    console.error('Error caching response:', error);
    if (error.name === 'QuotaExceededError') {
      cleanupExpiredCache();
      limitCacheSize();
    }
  }
}

export function clearAllCache() {
  const keys = Object.keys(localStorage).filter(key => key.startsWith(CACHE_PREFIX));
  keys.forEach(key => localStorage.removeItem(key));
  console.log(`Cleared ${keys.length} cache entries`);
}

export function getCacheStats() {
  const keys = Object.keys(localStorage).filter(key => key.startsWith(CACHE_PREFIX));
  
  let totalSize = 0;
  let totalAccess = 0;
  
  keys.forEach(key => {
    try {
      const item = localStorage.getItem(key);
      totalSize += item.length;
      const parsed = JSON.parse(item);
      totalAccess += parsed.accessCount || 0;
    } catch {
    }
  });
  
  return {
    entries: keys.length,
    totalSizeKB: (totalSize / 1024).toFixed(2),
    totalAccess,
    maxEntries: MAX_CACHE_ENTRIES,
    expiryHours: CACHE_EXPIRY_HOURS,
  };
}

cleanupExpiredCache();
