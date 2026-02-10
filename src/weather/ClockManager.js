(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.ClockManager = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  function clamp(n, min, max) {
    if (typeof n !== 'number' || isNaN(n)) return min;
    return Math.max(min, Math.min(max, n));
  }

  class Emitter {
    constructor() {
      this._m = new Map();
    }
    on(t, fn) {
      if (!this._m.has(t)) this._m.set(t, new Set());
      this._m.get(t).add(fn);
      return () => this.off(t, fn);
    }
    off(t, fn) {
      const s = this._m.get(t);
      if (!s) return;
      s.delete(fn);
      if (s.size === 0) this._m.delete(t);
    }
    emit(t, v) {
      const s = this._m.get(t);
      if (!s) return;
      for (const fn of Array.from(s)) {
        try { fn(v); } catch (_) {}
      }
    }
  }

  function defaultNow() {
    return Date.now();
  }

  function defaultRAF(cb) {
    const id = setTimeout(() => cb(defaultNow()), 16);
    return id;
  }

  function defaultCAF(id) {
    clearTimeout(id);
  }

  function defaultVisibility() {
    if (typeof document !== 'undefined' && typeof document.hidden === 'boolean') return document.hidden;
    return false;
  }

  class ClockManager {
    constructor(opts = {}) {
      const {
        mode = 'realtime',
        rate = 1,
        startTime = null,
        now = defaultNow,
        raf = (typeof requestAnimationFrame !== 'undefined' ? requestAnimationFrame.bind(globalThis) : defaultRAF),
        caf = (typeof cancelAnimationFrame !== 'undefined' ? cancelAnimationFrame.bind(globalThis) : defaultCAF),
        visibilityProvider = defaultVisibility,
        hiddenInterval = 500,
      } = opts;

      this._mode = mode === 'simulation' ? 'simulation' : 'realtime';
      this._rate = clamp(rate, 0.5, 10);
      this._now = now;
      this._raf = raf;
      this._caf = caf;
      this._vis = visibilityProvider;
      this._hiddenInterval = Math.max(50, hiddenInterval | 0);

      this._em = new Emitter();
      this._rid = null;
      this._running = false;
      this._lastWall = null;
      this._lastEmit = 0;
      this._simTime = startTime != null ? startTime : null;

      if (this._mode === 'simulation' && this._simTime == null) {
        this._simTime = this._now();
      }

      this._boundFrame = (ts) => this._onFrame(ts);
    }

    start() {
      if (this._running) return;
      this._running = true;
      this._lastWall = this._now();
      this._schedule();
    }

    stop() {
      if (!this._running) return;
      this._running = false;
      if (this._rid != null) {
        this._caf(this._rid);
        this._rid = null;
      }
    }

    _schedule() {
      this._rid = this._raf(this._boundFrame);
    }

    _onFrame(ts) {
      if (!this._running) return;
      const now = this._now();
      const wallDt = this._lastWall == null ? 0 : Math.max(0, now - this._lastWall);
      this._lastWall = now;

      let cur;
      let simDt = 0;
      if (this._mode === 'realtime') {
        cur = now;
      } else {
        if (this._simTime == null) this._simTime = now;
        simDt = wallDt * this._rate;
        this._simTime += simDt;
        cur = this._simTime;
      }

      const hidden = !!this._vis();
      if (hidden) {
        if (now - this._lastEmit < this._hiddenInterval) {
          this._schedule();
          return;
        }
      }
      this._lastEmit = now;
      this._em.emit('tick', { time: Math.round(cur), mode: this._mode, rate: this._rate, wallDt, simDt, hidden });
      this._schedule();
    }

    on(t, fn) { return this._em.on(t, fn); }
    off(t, fn) { return this._em.off(t, fn); }

    now() {
      if (this._mode === 'realtime') return this._now();
      return this._simTime != null ? this._simTime : this._now();
    }

    setMode(mode) {
      const m = mode === 'simulation' ? 'simulation' : 'realtime';
      if (m === this._mode) return;
      if (m === 'simulation' && this._simTime == null) this._simTime = this._now();
      this._mode = m;
      this._em.emit('mode', { mode: this._mode, time: this.now() });
    }

    setRate(rate) {
      const r = clamp(rate, 0.5, 10);
      if (r === this._rate) return;
      this._rate = r;
      this._em.emit('rate', { rate: this._rate });
    }

    setTime(ms) {
      const v = Math.max(0, Math.floor(ms));
      this._simTime = v;
      this._em.emit('timeSet', { time: v });
    }

    get mode() { return this._mode; }
    get rate() { return this._rate; }
  }

  return ClockManager;
});
