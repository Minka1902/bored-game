// All persistence goes through Store so a cloud-synced backend can replace localStorage later.
// An in-memory mirror keeps the app working when storage is blocked, full or corrupt.

export interface KV {
  getItem(k: string): string | null;
  setItem(k: string, v: string): void;
  removeItem(k: string): void;
}

export interface ScopedStore {
  get<T>(key: string, fallback: T): T;
  set(key: string, v: unknown): void;
}

function defaultBackend(): KV | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

export class Store {
  private mem = new Map<string, unknown>();

  constructor(
    private backend: KV | null = defaultBackend(),
    private prefix = 'bg1:',
  ) {}

  get<T>(key: string, fallback: T): T {
    if (this.mem.has(key)) return this.mem.get(key) as T;
    let raw: string | null = null;
    try {
      raw = this.backend?.getItem(this.prefix + key) ?? null;
    } catch {
      return fallback;
    }
    if (raw == null) return fallback;
    try {
      const v = JSON.parse(raw) as T;
      this.mem.set(key, v);
      return v;
    } catch {
      return fallback;
    }
  }

  set(key: string, v: unknown): void {
    this.mem.set(key, v);
    try {
      this.backend?.setItem(this.prefix + key, JSON.stringify(v));
    } catch {
      // quota exceeded or storage disabled: the in-memory copy still serves this session
    }
  }

  remove(key: string): void {
    this.mem.delete(key);
    try {
      this.backend?.removeItem(this.prefix + key);
    } catch {
      // ignore
    }
  }

  scoped(gameId: string): ScopedStore {
    return {
      get: (k, fallback) => this.get(`g:${gameId}:${k}`, fallback),
      set: (k, v) => this.set(`g:${gameId}:${k}`, v),
    };
  }
}
