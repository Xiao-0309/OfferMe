/** Selected input capture. Streams are recreated after device changes. */
export class MicCapture {
  private ctx: AudioContext | null = null;
  private stream: MediaStream | null = null;
  private node: AudioWorkletNode | null = null;
  private pending: Promise<void> | null = null;
  private generation = 0;
  private detach: (() => void) | null = null;

  get running(): boolean { return this.ctx !== null; }

  start(deviceId: string | undefined, onPcm: (pcm: ArrayBuffer, captureTs: number) => void,
    options: { audioProcessing?: boolean; onEnded?: () => void } = {}): Promise<void> {
    if (this.pending) return this.pending;
    if (this.ctx) return Promise.resolve();
    const pending = this.open(deviceId, onPcm, options, ++this.generation);
    this.pending = pending;
    void pending.finally(() => { if (this.pending === pending) this.pending = null; }).catch(() => undefined);
    return pending;
  }

  private async open(deviceId: string | undefined, onPcm: (pcm: ArrayBuffer, captureTs: number) => void,
    options: { audioProcessing?: boolean; onEnded?: () => void }, generation: number): Promise<void> {
    const processing = options.audioProcessing ?? true;
    const stream = await navigator.mediaDevices.getUserMedia({ audio: {
      ...(deviceId ? { deviceId: { exact: deviceId } } : {}),
      echoCancellation: processing, noiseSuppression: processing, autoGainControl: processing,
    } });
    let ctx: AudioContext | null = null;
    let node: AudioWorkletNode | null = null;
    try {
      if (generation !== this.generation) throw new Error('Capture cancelled');
      ctx = new AudioContext({ sampleRate: 16000 });
      await ctx.audioWorklet.addModule('pcm-worklet.js');
      if (generation !== this.generation) throw new Error('Capture cancelled');
      const source = ctx.createMediaStreamSource(stream);
      node = new AudioWorkletNode(ctx, 'pcm-worklet');
      node.port.onmessage = (e: MessageEvent<ArrayBuffer>) => onPcm(e.data, Date.now());
      const mute = ctx.createGain();
      mute.gain.value = 0;
      source.connect(node); node.connect(mute); mute.connect(ctx.destination);
      await ctx.resume();
      if (generation !== this.generation) throw new Error('Capture cancelled');
      this.ctx = ctx; this.stream = stream; this.node = node;
      const context = ctx;
      const ended = () => { if (generation === this.generation) options.onEnded?.(); };
      const resumed = () => {
        if (generation === this.generation && context.state === 'suspended') {
          void context.resume().catch(ended);
        }
      };
      stream.getTracks().forEach(track => track.addEventListener('ended', ended));
      ctx.addEventListener('statechange', resumed);
      this.detach = () => {
        stream.getTracks().forEach(track => track.removeEventListener('ended', ended));
        context.removeEventListener('statechange', resumed);
      };
    } catch (error) {
      node?.port.close(); node?.disconnect();
      stream.getTracks().forEach(track => track.stop());
      await ctx?.close().catch(() => undefined);
      throw error;
    }
  }

  async stop(): Promise<void> {
    ++this.generation;
    this.detach?.(); this.detach = null;
    this.node?.port.close(); this.node?.disconnect(); this.node = null;
    this.stream?.getTracks().forEach(track => track.stop()); this.stream = null;
    const ctx = this.ctx; this.ctx = null;
    await ctx?.close().catch(() => undefined);
  }
}

/** List available microphones (label populated only after a getUserMedia grant). */
export async function listMics(): Promise<{ deviceId: string; label: string }[]> {
  const devices = await navigator.mediaDevices.enumerateDevices();
  return devices
    .filter((d) => d.kind === 'audioinput')
    .map((d) => ({ deviceId: d.deviceId, label: d.label })); // '' → caller renders its default-mic label
}
