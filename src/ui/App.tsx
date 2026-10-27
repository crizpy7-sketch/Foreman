import { useEffect } from 'react';
import { go, useRoute } from './router';
import { CatalogEditor } from './screens/CatalogEditor';
import { Compare } from './screens/Compare';
import { Home } from './screens/Home';
import { Jobs } from './screens/Jobs';
import { ListScreen } from './screens/ListScreen';
import { LoadScreen } from './screens/LoadScreen';
import { PrintView } from './screens/PrintView';
import { RulesEditor } from './screens/RulesEditor';
import { SettingsScreen } from './screens/SettingsScreen';
import { ShareImport } from './screens/ShareImport';
import { Variants } from './screens/Variants';
import { toast, undoLast, useStore } from './store';

const NAV = [
  { path: '/', label: 'Build', icon: '▦' },
  { path: '/load', label: 'Load', icon: '⛟' },
  { path: '/jobs', label: 'Jobs', icon: '☰' },
  { path: '/catalog', label: 'Parts', icon: '⚙' },
  { path: '/rules', label: 'Rules', icon: '⚖' },
  { path: '/settings', label: 'Settings', icon: '⛭' },
];

export function App() {
  const route = useRoute();
  const ready = useStore((s) => s.ready);
  const lastUndo = useStore((s) => s.undo[s.undo.length - 1]?.label);
  const msg = useStore((s) => s.toast);
  const towers = useStore((s) => s.job.towers.reduce((n, t) => n + t.qty, 0));

  useEffect(() => {
    if (!msg) return;
    const t = setTimeout(() => toast(null), 3000);
    return () => clearTimeout(t);
  }, [msg]);

  if (!ready) return <div className="p-6 text-xl font-bold">Loading…</div>;
  if (route.path === '/print') return <PrintView />;

  let screen;
  switch (route.path) {
    case '/v':
      screen = <Variants />;
      break;
    case '/list':
      screen = <ListScreen />;
      break;
    case '/compare':
      screen = <Compare />;
      break;
    case '/load':
      screen = <LoadScreen />;
      break;
    case '/jobs':
      screen = <Jobs />;
      break;
    case '/catalog':
      screen = <CatalogEditor />;
      break;
    case '/rules':
      screen = <RulesEditor />;
      break;
    case '/settings':
      screen = <SettingsScreen />;
      break;
    case '/share':
      screen = <ShareImport encoded={route.rest} />;
      break;
    default:
      screen = <Home />;
  }

  return (
    <div className="min-h-screen">
      <header className="no-print sticky top-0 z-30 flex items-center justify-between gap-2 border-b-2 border-black bg-yellow-400 px-3 py-1 text-black">
        <button type="button" className="min-h-12 text-lg font-extrabold" onClick={() => go('/')}>
          LoadOut
        </button>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="min-h-12 rounded-xl bg-black px-3 font-bold text-yellow-400 disabled:opacity-40"
            disabled={!lastUndo}
            title={lastUndo ? `Undo: ${lastUndo}` : 'Nothing to undo'}
            onClick={undoLast}
          >
            ↶ Undo
          </button>
          <button type="button" className="min-h-12 rounded-xl border-2 border-black px-3 font-bold" onClick={() => go('/load')}>
            Load · {towers}
          </button>
        </div>
      </header>
      <main>{screen}</main>
      {msg && (
        <div role="status" className="no-print fixed inset-x-3 bottom-24 z-50 mx-auto max-w-xl rounded-xl bg-black px-4 py-3 font-semibold text-white shadow-lg dark:bg-white dark:text-black">
          {msg}
        </div>
      )}
      <nav className="no-print fixed inset-x-0 bottom-0 z-40 grid grid-cols-6 border-t-2 border-black bg-white pb-[env(safe-area-inset-bottom)] dark:border-neutral-600 dark:bg-neutral-950">
        {NAV.map((n) => {
          const on = route.path === n.path || (n.path === '/' && ['/v', '/list', '/compare'].includes(route.path));
          return (
            <button
              key={n.path}
              type="button"
              onClick={() => go(n.path)}
              className={`flex min-h-14 flex-col items-center justify-center text-xs font-bold ${on ? 'bg-yellow-400 text-black' : ''}`}
            >
              <span className="text-lg leading-none" aria-hidden>
                {n.icon}
              </span>
              {n.label}
            </button>
          );
        })}
      </nav>
    </div>
  );
}
