/** A tracked pointer in element-local CSS pixels: start (sx, sy), previous (px, py) and current (x, y). */
export interface Ptr {
  id: number;
  x: number;
  y: number;
  sx: number;
  sy: number;
  px: number;
  py: number;
  /** time of pointerdown and of the latest event, in ms */
  t0: number;
  t: number;
}

export interface PointerHandlers {
  down?(p: Ptr): void;
  move?(p: Ptr): void;
  up?(p: Ptr): void;
  /** mouse movement with no button pressed */
  hover?(x: number, y: number): void;
}

export type SwipeDir = 'up' | 'down' | 'left' | 'right';

export class PointerTracker {
  private ptrs = new Map<number, Ptr>();

  get count(): number {
    return this.ptrs.size;
  }

  down(id: number, x: number, y: number, t: number): Ptr {
    const p: Ptr = { id, x, y, sx: x, sy: y, px: x, py: y, t0: t, t };
    this.ptrs.set(id, p);
    return p;
  }

  move(id: number, x: number, y: number, t: number): Ptr | null {
    const p = this.ptrs.get(id);
    if (!p) return null;
    p.px = p.x;
    p.py = p.y;
    p.x = x;
    p.y = y;
    p.t = t;
    return p;
  }

  up(id: number, x: number, y: number, t: number): Ptr | null {
    const p = this.move(id, x, y, t);
    if (p) this.ptrs.delete(id);
    return p;
  }
}

export function swipeDir(dx: number, dy: number, min = 30): SwipeDir | null {
  if (Math.max(Math.abs(dx), Math.abs(dy)) < min) return null;
  if (Math.abs(dx) > Math.abs(dy)) return dx > 0 ? 'right' : 'left';
  return dy > 0 ? 'down' : 'up';
}

/** Wires pointer events on el to handlers with multi-touch tracking. Returns a disposer. */
export function bindPointers(el: HTMLElement, h: PointerHandlers): () => void {
  const tracker = new PointerTracker();
  let rect = el.getBoundingClientRect();
  const local = (e: PointerEvent) => [e.clientX - rect.left, e.clientY - rect.top] as const;

  const onDown = (e: PointerEvent) => {
    if (e.button > 0) return;
    e.preventDefault();
    rect = el.getBoundingClientRect();
    try {
      el.setPointerCapture(e.pointerId);
    } catch {
      // synthetic events cannot be captured
    }
    const [x, y] = local(e);
    h.down?.(tracker.down(e.pointerId, x, y, e.timeStamp));
  };
  const onMove = (e: PointerEvent) => {
    const [x, y] = local(e);
    const p = tracker.move(e.pointerId, x, y, e.timeStamp);
    if (p) h.move?.(p);
    else if (e.pointerType === 'mouse') {
      rect = el.getBoundingClientRect();
      const [hx, hy] = local(e);
      h.hover?.(hx, hy);
    }
  };
  const onUp = (e: PointerEvent) => {
    const [x, y] = local(e);
    const p = tracker.up(e.pointerId, x, y, e.timeStamp);
    if (p) h.up?.(p);
  };
  const noMenu = (e: Event) => e.preventDefault();

  el.addEventListener('pointerdown', onDown);
  el.addEventListener('pointermove', onMove);
  el.addEventListener('pointerup', onUp);
  el.addEventListener('pointercancel', onUp);
  el.addEventListener('contextmenu', noMenu);
  return () => {
    el.removeEventListener('pointerdown', onDown);
    el.removeEventListener('pointermove', onMove);
    el.removeEventListener('pointerup', onUp);
    el.removeEventListener('pointercancel', onUp);
    el.removeEventListener('contextmenu', noMenu);
  };
}

/** Maps arrow keys and WASD to swipe directions. */
export function keyDir(e: KeyboardEvent): SwipeDir | null {
  switch (e.key) {
    case 'ArrowUp': case 'w': case 'W': return 'up';
    case 'ArrowDown': case 's': case 'S': return 'down';
    case 'ArrowLeft': case 'a': case 'A': return 'left';
    case 'ArrowRight': case 'd': case 'D': return 'right';
    default: return null;
  }
}
