// Web Speech API mic input. Falls back to the keyboard's own dictation when unsupported (e.g. iOS PWA).
interface SpeechResultEvent {
  results: ArrayLike<ArrayLike<{ transcript: string }>>;
}
interface Recognizer {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((e: SpeechResultEvent) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
}
type RecognizerCtor = new () => Recognizer;

function ctor(): RecognizerCtor | null {
  const w = window as unknown as { SpeechRecognition?: RecognizerCtor; webkitSpeechRecognition?: RecognizerCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export const speechSupported = (): boolean => ctor() !== null;

export function listen(onText: (t: string) => void, onEnd: (error?: string) => void): () => void {
  const C = ctor();
  if (!C) {
    onEnd('unsupported');
    return () => {};
  }
  const r = new C();
  r.lang = 'en-US';
  r.interimResults = false;
  r.maxAlternatives = 1;
  r.onresult = (e) => onText(e.results[0]?.[0]?.transcript ?? '');
  r.onerror = (e) => onEnd(e.error);
  r.onend = () => onEnd();
  r.start();
  return () => r.stop();
}
