export type Route = { name: 'home' } | { name: 'play'; id: string };

const PLAY = /^#\/play\/(.+)$/;

export function parseRoute(hash: string): Route {
  const m = PLAY.exec(hash);
  if (!m) return { name: 'home' };
  try {
    return { name: 'play', id: decodeURIComponent(m[1]) };
  } catch {
    return { name: 'home' };
  }
}

export const playHref = (id: string): string => `#/play/${encodeURIComponent(id)}`;

/** Calls render now and on every hash change. Returns a disposer. */
export function startRouter(render: (r: Route) => void): () => void {
  const go = () => render(parseRoute(location.hash));
  window.addEventListener('hashchange', go);
  go();
  return () => window.removeEventListener('hashchange', go);
}
