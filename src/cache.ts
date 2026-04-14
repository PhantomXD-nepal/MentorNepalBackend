/**
 * Custom In-Memory Cache with LRU-style eviction and TTL support
 * Built from scratch for read-heavy data caching
 */

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
  lastAccessed: number;
}

interface CacheOptions {
  maxSize?: number; // Maximum number of entries (LRU eviction)
  defaultTTL?: number; // Default TTL in milliseconds
}

class Cache {
  private store: Map<string, CacheEntry<unknown>>;
  private maxSize: number;
  private defaultTTL: number;

  constructor(options: CacheOptions = {}) {
    this.store = new Map();
    this.maxSize = options.maxSize ?? 1000;
    this.defaultTTL = options.defaultTTL ?? 5 * 60 * 1000; // 5 minutes default
  }

  /**
   * Get a value from cache
   * Returns undefined if not found or expired
   */
  get<T>(key: string): T | undefined {
    const entry = this.store.get(key);

    if (!entry) {
      return undefined;
    }

    // Check if expired
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return undefined;
    }

    // Update last accessed time for LRU tracking
    entry.lastAccessed = Date.now();
    return entry.value as T;
  }

  /**
   * Set a value in cache with optional custom TTL (in milliseconds)
   */
  set<T>(key: string, value: T, ttlMs?: number): void {
    const now = Date.now();

    // Evict oldest entry if at capacity and adding new key
    if (this.store.size >= this.maxSize && !this.store.has(key)) {
      this.evictLRU();
    }

    const entry: CacheEntry<T> = {
      value,
      expiresAt: now + (ttlMs ?? this.defaultTTL),
      lastAccessed: now,
    };

    this.store.set(key, entry);
  }

  /**
   * Check if a key exists and is not expired
   */
  has(key: string): boolean {
    const entry = this.store.get(key);

    if (!entry) {
      return false;
    }

    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return false;
    }

    return true;
  }

  /**
   * Delete a specific key from cache
   */
  delete(key: string): boolean {
    return this.store.delete(key);
  }

  /**
   * Clear all entries from cache
   */
  clear(): void {
    this.store.clear();
  }

  /**
   * Get cache size (including potentially expired entries)
   */
  size(): number {
    return this.store.size;
  }

  /**
   * Delete expired entries (cleanup job)
   * Returns number of expired entries removed
   */
  cleanup(): number {
    const now = Date.now();
    let removedCount = 0;

    for (const [key, entry] of this.store.entries()) {
      if (now > entry.expiresAt) {
        this.store.delete(key);
        removedCount++;
      }
    }

    return removedCount;
  }

  /**
   * Get all keys (excluding expired)
   */
  keys(): string[] {
    const validKeys: string[] = [];
    const now = Date.now();

    for (const [key, entry] of this.store.entries()) {
      if (now <= entry.expiresAt) {
        validKeys.push(key);
      }
    }

    return validKeys;
  }

  /**
   * Delete entries matching a pattern (uses simple string includes)
   * Useful for cache invalidation by prefix
   */
  deletePattern(pattern: string): number {
    let removedCount = 0;

    for (const key of this.store.keys()) {
      if (key.includes(pattern)) {
        this.store.delete(key);
        removedCount++;
      }
    }

    return removedCount;
  }

  /**
   * Evict the least recently used entry
   */
  private evictLRU(): void {
    let oldestKey: string | null = null;
    let oldestTime = Infinity;

    for (const [key, entry] of this.store.entries()) {
      if (entry.lastAccessed < oldestTime) {
        oldestTime = entry.lastAccessed;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.store.delete(oldestKey);
    }
  }
}

// Export singleton instance for application-wide caching
// TTLs based on techstack.md specifications:
// - mentors:list: 5 min
// - mentor:profile: 10 min
// - mentor:reviews: 10 min
// - mentor:availability: 2 min
// - stats:platform: 30 min
export const cache = new Cache({
  maxSize: 1000,
  defaultTTL: 5 * 60 * 1000, // 5 minutes
});

// Predefined TTL values (in milliseconds) for different cache types
export const CacheTTL = {
  MENTORS_LIST: 5 * 60 * 1000, // 5 minutes
  MENTOR_PROFILE: 10 * 60 * 1000, // 10 minutes
  MENTOR_REVIEWS: 10 * 60 * 1000, // 10 minutes
  MENTOR_AVAILABILITY: 2 * 60 * 1000, // 2 minutes
  PLATFORM_STATS: 30 * 60 * 1000, // 30 minutes
} as const;

// Helper functions for common cache key patterns
export const CacheKeys = {
  mentorsList: (page: number, filters: string): string =>
    `mentors:list:${page}:${filters}`,

  mentorProfile: (mentorId: string): string =>
    `mentor:profile:${mentorId}`,

  mentorReviews: (mentorId: string, page: number): string =>
    `mentor:reviews:${mentorId}:${page}`,

  mentorAvailability: (mentorId: string, weekStart: string): string =>
    `mentor:availability:${mentorId}:${weekStart}`,

  platformStats: (): string =>
    `stats:platform`,
};

export default Cache;
