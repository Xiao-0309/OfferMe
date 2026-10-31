import { expect, it } from 'vitest';
import { shouldConfigureAudioRoute } from '../electron/services/audioRoute';
const options = { platform: 'darwin', packaged: true, isolated: false, resourceRoot: '/resources', dataDirectory: '/profile' };
it('changes audio only after explicit opt-in, never in isolated tests or development', () => {
  expect(shouldConfigureAudioRoute(options, false)).toBe(false);
  expect(shouldConfigureAudioRoute(options, true)).toBe(true);
  expect(shouldConfigureAudioRoute({ ...options, isolated: true }, true)).toBe(false);
  expect(shouldConfigureAudioRoute({ ...options, packaged: false }, true)).toBe(false);
  expect(shouldConfigureAudioRoute({ ...options, platform: 'win32' }, true)).toBe(false);
});
