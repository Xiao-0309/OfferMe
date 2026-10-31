/* Modified for OfferMe (2026); derived from MeetingCopilot. See UPSTREAM.md. */
/** Offline help plus the canonical public project links. */
import type { UiLang } from './protocol';
export interface LocalizedDoc { zh: string; en: string }
const local = (file: string) => `offerme-doc:${file}`;
const guide = { zh: local('GUIDE.zh-CN.md'), en: local('GUIDE.en.md') };
export const DOCS = {
  repo: 'https://github.com/Xiao-0309/OfferMe',
  issues: 'https://github.com/Xiao-0309/OfferMe/issues',
  releases: 'https://github.com/Xiao-0309/OfferMe/releases',
  license: local('LICENSE'),
  quickStart: guide,
  apiKeys: guide,
  troubleshooting: guide,
  installWindows: guide,
  installMacos: local('MACOS_AUDIO.md'),
  windowsSetup: guide,
  macosSetup: { zh: local('MACOS_AUDIO.md'), en: local('GUIDE.en.md') },
} as const;
export function docUrl(doc: LocalizedDoc | string, lang: UiLang): string {
  return typeof doc === 'string' ? doc : doc[lang];
}
export function allDocUrls(): string[] {
  return Object.values(DOCS).flatMap((value) => typeof value === 'string' ? [value] : [value.zh, value.en]);
}
/** Exact allowlist: a renderer cannot use this to open arbitrary local paths. */
export function bundledDocFile(url: unknown): string | undefined {
  if (typeof url !== 'string' || !url.startsWith('offerme-doc:') || !allDocUrls().includes(url)) return undefined;
  return url.slice('offerme-doc:'.length);
}
