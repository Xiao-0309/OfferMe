import { expect, it } from 'vitest';
import { defaultSettings } from '../electron/settings';
import { buildAsrOptions } from '../electron/services/asrOptions';
it('selects independent credentials for each cloud ASR backend', () => {
  const data = defaultSettings();
  const store = { data, getCloudAsrApiKey: () => 'test-segment', getRealtimeAsrApiKey: () => 'test-realtime' };
  expect(buildAsrOptions(store)).toMatchObject({ backend: 'cloud-realtime', cloud: { apiKey: 'test-realtime', model: 'fun-asr-realtime' } });
  data.asr.backend = 'cloud';
  data.asr.cloud = { model: 'test-asr', baseUrl: 'https://example.test/v1' };
  expect(buildAsrOptions(store)).toMatchObject({ backend: 'cloud', cloud: { apiKey: 'test-segment', model: 'test-asr' } });
});
