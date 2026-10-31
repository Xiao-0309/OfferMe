/* Modified for OfferMe (2026); derived from MeetingCopilot. See UPSTREAM.md. */
import { describe, expect, it } from 'vitest';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { DOCS, allDocUrls, docUrl, bundledDocFile } from '../shared/docsLinks';
describe('bundled documentation', () => {
  it('resolves help links to files included in the source', () => {
    for (const url of allDocUrls().filter(url => url.startsWith('offerme-doc:'))) {
      const file = bundledDocFile(url)!;
      expect(file).toBeTruthy();
      expect(existsSync(join(__dirname, '..', file)) || existsSync(join(__dirname, '../docs', file))).toBe(true);
    }
  });
  it('selects the requested language', () => {
    expect(docUrl(DOCS.quickStart, 'zh')).toContain('zh-CN');
    expect(docUrl(DOCS.quickStart, 'en')).toContain('.en.');
  });
  it('rejects arbitrary paths and traversal', () => {
    expect(bundledDocFile('offerme-doc:../../settings.json')).toBeUndefined();
    expect(bundledDocFile('file:///etc/passwd')).toBeUndefined();
    expect(bundledDocFile(null)).toBeUndefined();
    expect(bundledDocFile(DOCS.repo)).toBeUndefined();
    expect(bundledDocFile('offerme-doc:https://evil.test')).toBeUndefined();
  });
});
