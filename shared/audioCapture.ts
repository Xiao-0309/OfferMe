export interface AudioRouteResult {
  managed: boolean;
  ok: boolean;
  code: 'OK' | 'OUTPUT_DISCONNECTED' | 'OUTPUT_BYPASSES_BLACKHOLE' | 'CHECK_FAILED';
  fingerprint?: string;
}

export function routeFailureMessage(result: AudioRouteResult, zh: boolean): string {
  if (result.code === 'OUTPUT_DISCONNECTED') return zh
    ? '双输出中的耳机已断开。请连接耳机，或将系统输出改为可用的扬声器，再点“开始转录”。'
    : 'The headphones in the multi-output device are disconnected. Reconnect them or select available speakers, then start again.';
  if (result.code === 'OUTPUT_BYPASSES_BLACKHOLE') return zh
    ? '声音没有经过 BlackHole。请将系统和会议扬声器设为包含耳机与 BlackHole 的双输出，再开始转录。'
    : 'Audio is bypassing BlackHole. Select a multi-output device containing your headphones and BlackHole for system and meeting output.';
  return zh ? '暂时无法检查音频路由，请确认 BlackHole 和耳机已连接，再重试。'
    : 'Could not check the audio route. Check BlackHole and your headphones, then retry.';
}

export type AudioSignalState = 'waiting' | 'signal' | 'quiet' | 'stalled';
/** Only levels/timestamps are retained. No PCM, transcripts or API data. */
export class AudioSignalMonitor {
  private started = 0;
  private lastFrame: number | null = null;
  private lastSignal: number | null = null;
  reset(now: number): void { this.started = now; this.lastFrame = this.lastSignal = null; }
  push(buffer: ArrayBuffer, now: number): void {
    const pcm = new Float32Array(buffer);
    if (!pcm.length) return;
    this.lastFrame = now;
    let sum = 0;
    for (const sample of pcm) sum += sample * sample;
    if (Math.sqrt(sum / pcm.length) > 0.001) this.lastSignal = now;
  }
  state(now: number): AudioSignalState {
    if (now - (this.lastFrame ?? this.started) >= 5000) return 'stalled';
    if (this.lastSignal !== null && now - this.lastSignal < 2500) return 'signal';
    if (now - (this.lastSignal ?? this.started) >= 10000) return 'quiet';
    return 'waiting';
  }
}
