const { inc } = require('./metrics');

class LruTtlCache {
  constructor({ name = 'cache', ttlMs = 60000, maxSize = 100 } = {}) {
    this.name = String(name);
    this.defaultTtlMs = Math.max(1, ttlMs | 0);
    this.maxSize = Math.max(1, maxSize | 0);
    this.store = new Map();
    this.pending = new Map();
  }

  _now() {
    return Date.now();
  }

  _evictIfNeeded() {
    while (this.store.size > this.maxSize) {
      const oldestKey = this.store.keys().next().value;
      this.store.delete(oldestKey);
      inc('cache_eviction', { cache: this.name });
    }
  }

  _isFresh(entry) {
    if (!entry) return false;
    return (this._now() - entry.ts) < entry.ttlMs;
    
  }

  has(key) {
    const e = this.store.get(key);
    return this._isFresh(e);
  }

  ts(key) {
    const e = this.store.get(key);
    return e ? e.ts : 0;
  }

  peek(key) {
    const e = this.store.get(key);
    if (!this._isFresh(e)) return undefined;
    return e.value;
  }

  get(key) {
    const e = this.store.get(key);
    if (!this._isFresh(e)) return undefined;
    // mark as recently used
    this.store.delete(key);
    this.store.set(key, e);
    inc('cache_hit', { cache: this.name });
    return e.value;
  }

  set(key, value, { ttlMs } = {}) {
    const entry = { value, ts: this._now(), ttlMs: Math.max(1, (ttlMs ?? this.defaultTtlMs) | 0) };
    if (this.store.has(key)) this.store.delete(key);
    this.store.set(key, entry);
    this._evictIfNeeded();
    return value;
  }

  async getOrLoad(key, loader, { ttlMs } = {}) {
    const fresh = this.get(key);
    if (fresh !== undefined) return fresh;

    if (this.pending.has(key)) return this.pending.get(key);

    const p = (async () => {
      try {
        inc('cache_miss', { cache: this.name });
        const v = await loader();
        this.set(key, v, { ttlMs });
        return v;
      } finally {
        this.pending.delete(key);
      }
    })();

    this.pending.set(key, p);
    return p;
  }

  delete(key) {
    return this.store.delete(key);
  }

  clear() {
    this.store.clear();
    this.pending.clear();
  }
}

module.exports = { LruTtlCache };
