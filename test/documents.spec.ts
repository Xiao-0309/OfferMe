import { afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { importDocuments } from '../electron/services/documents';
import { buildReferenceContext, mergeDocuments } from '../shared/documents';
import { buildAnswerMessages, buildStablePrefix } from '../electron/llm/prompts';
import { SessionStore } from '../electron/sessions';
import type { ReferenceDocument } from '../shared/protocol';
const paper: ReferenceDocument = { id: 'paper', name: 'attention.pdf', kind: 'paper', text: 'Paper content', enabled: true, addedAt: 1 };
const project: ReferenceDocument = { ...paper, id: 'project', kind: 'project', name: 'design.pdf', text: 'Project details' };
const temporary: string[] = [];
afterEach(() => temporary.splice(0).forEach((dir) => rmSync(dir, { recursive: true, force: true })));
describe('reference imports', () => {
  // Match docparse.spec.ts: native parser cold-starts can be slow on Windows CI.
  it('parses real PDF and DOCX fixtures locally', { timeout: 120_000 }, async () => {
    const result = await importDocuments([join(__dirname, 'fixtures/sample.pdf'), join(__dirname, 'fixtures/sample.docx')], 'project');
    expect(result.errors).toEqual([]);
    expect(result.documents).toHaveLength(2);
    expect(result.documents[0].text).toContain('Resume PDF fixture: Python and SQL');
    expect(result.documents.every((doc) => doc.enabled && doc.kind === 'project')).toBe(true);
  });
  it('preserves successful imports among blank, broken and unsupported files', async () => {
    const result = await importDocuments(['/secret/path/ok.pdf', '/secret/scan.pdf', '/secret/broken.pdf', '/secret/code.exe'], 'paper', async (path) => {
      if (path.endsWith('broken.pdf')) throw new Error('sensitive parser detail');
      return path.endsWith('scan.pdf') ? '\n' : 'Complete content';
    });
    expect(result.documents).toHaveLength(1);
    expect(result.errors).toEqual([{ name: 'scan.pdf', code: 'no-text' }, { name: 'broken.pdf', code: 'parse-failed' }, { name: 'code.exe', code: 'unsupported' }]);
    expect(JSON.stringify(result)).not.toMatch(/secret|sensitive parser/);
  });
  it('deduplicates identical content without re-enabling existing documents', async () => {
    const first = await importDocuments(['one.pdf', 'copy.pdf'], 'paper', async () => 'Same text');
    const again = await importDocuments(['renamed.pdf'], 'paper', async () => 'Same text');
    expect(first.documents).toHaveLength(1);
    const existing = [{ ...first.documents[0], enabled: false }];
    expect(mergeDocuments(existing, again.documents)).toEqual(existing);
  });
});
describe('document context and persistence', () => {
  it('includes enabled full text in free, segment and continuous answers', () => {
    const longPaper = { ...paper, text: '开头' + '资料内容'.repeat(12_000) + '末尾标记' };
    for (const mode of ['free', 'segment', 'continuous'] as const) {
      const messages = buildAnswerMessages({ mode, question: '贡献是什么', freeQuestion: '贡献是什么', recentTranscript: [], documents: [longPaper, { ...project, enabled: false }] });
      const text = JSON.stringify(messages);
      expect(text).toContain('末尾标记');
      expect(text).toContain('attention.pdf');
      expect(text).not.toContain('Project details');
      expect(text).toContain('不能因被导入就声称是用户的研究成果');
    }
  });
  it('keeps translations independent and prewarm prefix identical to answers', () => {
    const docs = [paper, project];
    const messages = buildAnswerMessages({ mode: 'segment', recentTranscript: [], resume: 'Resume', jd: 'JD', documents: docs });
    expect(messages[0].content).toBe(buildStablePrefix('Resume', 'JD', 'chinese', docs));
    const translation = buildAnswerMessages({ mode: 'translate', question: 'hello', recentTranscript: [], documents: docs });
    expect(JSON.stringify(translation)).not.toContain(paper.text);
    expect(buildReferenceContext([{ ...paper, enabled: false }])).toBe('');
  });
  it('round-trips documents in their own sessions and accepts older sessions', () => {
    const dir = mkdtempSync(join(tmpdir(), 'offerme-docs-')); temporary.push(dir);
    const store = new SessionStore(join(dir, 'sessions.json'));
    store.save({ currentId: 'a', sessions: [
      { id: 'a', name: 'Project', createdAt: 1, turns: [], documents: [project] },
      { id: 'b', name: 'Research', createdAt: 2, turns: [], documents: [{ ...paper, enabled: false }] },
      { id: 'legacy', name: 'Old', createdAt: 0, turns: [], resumeText: 'Resume' },
    ] });
    const reopened = new SessionStore(join(dir, 'sessions.json')).load();
    expect(reopened.sessions[0].documents).toEqual([project]);
    expect(reopened.sessions[1].documents?.[0].enabled).toBe(false);
    expect(reopened.sessions[2].documents).toBeUndefined();
  });
});
