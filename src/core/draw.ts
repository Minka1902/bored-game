const FAMILY = "ui-rounded, 'SF Pro Rounded', 'Arial Rounded MT Bold', system-ui, sans-serif";

export const font = (px: number, weight = 900): string => `${weight} ${Math.round(px)}px ${FAMILY}`;

/** Centered (by default) text in one call. */
export function text(
  g: CanvasRenderingContext2D,
  str: string,
  x: number,
  y: number,
  px: number,
  color: string,
  align: CanvasTextAlign = 'center',
  weight = 900,
): void {
  g.font = font(px, weight);
  g.fillStyle = color;
  g.textAlign = align;
  g.textBaseline = 'middle';
  g.fillText(str, x, y);
}

/** Offscreen canvas drawn once at device resolution; draw it back with drawImage(c, x - size/2, y - size/2, size, size). */
export function sprite(size: number, dpr: number, draw: (g: CanvasRenderingContext2D) => void): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = c.height = Math.max(1, Math.ceil(size * dpr));
  const g = c.getContext('2d')!;
  g.scale(dpr, dpr);
  draw(g);
  return c;
}
