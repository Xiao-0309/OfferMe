import type { SettingsStore } from '../settings';
import type { AsrHostOptions } from '../asrHost';

/** Credentials stay in the main process and are forwarded only to the ASR worker. */
export function buildAsrOptions(settings: Pick<SettingsStore, 'data' | 'getCloudAsrApiKey' | 'getRealtimeAsrApiKey'>): AsrHostOptions {
  const asr = settings.data.asr;
  const backend = asr.backend === 'cloud' ? 'cloud' : 'cloud-realtime';
  const cfg = backend === 'cloud' ? asr.cloud : asr.realtime;
  return {
    backend,
    language: asr.language,
    cloud: {
      baseUrl: cfg?.baseUrl ?? '',
      model: cfg?.model ?? '',
      apiKey: (backend === 'cloud' ? settings.getCloudAsrApiKey() : settings.getRealtimeAsrApiKey()) ?? '',
    },
  };
}
