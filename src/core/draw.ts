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
