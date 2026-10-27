// Small shared components. Glove-friendly: every control is at least 48px tall.
import { useEffect, type ReactNode } from 'react';

type BtnKind = 'primary' | 'secondary' | 'danger' | 'ghost';
const BTN: Record<BtnKind, string> = {
  primary: 'bg-yellow-400 text-black active:bg-yellow-500 font-bold',
  secondary: 'bg-neutral-200 text-black dark:bg-neutral-800 dark:text-white active:bg-neutral-300 dark:active:bg-neutral-700 font-semibold',
  danger: 'bg-red-700 text-white active:bg-red-800 font-semibold',
  ghost: 'bg-transparent text-black dark:text-white underline underline-offset-4 font-semibold',
};

export function Button(props: {
  children: ReactNode;
  onClick?: () => void;
  kind?: BtnKind;
  className?: string;
  disabled?: boolean;
  title?: string;
  ariaLabel?: string;
  type?: 'button' | 'submit';
}) {
  return (
    <button
      type={props.type ?? 'button'}
      title={props.title}
      aria-label={props.ariaLabel}
      disabled={props.disabled}
      onClick={props.onClick}
      className={`min-h-12 rounded-xl px-4 text-base disabled:opacity-40 ${BTN[props.kind ?? 'secondary']} ${props.className ?? ''}`}
    >
      {props.children}
    </button>
  );
}

export function Stepper(props: { value: number; onChange: (n: number) => void; label?: string }) {
  return (
    <div className="flex items-center gap-1" aria-label={props.label}>
      <button
        type="button"
        aria-label="minus one"
        className="h-12 w-12 rounded-xl bg-neutral-200 text-2xl font-bold text-black dark:bg-neutral-800 dark:text-white"
        onClick={() => props.onChange(Math.max(0, props.value - 1))}
      >
        −
      </button>
      <input
        inputMode="numeric"
        aria-label="quantity"
        className="h-12 w-16 rounded-xl border-2 border-neutral-400 bg-white text-center text-xl font-bold text-black dark:bg-black dark:text-white"
        value={props.value}
        onFocus={(e) => e.currentTarget.select()}
        onChange={(e) => {
          const n = Number(e.target.value.replace(/\D/g, ''));
          if (Number.isFinite(n)) props.onChange(n);
        }}
      />
      <button
        type="button"
        aria-label="plus one"
        className="h-12 w-12 rounded-xl bg-neutral-200 text-2xl font-bold text-black dark:bg-neutral-800 dark:text-white"
        onClick={() => props.onChange(props.value + 1)}
      >
        +
      </button>
    </div>
  );
}

export function Badge(props: { children: ReactNode; tone?: 'verify' | 'warn' | 'ok' | 'info' | 'mine' }) {
  const tone = {
    verify: 'bg-orange-200 text-orange-950 dark:bg-orange-900 dark:text-orange-100',
    warn: 'bg-red-200 text-red-950 dark:bg-red-900 dark:text-red-100',
    ok: 'bg-green-200 text-green-950 dark:bg-green-900 dark:text-green-100',
    info: 'bg-sky-200 text-sky-950 dark:bg-sky-900 dark:text-sky-100',
    mine: 'bg-violet-200 text-violet-950 dark:bg-violet-900 dark:text-violet-100',
  }[props.tone ?? 'info'];
  return <span className={`inline-block rounded-md px-1.5 py-0.5 text-xs font-bold uppercase tracking-wide ${tone}`}>{props.children}</span>;
}

export const VerifyBadge = () => <Badge tone="verify">verify</Badge>;

export function Segmented<T extends string>(props: {
  label: string;
  value: T;
  options: { value: T; label: string; disabled?: boolean }[];
  onChange: (v: T) => void;
}) {
  return (
    <div>
      <div className="mb-1 text-sm font-semibold text-neutral-600 dark:text-neutral-400">{props.label}</div>
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={props.label}>
        {props.options.map((o) => (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={o.value === props.value}
            disabled={o.disabled}
            onClick={() => props.onChange(o.value)}
            className={`min-h-12 rounded-xl border-2 px-3 font-semibold disabled:opacity-40 ${
              o.value === props.value
                ? 'border-yellow-400 bg-yellow-400 text-black'
                : 'border-neutral-400 bg-transparent text-black dark:text-white'
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function Sheet(props: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  useEffect(() => {
    if (!props.open) return;
    const k = (e: KeyboardEvent) => e.key === 'Escape' && props.onClose();
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [props]);
  if (!props.open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60" onClick={props.onClose} role="dialog" aria-modal="true" aria-label={props.title}>
      <div
        className="max-h-[88vh] w-full max-w-xl overflow-y-auto rounded-t-2xl bg-white p-4 pb-8 text-black dark:bg-neutral-900 dark:text-white"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="text-xl font-bold">{props.title}</h2>
          <Button kind="secondary" onClick={props.onClose} className="w-12 px-0" title="Close" ariaLabel="Close">
            ✕
          </Button>
        </div>
        {props.children}
      </div>
    </div>
  );
}

export function Field(props: { label: string; children: ReactNode; hint?: string; error?: string | null }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-semibold text-neutral-700 dark:text-neutral-300">{props.label}</span>
      {props.children}
      {props.hint && <span className="mt-1 block text-xs text-neutral-600 dark:text-neutral-400">{props.hint}</span>}
      {props.error && <span className="mt-1 block text-sm font-semibold text-red-700 dark:text-red-400">{props.error}</span>}
    </label>
  );
}

export const inputCls =
  'min-h-12 w-full rounded-xl border-2 border-neutral-400 bg-white px-3 text-base text-black dark:bg-black dark:text-white focus:border-yellow-400 focus:outline-none';

export function Footer() {
  return (
    <p className="mt-6 border-t-2 border-neutral-300 pt-3 text-sm font-semibold text-neutral-700 dark:border-neutral-700 dark:text-neutral-300">
      Material estimate only — build per Layher instructions, site rules and your competent person.
    </p>
  );
}

export function Page(props: { title: string; children: ReactNode; actions?: ReactNode }) {
  return (
    <section className="mx-auto max-w-2xl px-3 pb-36 pt-3">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h1 className="text-2xl font-extrabold">{props.title}</h1>
        <div className="flex gap-2">{props.actions}</div>
      </div>
      {props.children}
    </section>
  );
}

export function download(filename: string, text: string, type = 'application/json') {
  const blob = new Blob([text], { type });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

export async function pickFile(accept: string): Promise<string | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.onchange = async () => resolve(input.files?.[0] ? await input.files[0].text() : null);
    input.click();
  });
}
