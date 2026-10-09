/** Longest step a game ever sees; a tab coming back from the background must not teleport anything. */
export const MAX_DT = 1 / 20;

export interface Raf {
  request(cb: FrameRequestCallback): number;
  cancel(id: number): void;
}

export interface Loop {
  start(): void;
  stop(): void;
  readonly running: boolean;
}

const browserRaf: Raf = {
  request: (cb) => requestAnimationFrame(cb),
  cancel: (id) => cancelAnimationFrame(id),
};

export function clampDt(ms: number): number {
  return Math.min(MAX_DT, Math.max(0, ms / 1000));
}

/** Calls tick(dt, t) every frame; dt and t are in seconds. */
export function createLoop(tick: (dt: number, t: number) => void, raf: Raf = browserRaf): Loop {
  let id = 0;
  let last = -1;
  let running = false;

  const frame = (now: number) => {
    if (!running) return;
    const dt = last < 0 ? 0 : clampDt(now - last);
    last = now;
    id = raf.request(frame);
    tick(dt, now / 1000);
  };

  return {
    start() {
      if (running) return;
      running = true;
      last = -1;
      id = raf.request(frame);
    },
    stop() {
      if (!running) return;
      running = false;
      raf.cancel(id);
    },
    get running() {
      return running;
    },
  };
}
