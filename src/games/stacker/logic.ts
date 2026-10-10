export interface Span {
  x: number;
  w: number;
}

export interface SliceResult {
  placed: Span | null;
  cut: Span | null;
  perfect: boolean;
}

/** Drops cur onto prev: keeps the overlap, slices off the overhang, snaps drops within tol pixels. */
export function sliceSlab(prev: Span, cur: Span, tol = 4): SliceResult {
  if (Math.abs(cur.x - prev.x) <= tol) return { placed: { x: prev.x, w: prev.w }, cut: null, perfect: true };
  const left = Math.max(prev.x, cur.x);
  const right = Math.min(prev.x + prev.w, cur.x + cur.w);
  if (right <= left) return { placed: null, cut: { ...cur }, perfect: false };
  const cut = cur.x > prev.x ? { x: right, w: cur.x + cur.w - right } : { x: cur.x, w: left - cur.x };
  return { placed: { x: left, w: right - left }, cut, perfect: false };
}
