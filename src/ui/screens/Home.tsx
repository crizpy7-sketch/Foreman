import { useLiveQuery } from 'dexie-react-hooks';
import { useRef, useState } from 'react';
import { db, getKV } from '../../db/db';
import { parseCallout } from '../../engine';
import { Button, Page } from '../components/ui';
import { go } from '../router';
import { listen, speechSupported } from '../speech';
import { useStore } from '../store';

const WEEK = 7 * 24 * 3600 * 1000;

export function Home() {
  const [text, setText] = useState('');
  const [more, setMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [listening, setListening] = useState(false);
  const [hint, setHint] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const defaultType = useStore((s) => s.data.settings.defaultType);
  const recents = useLiveQuery(() => db.recents.orderBy('at').reverse().toArray(), []) ?? [];
  const lastBackup = useLiveQuery(() => getKV<number>('lastBackup'), []);
  const hasData = useLiveQuery(async () => (await db.jobs.count()) + (await db.myVersions.count()), []) ?? 0;
  const favorites = recents.filter((r) => r.favorite);
  const others = recents.filter((r) => !r.favorite).slice(0, 8);

  const submit = (value = text) => {
    const r = parseCallout(value, defaultType);
    if (!r.ok) {
      setError(r.error);
      return;
    }
    setError(null);
    go('/v', { c: value.trim(), more: more || r.callout.moreWays ? '1' : undefined });
  };

  const mic = () => {
    if (!speechSupported()) {
      setHint('Tap the box, then the 🎤 on your keyboard to dictate.');
      inputRef.current?.focus();
      return;
    }
    setListening(true);
    listen(
      (t) => {
        setText(t);
        submit(t);
      },
      (err) => {
        setListening(false);
        if (err && err !== 'no-speech' && err !== 'aborted') setHint(`Mic: ${err}. You can also use the keyboard's dictation.`);
      },
    );
  };

  const backupDue = hasData > 0 && (!lastBackup || Date.now() - lastBackup > WEEK);

  return (
    <Page title="What are we loading?">
      {backupDue && (
        <button
          type="button"
          onClick={() => go('/settings')}
          className="mb-3 w-full rounded-xl border-2 border-orange-500 bg-orange-100 p-3 text-left font-semibold text-orange-950 dark:bg-orange-950 dark:text-orange-100"
        >
          💾 Weekly backup due — tap to export your data.
        </button>
      )}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <div className="flex gap-2">
          <input
            ref={inputRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="5x4x8 rolling"
            aria-label="Callout"
            autoCapitalize="off"
            autoComplete="off"
            enterKeyHint="go"
            className="min-h-16 w-full rounded-2xl border-4 border-black bg-white px-4 text-2xl font-bold text-black placeholder:text-neutral-400 focus:border-yellow-400 focus:outline-none dark:border-white dark:bg-black dark:text-white"
          />
          <button
            type="button"
            onClick={mic}
            aria-label="Speak callout"
            className={`min-h-16 min-w-16 rounded-2xl text-3xl ${listening ? 'animate-pulse bg-red-600 text-white' : 'bg-black text-yellow-400 dark:bg-white dark:text-black'}`}
          >
            🎤
          </button>
        </div>
        {error && <p className="mt-2 text-lg font-semibold text-red-700 dark:text-red-400">{error}</p>}
        {hint && <p className="mt-2 font-semibold text-neutral-700 dark:text-neutral-300">{hint}</p>}
        <label className="mt-3 flex min-h-12 items-center gap-3 text-lg font-semibold">
          <input type="checkbox" className="h-7 w-7 accent-yellow-400" checked={more} onChange={(e) => setMore(e.target.checked)} />
          More ways (single + multi-bay)
        </label>
        <Button kind="primary" type="submit" className="mt-2 w-full text-xl">
          Show builds
        </Button>
      </form>

      <p className="mt-3 text-sm text-neutral-600 dark:text-neutral-400">
        L x W x H, then rolling / stat. H = leg length. Extras: <code>2@</code> qty, <code>a5</code> ladder on the 5' side, <code>hatch</code>, <code>8'6"</code>, <code>2.5m</code>.
      </p>

      {favorites.length > 0 && <Chips title="★ Favorites" items={favorites} onPick={(c) => submit(c)} />}
      {others.length > 0 && <Chips title="Recent" items={others} onPick={(c) => submit(c)} />}
    </Page>
  );
}

function Chips(props: { title: string; items: { callout: string; favorite: boolean }[]; onPick: (c: string) => void }) {
  return (
    <div className="mt-5">
      <h2 className="mb-2 text-lg font-bold">{props.title}</h2>
      <div className="flex flex-col gap-2">
        {props.items.map((r) => (
          <div key={r.callout} className="flex gap-2">
            <button
              type="button"
              onClick={() => props.onPick(r.callout)}
              className="min-h-12 flex-1 rounded-xl border-2 border-neutral-400 px-3 text-left text-lg font-bold"
            >
              {r.callout}
            </button>
            <button
              type="button"
              aria-label={r.favorite ? 'Unfavorite' : 'Favorite'}
              onClick={() => void db.recents.update(r.callout, { favorite: !r.favorite })}
              className="min-h-12 w-12 rounded-xl border-2 border-neutral-400 text-xl"
            >
              {r.favorite ? '★' : '☆'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
