// Hash router: works offline and from any static host path.
import { useSyncExternalStore } from 'react';

export interface Route {
  path: string;
  params: URLSearchParams;
  /** Everything after the path segment, e.g. the share payload. */
  rest: string;
}

function parse(): Route {
  const h = window.location.hash.replace(/^#/, '') || '/';
  const [pathPart, query = ''] = h.split('?');
  const segs = (pathPart ?? '/').split('/').filter(Boolean);
  return { path: `/${segs[0] ?? ''}`, rest: segs.slice(1).join('/'), params: new URLSearchParams(query) };
}

let current = parse();
const subs = new Set<() => void>();
window.addEventListener('hashchange', () => {
  current = parse();
  subs.forEach((s) => s());
  window.scrollTo(0, 0);
});

export function useRoute(): Route {
  return useSyncExternalStore(
    (l) => {
      subs.add(l);
      return () => subs.delete(l);
    },
    () => current,
  );
}

export function go(path: string, params?: Record<string, string | undefined>): void {
  const q = params
    ? new URLSearchParams(Object.entries(params).filter((e): e is [string, string] => e[1] !== undefined)).toString()
    : '';
  window.location.hash = `#${path}${q ? `?${q}` : ''}`;
}
