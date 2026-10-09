export interface Stage {
  canvas: HTMLCanvasElement;
  g: CanvasRenderingContext2D;
  /** size in CSS pixels; drawing code uses these units */
  w: number;
  h: number;
  dpr: number;
  onResize(cb: (s: Stage) => void): void;
  destroy(): void;
}

export function fitSize(cssW: number, cssH: number, dpr: number, maxDpr: number) {
  const d = dpr > 0 ? Math.min(dpr, maxDpr) : 1;
  const w = Math.max(1, Math.round(cssW));
  const h = Math.max(1, Math.round(cssH));
  return { w, h, dpr: d, pxW: Math.max(1, Math.round(w * d)), pxH: Math.max(1, Math.round(h * d)) };
}

/** A canvas filling root, kept sharp on high-DPI screens and refitted on every resize. */
export function createStage(root: HTMLElement, opts: { maxDpr?: number; alpha?: boolean } = {}): Stage {
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block;touch-action:none';
  root.appendChild(canvas);
  const g = canvas.getContext('2d', { alpha: opts.alpha ?? false })!;
  const listeners: ((s: Stage) => void)[] = [];

  const stage: Stage = {
    canvas,
    g,
    w: 1,
    h: 1,
    dpr: 1,
    onResize: (cb) => void listeners.push(cb),
    destroy: () => {
      ro.disconnect();
      canvas.remove();
    },
  };

  const fit = () => {
    const r = root.getBoundingClientRect();
    const f = fitSize(r.width, r.height, window.devicePixelRatio, opts.maxDpr ?? 2);
    if (f.pxW === canvas.width && f.pxH === canvas.height && f.w === stage.w && f.h === stage.h) return;
    stage.w = f.w;
    stage.h = f.h;
    stage.dpr = f.dpr;
    canvas.width = f.pxW;
    canvas.height = f.pxH;
    g.setTransform(f.dpr, 0, 0, f.dpr, 0, 0);
    for (const cb of listeners) cb(stage);
  };

  const ro = new ResizeObserver(fit);
  ro.observe(root);
  fit();
  return stage;
}
