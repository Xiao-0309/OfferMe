/* Modified for OfferMe (2026); derived from MeetingCopilot. See UPSTREAM.md. */
import { describe, expect, it } from 'vitest';
import {
  captureKindForPlatform,
  defaultHotkeysForPlatform,
} from '../shared/platform';

describe('platform defaults', () => {
  it('uses familiar Command shortcuts on macOS without changing Windows defaults', () => {
    expect(defaultHotkeysForPlatform('darwin')).toEqual({
      toggle: 'Command+B',
      shot: 'Command+Shift+S',
    });
    expect(defaultHotkeysForPlatform('win32')).toEqual({
      toggle: 'Control+B',
      shot: 'Control+Shift+S',
    });
  });

  it('uses Electron loopback only on Windows', () => {
    expect(captureKindForPlatform('win32')).toBe('loopback');
    expect(captureKindForPlatform('darwin')).toBe('input');
    expect(captureKindForPlatform('linux')).toBe('input');
  });

});
