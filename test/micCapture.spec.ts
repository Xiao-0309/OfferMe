import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MicCapture } from '../src/audio/micCapture';

let track: EventTarget & { stop: ReturnType<typeof vi.fn> };
let getUserMedia: ReturnType<typeof vi.fn>;
let failModule = false;
let contexts: Context[];
class Context extends EventTarget {
  state = 'suspended';
  audioWorklet = { addModule: vi.fn(async () => { if (failModule) throw new Error('worklet failed'); }) };
  destination = {};
  resume = vi.fn(async () => { this.state = 'running'; });
  close = vi.fn(async () => { this.state = 'closed'; });
  createMediaStreamSource = vi.fn(() => ({ connect: vi.fn() }));
  createGain = vi.fn(() => ({ gain: { value: 1 }, connect: vi.fn() }));
  constructor() { super(); contexts.push(this); }
}
class Worklet {
  port = { onmessage: null, close: vi.fn() };
  connect = vi.fn(); disconnect = vi.fn();
}
beforeEach(() => {
  contexts = []; failModule = false;
  track = Object.assign(new EventTarget(), { stop: vi.fn() });
  getUserMedia = vi.fn(async () => ({ getTracks: () => [track] }));
  vi.stubGlobal('navigator', { mediaDevices: { getUserMedia } });
  vi.stubGlobal('AudioContext', Context); vi.stubGlobal('AudioWorkletNode', Worklet);
});
afterEach(() => vi.unstubAllGlobals());

describe('input capture lifecycle', () => {
  it('resumes a suspended context, preserves raw BlackHole audio and releases tracks', async () => {
    const cap = new MicCapture(); const ended = vi.fn();
    await cap.start('blackhole-id', vi.fn(), { audioProcessing: false, onEnded: ended });
    expect(getUserMedia.mock.calls[0][0].audio).toMatchObject({ deviceId: { exact: 'blackhole-id' }, echoCancellation: false, noiseSuppression: false, autoGainControl: false });
    expect(contexts[0].resume).toHaveBeenCalledTimes(1);
    contexts[0].state = 'suspended'; contexts[0].dispatchEvent(new Event('statechange'));
    expect(contexts[0].resume).toHaveBeenCalledTimes(2);
    track.dispatchEvent(new Event('ended')); expect(ended).toHaveBeenCalledTimes(1);
    await cap.stop();
    track.dispatchEvent(new Event('ended')); expect(ended).toHaveBeenCalledTimes(1);
    expect(track.stop).toHaveBeenCalledTimes(1); expect(cap.running).toBe(false);
  });
  it('cleans up a failed worklet and can start again', async () => {
    const cap = new MicCapture(); failModule = true;
    await expect(cap.start('blackhole-id', vi.fn())).rejects.toThrow('worklet failed');
    expect(track.stop).toHaveBeenCalledTimes(1); expect(contexts[0].close).toHaveBeenCalled();
    expect(cap.running).toBe(false);
    failModule = false; await cap.start('blackhole-id', vi.fn()); expect(cap.running).toBe(true);
    await cap.stop();
  });
  it('cancels an in-flight start without leaking the eventual stream', async () => {
    let resolve!: (value: unknown) => void;
    getUserMedia.mockImplementation(() => new Promise(r => { resolve = r; }));
    const cap = new MicCapture(); const pending = cap.start('blackhole-id', vi.fn());
    const rejected = expect(pending).rejects.toThrow('Capture cancelled');
    await cap.stop(); resolve({ getTracks: () => [track] }); await rejected;
    expect(cap.running).toBe(false); expect(track.stop).toHaveBeenCalledTimes(1);
    expect(contexts).toHaveLength(0);
  });
  it('shares concurrent start requests instead of opening two inputs', async () => {
    const cap = new MicCapture();
    await Promise.all([cap.start('blackhole-id', vi.fn()), cap.start('blackhole-id', vi.fn())]);
    expect(getUserMedia).toHaveBeenCalledTimes(1); expect(contexts).toHaveLength(1);
    await cap.stop();
  });
});
