/* Modified for OfferMe (2026); derived from MeetingCopilot. See UPSTREAM.md. */
/** Cloud speech provider contracts and shared transcript filtering. */
export interface TranscribeResult {
  text: string;
  lang?: string;
  inferMs: number;
}

export interface EngineLidResult {
  lang: 'chinese' | 'english';
  margin: number;
  lidMs: number;
}

/** Shared contract for HTTP and streaming cloud speech engines. */
export interface AsrEngine {
  readonly ep: string;
  readonly loadMs: number;
  warmMs: number;
  readonly lidAvailable: boolean;
  warmup(): Promise<number>;
  transcribe(pcm: Float32Array, language: 'auto' | string): Promise<TranscribeResult>;
  detectZhEn?(pcm: Float32Array): Promise<EngineLidResult | null>;
}

// ---- true streaming (audio in / text out over one live connection) ----

/** one finalized sentence from the streaming service; times are ms relative
 * to the session's first audio sample */
export interface StreamingSentence {
  text: string;
  beginMs: number;
  endMs: number;
}

export interface StreamingSessionCallbacks {
  /**
   * The service accepted the task and the session is live (DashScope
   * `task-started`). Optional: the ASR worker does not care, but the
   * connection test does — "the socket opened" is not proof that the key,
   * the model and the workspace are all good, "the task started" is.
   */
  onReady?(): void;
  /** transient partial for the sentence currently being spoken */
  onPartial(text: string): void;
  /** a sentence the service finalized (its own endpointing, not our VAD) */
  onSentence(s: StreamingSentence): void;
  /** connection/task failure; the session is dead after this */
  onError(message: string): void;
}

/** a live audio→text stream; one per channel (them/me), short-lived */
export interface StreamingSession {
  /** feed one 16 kHz mono float32 frame; safe to call before the connection
   * is ready (frames are buffered and flushed on task start) */
  push(pcm: Float32Array): void;
  /** graceful finish (flush + wait for the service to finalize) */
  close(): Promise<void>;
}

export interface StreamingAsrEngine extends AsrEngine {
  readonly streaming: true;
  /** open a live session; returns synchronously, connects in the background */
  openSession(cb: StreamingSessionCallbacks, opts?: { language?: 'auto' | string }): StreamingSession;
}

export function isStreamingEngine(e: AsrEngine): e is StreamingAsrEngine {
  return (e as { streaming?: boolean }).streaming === true;
}

const HALLUCINATION_RE =
  /^(谢谢(观看|大家|收看)|请(不吝)?点赞|订阅|转发|打赏|字幕由.*(提供|制作)|字幕提供|(明镜|点点)栏目|thank you( so much)? for watching|thanks for watching|please (like and )?subscribe|subtitles? by)/i;

export function isJunkTranscript(text: string): boolean {
  const t = text.trim();
  if (!t) return true;
  if (/^[\s.。,，!！?？~〜\-–—·]*$/.test(t)) return true;
  if (HALLUCINATION_RE.test(t.replace(/^[\s"'“”]+/, ''))) return true;
  return false;
}
