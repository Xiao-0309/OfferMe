/* Modified for OfferMe (2026); derived from MeetingCopilot. See UPSTREAM.md. */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {
  AnswerLang,
  DocumentKind,
  ReferenceDocument,
  AsrEvent,
  KbSlot,
  LlmAskPayload,
  PublicSettings,
  StoredSession,
} from '../shared/protocol';
import {
  appendSegment,
  nextSegmentId,
  percentile,
  reindexSegments,
  type TranscriptSegment,
} from '../shared/transcript';
import { buildReferenceContext, mergeDocuments } from '../shared/documents';
import { WorkspaceSidebar } from './components/WorkspaceSidebar';
import { InterviewPanel } from './components/InterviewPanel';
import { GlassControl } from './components/GlassControl';
import { Icon } from './components/Icon';
import { DocumentsPanel } from './components/DocumentsPanel';
import { isLikelyQuestion } from '../shared/textHeuristics';
import { captureKindForPlatform } from '../shared/platform';
import { AudioSignalMonitor, routeFailureMessage, type AudioSignalState } from '../shared/audioCapture';
import { deriveServiceHealth } from '../shared/healthState';
import { LoopbackCapture } from './audio/loopbackCapture';
import { MicCapture, listMics } from './audio/micCapture';
import { TranscriptPanel } from './components/TranscriptPanel';
import { SettingsPanel } from './components/SettingsPanel';
import { ServiceHealthPanel } from './components/ServiceHealthPanel';
import { DiagnosticsPanel } from './components/DiagnosticsPanel';
import { HelpPanel } from './components/HelpPanel';
import { StatusBar } from './components/StatusBar';
import { AnswerSession, type AnswerTurn } from './components/AnswerSession';
import { I18nProvider, getDict, type Dict } from './i18n';

export interface AsrUiState {
  phase: 'loading' | 'ready' | 'error';
  ep?: string;
  gpuSuspect?: boolean;
  workerState: 'loading' | 'listening' | 'speech' | 'transcribing' | 'stopped';
  lastError?: string;
}

export interface HudStats {
  lastE2eMs?: number;
  lastInferMs?: number;
  p50?: number;
  p95?: number;
  count: number;
}

const MAX_TURNS = 200;
// v2: only the last 8 turns ride along verbatim — the rolling memo carries
// older context, keeping per-request tokens flat as the interview runs long
const HISTORY_TURNS = 8;

let seq = 0;
const uid = (p: string) => `${p}-${++seq}-${Date.now()}`;

function newSession(name: string): StoredSession {
  return { id: uid('s'), name, createdAt: Date.now(), turns: [], segments: [] };
}

/** legacy single-slot KB → resume slot (dual-slot material, P0-2) */
function migrateKbSlots(s: StoredSession, fallbackName: string): StoredSession {
  if (!s.kbText || s.resumeText) return s;
  const { kbName, kbText, ...rest } = s;
  return { ...rest, resumeName: kbName ?? fallbackName, resumeText: kbText };
}

/** first-question topic → a short session title */
function deriveName(text: string, fallback: string): string {
  const t = text.replace(/\s+/g, ' ').trim();
  if (!t) return fallback;
  return t.length > 14 ? t.slice(0, 14) + '…' : t;
}

export function App() {
  const [settings, setSettings] = useState<PublicSettings | null>(null);
  const [asr, setAsr] = useState<AsrUiState>({ phase: 'loading', workerState: 'loading' });
  const [capturing, setCapturing] = useState(false);
  const [captureStarting, setCaptureStarting] = useState(false);
  const [audioSignal, setAudioSignal] = useState<AudioSignalState>('waiting');
  const [showSettings, setShowSettings] = useState(false);
  const [showHealth, setShowHealth] = useState(false);
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [showInterview, setShowInterview] = useState(false);
  const [showHud, setShowHud] = useState(false);
  const [referencesOpen, setReferencesOpen] = useState(false);
  const [hud, setHud] = useState<HudStats>({ count: 0 });
  const [continuous, setContinuous] = useState(false);
  const [mics, setMics] = useState<{ deviceId: string; label: string }[]>([]);
  const [micActive, setMicActive] = useState(false);
  const [partials, setPartials] = useState<{ them?: string; me?: string }>({});
  const [sessions, setSessions] = useState<StoredSession[]>([]);
  const [currentId, setCurrentId] = useState<string>('');
  const [kbNotice, setKbNotice] = useState<string | null>(null);

  const loopbackRef = useRef<LoopbackCapture | null>(null);
  const themInputRef = useRef<MicCapture | null>(null);
  const micRef = useRef<MicCapture | null>(null);
  const settingsRef = useRef<PublicSettings | null>(null);
  const e2eSamples = useRef<number[]>([]);
  const sessionsRef = useRef<StoredSession[]>([]);
  const currentIdRef = useRef<string>('');
  const answerLangRef = useRef<AnswerLang>('english');
  const loaded = useRef(false);
  const signalMonitor = useRef(new AudioSignalMonitor());
  const captureStartingRef = useRef(false);
  const captureWanted = useRef(false);
  const recoveryBusy = useRef(false);
  const recoveryAttempts = useRef(0);
  const restartCaptureRef = useRef<() => Promise<void>>(async () => undefined);
  const blackHoleCapture = useRef(false);
  const routeFingerprint = useRef<string | undefined>(undefined);

  // UI language: settings-driven; ref mirror so stable callbacks stay fresh
  const t = getDict(settings?.ui.lang);
  const tRef = useRef<Dict>(t);
  tRef.current = t;

  if (!loopbackRef.current) loopbackRef.current = new LoopbackCapture();
  if (!themInputRef.current) themInputRef.current = new MicCapture();
  if (!micRef.current) micRef.current = new MicCapture();
  settingsRef.current = settings;
  sessionsRef.current = sessions;
  currentIdRef.current = currentId;

  const current = useMemo(
    () => sessions.find((s) => s.id === currentId) ?? null,
    [sessions, currentId],
  );
  const segments = current?.segments ?? [];
  useEffect(() => { setReferencesOpen(false); }, [currentId]);
  useEffect(() => {
    window.offerme.prewarm({ invalidateOnly: true });
  }, [current?.documents]);

  const patchSession = useCallback((id: string, fn: (s: StoredSession) => StoredSession) => {
    setSessions((list) => list.map((s) => (s.id === id ? fn(s) : s)));
  }, []);

  const appendTurn = useCallback(
    (sessionId: string, turn: AnswerTurn) => {
      patchSession(sessionId, (s) => {
        const turns = [...s.turns, turn];
        return { ...s, turns: turns.length > MAX_TURNS ? turns.slice(turns.length - MAX_TURNS) : turns };
      });
    },
    [patchSession],
  );

  const buildHistory = useCallback((): { role: 'user' | 'assistant'; content: string }[] => {
    const s = sessionsRef.current.find((x) => x.id === currentIdRef.current);
    if (!s) return [];
    const done = s.turns.filter((t) => t.status === 'done' && t.kind !== 'translate').slice(-HISTORY_TURNS);
    return done.flatMap((t) => [
      { role: 'user' as const, content: t.label },
      { role: 'assistant' as const, content: t.text },
    ]);
  }, []);

  /** current session's dual-slot material (resume / JD / rolling memo) */
  const currentMaterial = useCallback((): { resume?: string; jd?: string; memo?: string; documents?: ReferenceDocument[] } => {
    const s = sessionsRef.current.find((x) => x.id === currentIdRef.current);
    return {
      resume: s?.resumeText || undefined,
      jd: s?.jdText || undefined,
      memo: s?.memo || undefined,
      documents: s?.documents,
    };
  }, []);

  /** P1-6: ask main to warm the DeepSeek prefix cache for the current material */
  const prewarm = useCallback(
    (immediate: boolean) => {
      const m = currentMaterial();
      window.offerme.prewarm({ resume: m.resume, jd: m.jd, documents: m.documents, immediate });
    },
    [currentMaterial],
  );

  // P1-5: rolling memo — fold each finished Q&A in asynchronously, one update
  // at a time per session (promise chain), never on the answer critical path
  const memoChain = useRef(new Map<string, Promise<void>>());
  const enqueueMemoUpdate = useCallback(
    (sid: string, question: string, answer: string) => {
      if (!question.trim() || !answer.trim()) return;
      const prev = memoChain.current.get(sid) ?? Promise.resolve();
      const next = prev
        .then(async () => {
          const old = sessionsRef.current.find((x) => x.id === sid)?.memo ?? '';
          const memo = await window.offerme.memoUpdate({ memo: old, question, answer });
          if (memo) patchSession(sid, (s) => ({ ...s, memo }));
        })
        .catch(() => {});
      memoChain.current.set(sid, next);
    },
    [patchSession],
  );

  /** auto-name a session from its first real question (once) */
  const maybeTitle = useCallback(
    (sid: string, text?: string) => {
      if (!text?.trim()) return;
      patchSession(sid, (s) =>
        s.titled ? s : { ...s, name: deriveName(text, tRef.current.app.newSession), titled: true },
      );
    },
    [patchSession],
  );

  const askLlm = useCallback(
    (mode: 'segment' | 'continuous' | 'free' | 'translate', text?: string) => {
      const sid = currentIdRef.current;
      if (!sid) return;
      const requestId = uid('req');
      const segs = sessionsRef.current.find((x) => x.id === sid)?.segments ?? [];
      // continuous: resolve the actual question NOW — the other party's latest
      // line — so the turn label (and thus session history) carries the real
      // question instead of a constant '对方最新发言' (v1 history-label bug)
      let question = text;
      if (mode === 'continuous') {
        for (let i = segs.length - 1; i >= 0; i--) {
          if ((segs[i].speaker ?? 'them') === 'them') {
            question = segs[i].text;
            break;
          }
        }
      }
      const label = question ?? (mode === 'continuous' ? tRef.current.app.latestRemark : '');
      appendTurn(sid, { id: requestId, kind: mode, label, text: '', status: 'streaming' });
      if (mode === 'segment' || mode === 'free') maybeTitle(sid, text);
      const material = mode === 'translate' ? {} : currentMaterial();
      const payload: LlmAskPayload = {
        requestId,
        mode,
        question: mode === 'free' ? undefined : question,
        freeQuestion: mode === 'free' ? text : undefined,
        recentTranscript: segs.slice(-30).map((s) => s.text),
        answerLang: answerLangRef.current,
        history: mode === 'translate' ? undefined : buildHistory(),
        ...material,
      };
      window.offerme.llmAsk(payload);
    },
    [appendTurn, buildHistory, currentMaterial, maybeTitle],
  );

  const askShot = useCallback(
    (question: string, imageDataUrl?: string) => {
      const sid = currentIdRef.current;
      if (!sid) return;
      const requestId = uid('shot');
      appendTurn(sid, {
        id: requestId,
        kind: 'vision',
        label: question || tRef.current.app.readShot,
        text: '',
        status: 'streaming',
      });
      maybeTitle(sid, question || tRef.current.app.shotQuestion);
      const m = currentMaterial();
      const background = [m.resume, m.jd, buildReferenceContext(m.documents)].filter(Boolean).join('\n\n') || undefined;
      window.offerme.shotAsk({ requestId, question, background, imageDataUrl });
    },
    [appendTurn, currentMaterial, maybeTitle],
  );

  /** region screenshot flow (📷 button or hotkey): drag a region, then ask */
  const doRegionShot = useCallback(async () => {
    const img = await window.offerme.pickRegion();
    if (img) askShot('', img);
  }, [askShot]);

  // ---- boot: load settings + sessions ----
  useEffect(() => {
    void window.offerme.getSettings().then((s) => {
      setSettings(s);
      answerLangRef.current = s.llm.answerLang;
    });
    void window.offerme.loadSessions().then((f) => {
      if (f.sessions.length) {
        // heal legacy duplicate segment ids (worker counter used to reset per
        // engine rebuild — translations then landed on multiple bubbles)
        setSessions(
          f.sessions.map((s) =>
            migrateKbSlots(
              { ...s, segments: reindexSegments(s.segments ?? []) },
              tRef.current.app.legacyKbName,
            ),
          ),
        );
        setCurrentId(f.currentId && f.sessions.some((s) => s.id === f.currentId) ? f.currentId : f.sessions[0].id);
      } else {
        const s = newSession(tRef.current.app.sessionN(1));
        setSessions([s]);
        setCurrentId(s.id);
      }
      loaded.current = true;
    });

    const handleAsrEvent = (ev: AsrEvent) => {
      if (ev.kind === 'ready') {
        setAsr((s) => ({ ...s, phase: 'ready', ep: ev.ep, gpuSuspect: ev.gpuSuspect, workerState: 'listening' }));
      } else if (ev.kind === 'status') {
        setAsr((s) => ({ ...s, workerState: ev.state }));
      } else if (ev.kind === 'error') {
        setAsr((s) => ({ ...s, phase: ev.fatal ? 'error' : s.phase, lastError: ev.message }));
      } else if (ev.kind === 'partial') {
        setPartials((p) => ({ ...p, [ev.speaker]: ev.text }));
      } else if (ev.kind === 'segment') {
        setPartials((p) => ({ ...p, [ev.speaker]: undefined })); // final replaces the live partial
        const e2eMs = Date.now() - ev.timings.speechEndTs;
        const inferMs = ev.timings.inferEndTs - ev.timings.inferStartTs;
        e2eSamples.current.push(e2eMs);
        if (e2eSamples.current.length > 200) e2eSamples.current.shift();
        setHud({
          lastE2eMs: e2eMs,
          lastInferMs: inferMs,
          p50: percentile(e2eSamples.current, 50),
          p95: percentile(e2eSamples.current, 95),
          count: e2eSamples.current.length,
        });
        const sid = currentIdRef.current;
        setSessions((list) =>
          list.map((s) =>
            s.id === sid
              ? {
                  ...s,
                  segments: appendSegment(s.segments ?? [], {
                    // NOT ev.id: the worker counter resets per engine rebuild,
                    // duplicating ids inside a persisted session
                    id: nextSegmentId(s.segments ?? []),
                    text: ev.text,
                    lang: ev.lang,
                    speaker: ev.speaker,
                    startTs: ev.timings.speechStartTs,
                    endTs: ev.timings.speechEndTs,
                    e2eMs,
                    inferMs,
                  }),
                }
              : s,
          ),
        );
      }
    };
    const off = window.offerme.onAsrEvent(handleAsrEvent);
    // instant-ready cloud engines emit ready/status BEFORE this subscription
    // exists — pull the last ones so the UI never sticks at "模型加载中"
    void window.offerme.asrReplay().then(({ ready, status }) => {
      if (ready) handleAsrEvent(ready);
      if (status) handleAsrEvent(status);
    });

    const offLlm = window.offerme.onLlmEvent((ev) => {
      setSessions((list) =>
        list.map((s) => ({
          ...s,
          turns: s.turns.map((t) => {
            if (t.id !== ev.requestId) return t;
            if (ev.kind === 'delta') return { ...t, text: t.text + ev.text };
            if (ev.kind === 'done') return { ...t, text: ev.text || t.text, status: 'done' };
            return { ...t, status: 'error', error: ev.message };
          }),
        })),
      );
      // fold finished ANSWER turns into the session memo (async, off-path);
      // translate/vision turns are not interview Q&A
      if (ev.kind === 'done') {
        const s = sessionsRef.current.find((x) => x.turns.some((t) => t.id === ev.requestId));
        const t = s?.turns.find((x) => x.id === ev.requestId);
        if (s && t && (t.kind === 'segment' || t.kind === 'continuous' || t.kind === 'free')) {
          enqueueMemoUpdate(s.id, t.label, ev.text || t.text);
        }
      }
    });

    const offShot = window.offerme.onShotHotkey(() => void doRegionShot());

    window.__offermeAutoStart = () => void startCapture();
    // visual-QA hooks (OFFERME_MAIN_SHOT in electron/main.ts): open a panel from the
    // main process so it can be screenshotted
    window.__offermeOpenSettings = () => setShowSettings(true);
    window.__offermeOpenHelp = () => setShowHelp(true);
    return () => {
      off();
      offLlm();
      offShot();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- persist sessions (debounced) ----
  useEffect(() => {
    if (!loaded.current) return;
    const t = setTimeout(() => window.offerme.saveSessions({ sessions, currentId }), 400);
    return () => clearTimeout(t);
  }, [sessions, currentId]);

  // ---- apply UI theme + answer font scale to the document root ----
  useEffect(() => {
    const ui = settings?.ui;
    if (!ui) return;
    document.documentElement.dataset.fontScale = ui.fontScale ?? 'medium';
    const apply = () => {
      const mode = ui.theme ?? 'dark';
      const dark =
        mode === 'system' ? window.matchMedia('(prefers-color-scheme: dark)').matches : mode === 'dark';
      document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    };
    apply();
    if ((ui.theme ?? 'dark') !== 'system') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, [settings]);

  // auto-dismiss the KB parse notice
  useEffect(() => {
    if (!kbNotice) return;
    const t = setTimeout(() => setKbNotice(null), 8000);
    return () => clearTimeout(t);
  }, [kbNotice]);

  // switching sessions swaps the material → prefix dirty (reheats if capturing)
  useEffect(() => {
    if (!loaded.current || !currentId) return;
    prewarm(false);
  }, [currentId, prewarm]);

  // continuous mode: only the OTHER party's questions trigger it (never my own
  // mic), question-gated + append, per current session.
  const lastSeg = segments.length ? segments[segments.length - 1] : null;
  useEffect(() => {
    if (!continuous || !lastSeg) return;
    if ((lastSeg.speaker ?? 'them') !== 'them') return; // ignore my own voice
    if (!isLikelyQuestion(lastSeg.text)) return;
    const timer = setTimeout(() => askLlm('continuous'), 1100);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [continuous, lastSeg?.id, lastSeg?.endTs]);

  // Windows: Electron system loopback. macOS/Linux: selected ordinary input
  // (typically a virtual audio device for meeting/system audio).
  const startCapture = useCallback(async (recovery = false) => {
    const inputMode = captureKindForPlatform(window.offerme.platform) === 'input';
    const cap = inputMode ? themInputRef.current! : loopbackRef.current!;
    if (cap.running || captureStartingRef.current || (recovery && !captureWanted.current)) return;
    captureWanted.current = true;
    captureStartingRef.current = true;
    setCaptureStarting(true);
    if (!recovery) recoveryAttempts.current = 0;
    signalMonitor.current.reset(Date.now());
    setAudioSignal('waiting');
    blackHoleCapture.current = false;
    const send = (buf: ArrayBuffer, ts: number) => {
      signalMonitor.current.push(buf, ts);
      if (signalMonitor.current.state(ts) === 'signal') recoveryAttempts.current = 0;
      window.offerme.sendPcm(buf, ts, 'them');
    };
    try {
      if (inputMode) {
        let deviceId = settingsRef.current?.audio.themDeviceId;
        if (window.offerme.platform === 'darwin') {
          let inputs = await listMics();
          // CoreAudio can assign a new device ID after audio-route changes.
          // Recover the saved input by name instead of keeping a dead ID.
          if (deviceId && !inputs.some((input) => input.deviceId === deviceId)) {
            deviceId = undefined;
          }
          // Device labels are hidden until the first microphone grant. Open a
          // temporary stream only if we need to discover BlackHole. A valid
          // saved device should never request another permission grant.
          if (!deviceId && inputs.some((input) => !input.label)) {
            const permissionStream = await navigator.mediaDevices.getUserMedia({ audio: true });
            permissionStream.getTracks().forEach((track) => track.stop());
            inputs = await listMics();
          }
          if (!deviceId) {
            const blackHole = inputs.find((input) => /BlackHole.*2ch/i.test(input.label));
            if (blackHole?.deviceId) {
              deviceId = blackHole.deviceId;
              const updated = await window.offerme.setSettings({ audio: { themDeviceId: deviceId } });
              settingsRef.current = updated;
              setSettings(updated);
            }
          }
          if (!deviceId) throw new Error(tRef.current.uiLang === 'zh'
            ? '未找到对方音频输入，请安装并选择 BlackHole 2ch。'
            : 'Select an available audio input, such as BlackHole 2ch.');
          blackHoleCapture.current = /BlackHole.*2ch/i.test(inputs.find(input => input.deviceId === deviceId)?.label ?? '');
          if (blackHoleCapture.current) {
            const route = await window.offerme.checkAudioRoute(true);
            if (!route.ok) throw new Error(routeFailureMessage(route, tRef.current.uiLang === 'zh'));
            routeFingerprint.current = route.fingerprint;
          }
          setMics(inputs);
        }
        if (!captureWanted.current) return;
        await themInputRef.current!.start(
          deviceId,
          send,
          { audioProcessing: false, onEnded: () => { void restartCaptureRef.current(); } },
        );
        void listMics().then(setMics).catch(() => undefined);
      } else {
        await loopbackRef.current!.start(send);
      }
      if (!captureWanted.current) { await cap.stop(); return; }
      setAsr(s => ({ ...s, lastError: undefined }));
      window.offerme.captureStarted();
      setCapturing(true);
      if (!recovery) prewarm(true); // Warm once when the user starts, not on device recovery.
    } catch (e) {
      captureWanted.current = false;
      await cap.stop();
      setCapturing(false);
      setAsr((s) => ({ ...s, lastError: tRef.current.app.captureStartFail((e as Error).message) }));
    } finally {
      captureStartingRef.current = false;
      setCaptureStarting(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stopCapture = useCallback(async (recovery = false) => {
    if (!recovery) captureWanted.current = false;
    const cap =
      captureKindForPlatform(window.offerme.platform) === 'input'
        ? themInputRef.current!
        : loopbackRef.current!;
    await cap.stop();
    window.offerme.captureStopped();
    setCapturing(false);
  }, []);

  // Reopen the input after topology changes or a stalled audio callback. Never
  // silently fall back to the physical mic, and bound automatic retries.
  restartCaptureRef.current = async () => {
    if (!captureWanted.current || captureStartingRef.current || recoveryBusy.current) return;
    recoveryBusy.current = true;
    try {
      if (++recoveryAttempts.current > 2) {
        await stopCapture();
        setAsr(s => ({ ...s, lastError: tRef.current.uiLang === 'zh'
          ? '采音未恢复。请检查耳机和双输出，随后重新点击“开始转录”。'
          : 'Audio capture did not recover. Check your headphones and multi-output device, then start again.' }));
        return;
      }
      await stopCapture(true);
      if (captureWanted.current) await startCapture(true);
    } finally { recoveryBusy.current = false; }
  };

  useEffect(() => {
    if (!capturing) return;
    let disposed = false;
    let checking = false;
    let changedTimer: ReturnType<typeof setTimeout> | undefined;
    const signalTimer = setInterval(() => {
      const state = signalMonitor.current.state(Date.now());
      setAudioSignal(state);
      if (state === 'stalled') void restartCaptureRef.current();
    }, 500);
    const changed = () => {
      clearTimeout(changedTimer);
      changedTimer = setTimeout(() => { if (!disposed) void restartCaptureRef.current(); }, 1000);
    };
    navigator.mediaDevices.addEventListener('devicechange', changed);
    const routeTimer = setInterval(async () => {
      if (!blackHoleCapture.current || checking || captureStartingRef.current || recoveryBusy.current) return;
      checking = true;
      try {
        const route = await window.offerme.checkAudioRoute();
        if (disposed) return;
        if (!route.ok) {
          await stopCapture();
          setAsr(s => ({ ...s, lastError: routeFailureMessage(route, tRef.current.uiLang === 'zh') }));
        } else if (route.fingerprint && routeFingerprint.current !== route.fingerprint) {
          routeFingerprint.current = route.fingerprint;
          void restartCaptureRef.current();
        }
      } catch { /* Retry the read-only check on the next tick. */ }
      finally { checking = false; }
    }, 3000);
    return () => {
      disposed = true;
      clearInterval(signalTimer); clearInterval(routeTimer); clearTimeout(changedTimer);
      navigator.mediaDevices.removeEventListener('devicechange', changed);
    };
  }, [capturing, stopCapture]);

  // 🎤 独立麦克风采集：只转麦克风(我)，与系统声音互不影响，按钮直接控制起停
  const toggleMicCapture = useCallback(async () => {
    const mic = micRef.current!;
    if (mic.running) {
      await mic.stop();
      setMicActive(false);
      return;
    }
    try {
      await mic.start(settings?.audio.micDeviceId, (buf, ts) => window.offerme.sendPcm(buf, ts, 'me'));
      setMicActive(true);
      if (mics.length === 0) void listMics().then(setMics);
    } catch (e) {
      setAsr((s) => ({ ...s, lastError: tRef.current.app.micStartFail((e as Error).message) }));
    }
  }, [settings, mics]);

  const setSeg = useCallback(
    (segId: number, patch: Partial<TranscriptSegment>) => {
      const sid = currentIdRef.current;
      setSessions((list) =>
        list.map((s) =>
          s.id === sid
            ? { ...s, segments: (s.segments ?? []).map((g) => (g.id === segId ? { ...g, ...patch } : g)) }
            : s,
        ),
      );
    },
    [],
  );

  const translateSegment = useCallback(
    (seg: TranscriptSegment) => {
      if (seg.translating) return; // re-translating an already-translated bubble is allowed
      setSeg(seg.id, { translating: true });
      window.offerme
        .translate(seg.text)
        .then((zh) => setSeg(seg.id, { translation: zh, translating: false }))
        .catch(() => setSeg(seg.id, { translation: tRef.current.app.translateFail, translating: false }));
    },
    [setSeg],
  );

  const toggleStealth = useCallback(async () => {
    if (!settings) return;
    const on = await window.offerme.setStealth(!settings.ui.stealth);
    setSettings({ ...settings, ui: { ...settings.ui, stealth: on } });
  }, [settings]);

  const toggleAnswerLang = useCallback(async () => {
    if (!settings) return;
    const next: AnswerLang = settings.llm.answerLang === 'chinese' ? 'english' : 'chinese';
    answerLangRef.current = next;
    const updated = await window.offerme.setSettings({ llm: { answerLang: next } });
    setSettings(updated);
    answerLangRef.current = updated.llm.answerLang;
    prewarm(false); // lang is part of the stable prefix → mark dirty / reheat
  }, [settings, prewarm]);

  const toggleAnswerModel = useCallback(async () => {
    if (!settings) return;
    const updated = await window.offerme.setSettings({ llm: { answerWithVision: !settings.llm.answerWithVision } });
    setSettings(updated);
  }, [settings]);

  const selectMic = useCallback(
    async (deviceId: string) => {
      const updated = await window.offerme.setSettings({ audio: { micDeviceId: deviceId || undefined } });
      setSettings(updated);
      // if the mic is currently on, restart it on the newly chosen device
      const mic = micRef.current!;
      if (mic.running) {
        await mic.stop();
        await mic
          .start(deviceId || undefined, (buf, ts) => window.offerme.sendPcm(buf, ts, 'me'))
          .catch(() => setMicActive(false));
      }
    },
    [],
  );

  const selectThemInput = useCallback(async (deviceId: string) => {
    const updated = await window.offerme.setSettings({ audio: { themDeviceId: deviceId || undefined } });
    setSettings(updated);
    settingsRef.current = updated;
    if (themInputRef.current!.running) {
      await stopCapture(true);
      if (captureWanted.current) await startCapture(true);
    }
  }, [startCapture, stopCapture]);

  const clearTranscript = useCallback(() => {
    patchSession(currentIdRef.current, (s) => ({ ...s, segments: [] }));
  }, [patchSession]);

  const cancelTurn = useCallback(
    (id: string) => {
      window.offerme.llmCancel(id);
      patchSession(currentIdRef.current, (s) => ({
        ...s,
        turns: s.turns.map((t) => (t.id === id ? { ...t, status: 'done' } : t)),
      }));
    },
    [patchSession],
  );

  const createSession = useCallback(() => {
    const s = newSession(tRef.current.app.sessionN(sessionsRef.current.length + 1));
    setSessions((list) => [...list, s]);
    setCurrentId(s.id);
  }, []);

  const deleteSession = useCallback((id: string) => {
    setSessions((list) => {
      const next = list.filter((s) => s.id !== id);
      if (next.length === 0) {
        const s = newSession(tRef.current.app.sessionN(1));
        setCurrentId(s.id);
        return [s];
      }
      setCurrentId((cur) => (cur === id ? next[0].id : cur));
      return next;
    });
  }, []);

  const renameSession = useCallback(
    (id: string, name: string) => {
      patchSession(id, (s) => ({ ...s, name: name.trim() || s.name, titled: true }));
    },
    [patchSession],
  );

  /** the overlays are mutually exclusive: one panel at a time, never stacked */
  const closePanels = useCallback(() => {
    setShowSettings(false);
    setShowHealth(false);
    setShowDiagnostics(false);
    setShowHelp(false);
    setShowInterview(false);
  }, []);

  /**
   * Tray menu -> renderer (Phase 4 §A). Main only forwards what it cannot do
   * itself, and it has already made the window visible. 开始/停止转写
   * deliberately runs the SAME code path as the title-bar button, readiness
   * gate included, so the two can never disagree. Re-subscribed whenever that
   * state changes — cheaper and less error-prone than a fistful of refs.
   */
  useEffect(() => {
    return window.offerme.onTrayCommand(({ command }) => {
      switch (command) {
        case 'toggle-capture':
          if (capturing) void stopCapture();
          else if (asr.phase === 'ready') void startCapture();
          return;
        case 'new-session':
          createSession();
          return;
        case 'open-settings':
          closePanels();
          setShowSettings(true);
          return;
        case 'open-health':
          closePanels();
          setShowHealth(true);
          return;
        case 'open-help':
          closePanels();
          setShowHelp(true);
          return;
      }
    });
  }, [capturing, asr.phase, startCapture, stopCapture, createSession, closePanels]);

  const pickKb = useCallback(
    async (slot: KbSlot, warm = true) => {
      const sessionId = currentIdRef.current;
      const r = await window.offerme.pickKnowledge(slot);
      if (!r) return;
      if (r.error) {
        setKbNotice(tRef.current.uiLang === 'zh' ? `无法读取 ${r.name}，请检查文件是否损坏或受密码保护，或转成 TXT 后重试。` : `Could not read ${r.name}. Check for a damaged or password-protected file, or try TXT.`);
        return;
      }
      if (!r.text.trim()) {
        // deterministic parsers return '' for scanned/image-only PDFs
        setKbNotice(tRef.current.app.kbNoText(r.name));
        return;
      }
      setKbNotice(null);
      patchSession(sessionId, (s) =>
        slot === 'resume'
          ? { ...s, resumeName: r.name, resumeText: r.text }
          : { ...s, jdName: r.name, jdText: r.text },
      );
      if (sessionId !== currentIdRef.current || !warm) return;
      // material changed → reheat the prefix cache with the fresh bytes;
      // patchSession is async (React state), so pass the new slots directly
      window.offerme.prewarm({
        resume: slot === 'resume' ? r.text : currentMaterial().resume,
        jd: slot === 'jd' ? r.text : currentMaterial().jd,
        documents: currentMaterial().documents,
        immediate: true,
      });
    },
    [patchSession, currentMaterial],
  );

  const clearKb = useCallback(
    (slot: KbSlot) => {
      patchSession(currentIdRef.current, (s) =>
        slot === 'resume'
          ? { ...s, resumeName: undefined, resumeText: undefined }
          : { ...s, jdName: undefined, jdText: undefined },
      );
      // prefix went stale; reheats now if capturing, else at the next ▶
      window.offerme.prewarm({
        resume: slot === 'resume' ? undefined : currentMaterial().resume,
        jd: slot === 'jd' ? undefined : currentMaterial().jd,
        documents: currentMaterial().documents,
      });
    },
    [patchSession, currentMaterial],
  );

  /** the v1 -> v2 migration marks hand-configured profiles; show the notice
   * once until the user dismisses it (persisted in onboarding state) */
  const showUpgradeNotice =
    !!settings &&
    settings.version === 2 &&
    settings.onboarding.completed &&
    !!settings.onboarding.migratedFromV1 &&
    !settings.onboarding.dismissedUpgradePrompt;

  const dismissUpgradeNotice = async () => {
    const onboarding = await window.offerme.saveOnboardingProgress({ dismissedUpgradePrompt: true });
    setSettings((s) => (s ? { ...s, onboarding } : s));
  };

  const visionReady =
    !!settings?.llm.answerWithVision &&
    !!settings?.vision.baseUrl &&
    !!settings?.vision.model &&
    !!settings?.vision.apiKeySet;

  /**
   * One derivation for the status chips, the health panel and the answer
   * gating (shared/healthState.ts). A missing LLM key disables the answer
   * buttons with an explanation instead of letting every click produce the
   * same main-process error turn — but it never blocks transcription.
   */
  const health = useMemo(
    () => (settings ? deriveServiceHealth({ settings, asr, capturing }) : null),
    [settings, asr, capturing],
  );
  const answersReady = health?.answersAvailable ?? true;

  return (
    <I18nProvider lang={settings?.ui.lang}>
    <div className="app">
      <WorkspaceSidebar
        sessions={sessions} currentId={currentId} zh={t.uiLang === 'zh'}
        activePanel={showInterview ? 'interview' : showSettings ? 'settings' : showHelp ? 'help' : showHealth ? 'health' : 'workspace'}
        onSwitch={(id) => { setCurrentId(id); closePanels(); }} onNew={createSession}
        onWorkspace={closePanels}
        onInterview={() => { closePanels(); setShowInterview(true); }}
        onReferences={() => { closePanels(); setReferencesOpen(true); }}
        onSettings={() => { closePanels(); setShowSettings(true); }}
        onHelp={() => { closePanels(); setShowHelp(true); }}
        onHealth={() => { closePanels(); setShowHealth(true); }}
      />
      <main className={`workspace${showSettings || showHealth || showHelp || showDiagnostics ? ' has-panel' : ''}${showInterview ? ' has-interview' : ''}`}>
      <header className="titlebar">
        <div className="workspace-heading"><span className="eyebrow">{t.uiLang === 'zh' ? '工作台 / 当前会话' : 'WORKSPACE / SESSION'}</span><h1>{showInterview ? (t.uiLang === 'zh' ? '模拟面试' : 'Mock interview') : showSettings ? (t.uiLang === 'zh' ? '设置' : 'Settings') : showHelp ? (t.uiLang === 'zh' ? '使用指南' : 'Help') : showHealth ? (t.uiLang === 'zh' ? '服务状态' : 'Service status') : showDiagnostics ? (t.uiLang === 'zh' ? '诊断信息' : 'Diagnostics') : current?.name ?? 'OfferMe'}</h1></div>
        <div className="window-actions">
          <span className={`capture-badge${capturing ? ' is-recording' : ''}`}><span/>{capturing ? (t.uiLang === 'zh' ? '正在转录' : 'Transcribing') : (t.uiLang === 'zh' ? '尚未录音' : 'Not recording')}</span>
          {settings && <GlassControl palette={settings.ui.backgroundPalette} color={settings.ui.backgroundColor} value={settings.ui.glassOpacity ?? 0.68} zh={t.uiLang === 'zh'} onSaved={patch => setSettings(s => s ? { ...s, ui: { ...s.ui, ...patch } } : s)}/>}
          <button className="icon-button" title={t.uiLang === 'zh' ? '切换明暗主题' : 'Toggle theme'} aria-label={t.uiLang === 'zh' ? '切换明暗主题' : 'Toggle theme'} onClick={async () => { const theme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'; setSettings(await window.offerme.setSettings({ ui: { theme } })); }}><Icon name={settings?.ui.theme === 'dark' ? 'sun' : 'moon'}/></button>
          <span className="toolbar-divider"/>
          <button className="icon-button" onClick={() => window.offerme.hide()} title={t.titlebar.hideTitle} aria-label={t.titlebar.hideTitle}><Icon name="minus"/></button>
          <button className="icon-button btn-close" onClick={() => window.offerme.quit()} title={t.titlebar.quitTitle} aria-label={t.titlebar.quitTitle}><Icon name="close"/></button>
        </div>
      </header>
      <div className="commandbar" hidden={showInterview && !capturing}><div className="capture-controls">
          <button
            className={capturing ? 'btn btn-live' : 'btn btn-primary'}
            onClick={() => (capturing ? void stopCapture() : void startCapture())}
            disabled={asr.phase !== 'ready' || captureStarting}
            title={
              captureKindForPlatform(window.offerme.platform) === 'loopback'
                ? capturing
                  ? t.titlebar.stopTitle
                  : t.titlebar.startTitle
                : capturing
                  ? t.titlebar.stopInputTitle
                  : t.titlebar.startInputTitle
            }
          >
            <Icon name={capturing ? "stop" : "play"} size={15}/>{captureStarting ? (t.uiLang === 'zh' ? '检查音频…' : 'Checking audio…') : capturing ? t.titlebar.stop : t.titlebar.start}
          </button>
          {captureKindForPlatform(window.offerme.platform) === 'input' && mics.length > 0 && (
            <select
              className="mic-select"
              value={settings?.audio.themDeviceId ?? ''}
              disabled={captureStarting}
              onChange={(e) => void selectThemInput(e.target.value)}
              title={t.titlebar.themDeviceTitle}
            >
              <option value="">{t.titlebar.themDeviceDefault}</option>
              {mics.map((m) => (
                <option key={m.deviceId} value={m.deviceId}>
                  {(m.label || t.titlebar.themDeviceDefault).slice(0, 14)}
                </option>
              ))}
            </select>
          )}
          <button
            className={continuous ? 'btn btn-on' : 'btn'}
            onClick={() => setContinuous((v) => !v)}
            title={t.titlebar.continuousTitle}
          >
            {t.titlebar.continuous}
          </button>
          <button
            className={settings?.llm.answerWithVision ? 'btn btn-on' : 'btn'}
            onClick={() => void toggleAnswerModel()}
            title={t.titlebar.modelTitle}
          >
            {settings?.llm.answerWithVision ? t.titlebar.vision : t.titlebar.textOnly}
          </button>
          <button className="btn" onClick={() => void toggleAnswerLang()} title={t.titlebar.answerLangTitle}>
            {t.titlebar.answerLang(settings?.llm.answerLang === 'english')}
          </button>
          <button
            className={micActive ? 'btn btn-live' : 'btn'}
            onClick={() => void toggleMicCapture()}
            title={t.titlebar.micTitle}
          >
            {micActive ? t.titlebar.micOn : t.titlebar.micOff}
          </button>
          {micActive && mics.length > 0 && (
            <select
              className="mic-select"
              value={settings?.audio.micDeviceId ?? ''}
              onChange={(e) => void selectMic(e.target.value)}
              title={t.titlebar.micDeviceTitle}
            >
              <option value="">{t.titlebar.micDefault}</option>
              {mics.map((m) => (
                <option key={m.deviceId} value={m.deviceId}>
                  {(m.label || t.titlebar.micDefault).slice(0, 10)}
                </option>
              ))}
            </select>
          )}
          <button
            className={settings?.ui.stealth ? 'btn btn-on' : 'btn'}
            onClick={() => void toggleStealth()}
            title={
              window.offerme.platform === 'darwin'
                ? t.titlebar.stealthMacTitle
                : t.titlebar.stealthTitle
            }
          >
            {t.titlebar.stealth(!!settings?.ui.stealth)}
          </button>
          <button className="btn" onClick={() => setShowHud((v) => !v)} title={t.titlebar.hudTitle}>
            HUD
          </button>
        </div></div>

      {capturing && <div className="audio-signal-notice" role="status" data-signal={audioSignal}>
        {t.uiLang === 'zh'
          ? audioSignal === 'signal' ? '● 已收到音频，正在转写'
            : audioSignal === 'quiet' ? '暂未收到声音。若会议正在讲话，请将会议扬声器设为“系统默认”或耳机＋BlackHole 双输出。'
            : audioSignal === 'stalled' ? '采音中断，正在重新连接…' : '等待会议声音…'
          : audioSignal === 'signal' ? '● Receiving audio for transcription'
            : audioSignal === 'quiet' ? 'No sound received. If someone is speaking, select system default or your headphones + BlackHole output in the meeting.'
            : audioSignal === 'stalled' ? 'Audio interrupted; reconnecting…' : 'Waiting for meeting audio…'}
      </div>}
      {!capturing && asr.lastError && <div className="audio-signal-notice audio-error" role="alert">{asr.lastError}</div>}

      {/* grandfathered users (settings.json predates the wizard) get one
          dismissible pointer at the new wizard; wizard-created profiles never
          carry onboarding.migratedFromV1, so they never see it */}
      {showUpgradeNotice && (
        <div className="upgrade-banner">
          <span>{t.app.upgradeNotice}</span>
          <button className="btn btn-sm btn-primary" onClick={() => void window.offerme.rerunOnboarding()}>
            {t.app.upgradeCheck}
          </button>
          <button className="btn btn-sm" onClick={() => void dismissUpgradeNotice()}>
            {t.app.upgradeSkip}
          </button>
        </div>
      )}

      {showHealth && settings && health && (
        <ServiceHealthPanel
          settings={settings}
          health={health}
          onClose={() => setShowHealth(false)}
          onOpenSettings={() => {
            setShowHealth(false);
            setShowSettings(true);
          }}
          onOpenDiagnostics={() => {
            setShowHealth(false);
            setShowDiagnostics(true);
          }}
          onSettingsRefreshed={setSettings}
        />
      )}

      {showDiagnostics && <DiagnosticsPanel onClose={() => setShowDiagnostics(false)} />}

      {showHelp && (
        <HelpPanel
          onClose={() => setShowHelp(false)}
          onOpenSettings={() => {
            setShowHelp(false);
            setShowSettings(true);
          }}
          onOpenDiagnostics={() => {
            setShowHelp(false);
            setShowDiagnostics(true);
          }}
        />
      )}

      {showSettings && settings && (
        <SettingsPanel
          settings={settings}
          onSaved={(s) => {
            setSettings(s);
            answerLangRef.current = s.llm.answerLang;
            setShowSettings(false);
          }}
          onClose={() => setShowSettings(false)}
          onRerunWizard={() => {
            setShowSettings(false);
            void window.offerme.rerunOnboarding();
          }}
          onOpenDiagnostics={() => {
            setShowSettings(false);
            setShowDiagnostics(true);
          }}
          onOpenHelp={() => {
            setShowSettings(false);
            setShowHelp(true);
          }}
        />
      )}

      {showInterview && current && <InterviewPanel key={current.id} session={current} zh={t.uiLang === 'zh'}
        ready={!!settings?.llm.apiKeySet && !!settings.llm.baseUrl && !!settings.llm.model}
        model={settings?.llm.model ?? ''} notice={kbNotice}
        onPatch={update => patchSession(current.id, s => ({ ...s, interview: update(s.interview ?? {}) }))}
        onImport={slot => pickKb(slot, false)}
        onMaterials={() => { closePanels(); setReferencesOpen(true); }}
        onSettings={() => { closePanels(); setShowSettings(true); }}/>}

      <div className="panes">
        <TranscriptPanel
          segments={segments}
          partials={partials}
          answersReady={answersReady}
          answersHint={t.health.answersDisabled}
          onAsk={(text) => askLlm('segment', text)}
          onTranslate={translateSegment}
          onClear={clearTranscript}
        />
        <AnswerSession
          sessions={sessions}
          currentId={currentId}
          turns={current?.turns ?? []}
          resumeName={current?.resumeName}
          resumeChars={current?.resumeText?.length ?? 0}
          jdName={current?.jdName}
          jdChars={current?.jdText?.length ?? 0}
          documentsPanel={
            <DocumentsPanel
              key={currentId}
              open={referencesOpen}
              onOpenChange={setReferencesOpen}
              documents={current?.documents ?? []}
              lang={settings?.ui.lang ?? 'en'}
              onImport={async (kind: DocumentKind) => {
                const targetId = currentIdRef.current;
                const result = await window.offerme.pickDocuments(kind);
                if (result) patchSession(targetId, (session) => ({
                  ...session, documents: mergeDocuments(session.documents ?? [], result.documents),
                }));
                return result;
              }}
              onToggle={(id, enabled) => patchSession(currentIdRef.current, (session) => ({
                ...session, documents: session.documents?.map((doc) => doc.id === id ? { ...doc, enabled } : doc),
              }))}
              onRemove={(id) => patchSession(currentIdRef.current, (session) => ({
                ...session, documents: session.documents?.filter((doc) => doc.id !== id),
              }))}
            />
          }
          notice={kbNotice}
          visionReady={visionReady}
          answersReady={answersReady}
          answersHint={t.health.answersDisabled}
          onSwitch={setCurrentId}
          onNew={createSession}
          onDelete={deleteSession}
          onRename={renameSession}
          onPickKb={(slot) => void pickKb(slot)}
          onClearKb={clearKb}
          onCancel={cancelTurn}
          onClear={() => patchSession(currentIdRef.current, (s) => ({ ...s, turns: [] }))}
          onFreeAsk={(q) => askLlm('free', q)}
          onShotAsk={askShot}
        />
      </div>

      <StatusBar
        asr={asr}
        capturing={capturing}
        hud={showHud ? hud : undefined}
        health={health ?? undefined}
        onOpenHealth={() => setShowHealth((v) => !v)}
      />
      </main>
    </div>
    </I18nProvider>
  );
}
