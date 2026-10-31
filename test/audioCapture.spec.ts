import { describe, expect, it } from 'vitest';
import { AudioSignalMonitor, routeFailureMessage } from '../shared/audioCapture';
import { parseRouteResult } from '../electron/services/audioRoute';

describe('audio capture diagnostics', () => {
  it('distinguishes a quiet meeting from missing audio callbacks, and recovers', () => {
    const meter = new AudioSignalMonitor(); meter.reset(0);
    expect(meter.state(1000)).toBe('waiting');
    expect(meter.state(5000)).toBe('stalled');
    meter.push(new Float32Array(1600).buffer, 10000);
    expect(meter.state(10000)).toBe('quiet');
    meter.push(new Float32Array(1600).fill(0.05).buffer, 10100);
    expect(meter.state(10100)).toBe('signal');
    meter.push(new Float32Array(1600).buffer, 13000);
    expect(meter.state(13000)).toBe('waiting');
    meter.push(new Float32Array(1600).buffer, 20100);
    expect(meter.state(20100)).toBe('quiet');
    expect(meter.state(25100)).toBe('stalled');
    meter.reset(30000); expect(meter.state(30001)).toBe('waiting');
  });
  it('does not treat empty callbacks as a working stream', () => {
    const meter = new AudioSignalMonitor(); meter.reset(0);
    meter.push(new ArrayBuffer(0), 4900);
    expect(meter.state(5000)).toBe('stalled');
  });
  it('rejects broken route reports rather than declaring routing healthy', () => {
    expect(parseRouteResult('not json').ok).toBe(false);
    expect(parseRouteResult('{"ok":true}').ok).toBe(false);
    expect(parseRouteResult('{"ok":true,"fingerprint":"route"}').ok).toBe(true);
    const disconnected = parseRouteResult('{"ok":false,"code":"OUTPUT_DISCONNECTED","fingerprint":"route"}');
    expect(disconnected.code).toBe('OUTPUT_DISCONNECTED');
    expect(routeFailureMessage(disconnected, true)).toContain('耳机已断开');
  });
});
