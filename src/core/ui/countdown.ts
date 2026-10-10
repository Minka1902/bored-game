/**
 * A timed-round clock for DOM games: a bar that drains over `total` seconds once start() is called.
 * Hidden-tab time is not counted (pause/resume), and penalize() takes seconds off.
 */
export interface Countdown {
  el: HTMLElement;
  start(): void;
  reset(): void;
  penalize(s: number): void;
  pause(): void;
  resume(): void;
  destroy(): void;
  readonly running: boolean;
}

export function createCountdown(total: number, onEnd: () => void): Countdown {
  const el = document.createElement('div');
  el.style.cssText = 'width:min(420px,100%);height:10px;border-radius:5px;background:#2a1b4f;overflow:hidden;flex:none';
  const fill = document.createElement('div');
  fill.style.cssText = 'height:100%;background:#34d399;transform-origin:left;transition:background .2s';
  el.appendChild(fill);

  let left = total;
  let running = false;
  let paused = false;
  let last = 0;
  let raf = 0;

  const paint = () => {
    fill.style.transform = `scaleX(${Math.max(0, left / total)})`;
    fill.style.background = left < total * 0.25 ? '#ff4d6d' : '#34d399';
  };

  const frame = (now: number) => {
    raf = requestAnimationFrame(frame);
    if (running && !paused) {
      left -= Math.min(0.1, (now - last) / 1000);
      paint();
      if (left <= 0) {
        left = 0;
        running = false;
        paint();
        onEnd();
      }
    }
    last = now;
  };
  raf = requestAnimationFrame(frame);
  paint();

  return {
    el,
    start() {
      if (running) return;
      running = true;
      last = performance.now();
    },
    reset() {
      left = total;
      running = false;
      paint();
    },
    penalize(s) {
      left = Math.max(0.01, left - s);
      paint();
    },
    pause: () => (paused = true),
    resume: () => (paused = false),
    destroy: () => cancelAnimationFrame(raf),
    get running() {
      return running;
    },
  };
}
