import { describe, expect, it, vi } from 'vitest';
import { interviewBank, retrieveInterviewQuestions, interviewSourceUrl, tracks, companies } from '../shared/interviewBank';
import { parseInterviewPlan, runInterview, buildInterviewMessages } from '../electron/llm/interview';
import { defaultInterviewOptions, interviewSourceKey, type InterviewRequest } from '../shared/interview';
import { paletteColors } from '../shared/appearance';

const retrieval = retrieveInterviewQuestions({ resume: '大模型项目使用 LoRA 微调 RAG 检索，结合知识库评估召回和重排。', count: 5 });
const response = () => ({ title: '练习', summary: '建议', questions: retrieval.hits.map(h => ({
  bankQuestionId: h.question.id, adaptation: 'adapted', projectLink: '检索项目', category: '项目',
  question: h.question.question, resumeEvidence: 'RAG', focus: '取舍', knowledgePoints: ['指标'], answerOutline: ['解释理由'], followUps: ['如何验证？'],
})) });

describe('curated corpus integrity', () => {
  it('omits personal attribution fields while preserving public source links and company filters', () => {
    const sourceFields = ['access', 'checkedAt', 'company', 'dateLabel', 'id', 'kind', 'publishedAt', 'role', 'title', 'url'];
    for (const source of interviewBank.sources) {
      expect(Object.keys(source).sort()).toEqual(sourceFields);
      expect(interviewSourceUrl(source.id)).toBe(source.url);
      expect(source.title.trim()).not.toBe('');
    }
    expect(JSON.stringify(interviewBank)).not.toMatch(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  });

  it('has unique IDs, declared tracks, resolvable sources and explicit dates', () => {
    expect(new Set(interviewBank.questions.map(q => q.id)).size).toBe(interviewBank.questions.length);
    expect(new Set(interviewBank.sources.map(s => s.id)).size).toBe(interviewBank.sources.length);
    for (const q of interviewBank.questions) {
      expect(interviewSourceUrl(q.sourceId)).toMatch(/^https:\/\//);
      expect(q.company in companies).toBe(true);
      for (const t of q.tracks) expect(t in tracks).toBe(true);
    }
    for (const s of interviewBank.sources) expect(s.dateLabel.length).toBeGreaterThan(0);
    expect(new Set(interviewBank.questions.map(q => q.question.replace(/\s+/g, '').toLowerCase())).size).toBe(interviewBank.questions.length);
    for (const t of Object.keys(tracks).filter(t => t !== 'auto')) expect(interviewBank.questions.filter(q => q.tracks.includes(t)).length).toBeGreaterThanOrEqual(20);
  });
  it('never opens a caller supplied URL or unknown source', () => {
    for (const id of ['https://evil.test', 'file:///tmp/example', '__proto__', null]) expect(interviewSourceUrl(id)).toBeNull();
  });
});

describe('material-based retrieval', () => {
  it.each([
    ['命名实体识别，解决嵌套实体，训练 BERT', 'baidu-ner'],
    ['ECAPA-TDNN 声纹识别，使用 EER 衡量说话人验证效果', 'speech-tdnn'],
    ['CUDA GPU 通信 allreduce', 'tx-cuda'],
    ['目标检测项目，使用 NMS 处理检测框', 'ali-nms'],
    ['微调模型，使用 LoRA 低秩矩阵', 'ali-lora'],
  ])('retrieves a relevant topic for %s', (resume, id) => {
    expect(retrieveInterviewQuestions({ resume, count: 5 }).hits.map(h => h.question.id)).toContain(id);
  });
  it('matches English terms to Chinese material and includes text at the end of long papers', () => {
    const result = retrieveInterviewQuestions({ resume: '候选人', documents: 'unrelated '.repeat(20000) + 'speaker verification ECAPA-TDNN EER', count: 5 });
    expect(result.hits.map(h => h.question.id)).toContain('speech-tdnn');
  });
  it('enforces direction and labels company supplementation honestly', () => {
    const result = retrieveInterviewQuestions({ resume: '语音识别 Whisper', track: 'speech', company: 'tencent', count: 5 });
    expect(result.hits).toHaveLength(5);
    expect(result.hits.every(h => h.question.tracks.includes('speech'))).toBe(true);
    expect(result.warnings.join()).toContain('其他公司');
    expect(result.hits.every(h => h.question.company !== 'tencent')).toBe(true);
  });
  it('does not fill no-match input with random questions; marks direction-only supplements', () => {
    expect(retrieveInterviewQuestions({ resume: 'zzunknownqq', count: 5 }).hits).toEqual([]);
    const count = interviewBank.questions.filter(q => q.tracks.includes('rl')).length + 1;
    const result = retrieveInterviewQuestions({ resume: 'zzunknownqq', track: 'rl', count });
    expect(result.hits.length).toBeLessThan(count);
    expect(result.hits.every(h => h.reason === 'track')).toBe(true);
    expect(result.warnings.join()).toContain('减少题数');
  });
  it('supplies three distinct rounds in the same direction before reviewing seen topics', () => {
    const seen: string[] = [];
    for (let round = 0; round < 3; round++) {
      const result = retrieveInterviewQuestions({ resume: '语音识别 CTC 流式 ASR', track: 'speech', count: 8, seenQuestionIds: seen });
      expect(result.hits).toHaveLength(8);
      expect(result.hits.every(h => h.question.tracks.includes('speech') && !h.repeated && !seen.includes(h.question.id))).toBe(true);
      seen.push(...result.hits.map(h => h.question.id));
    }
    expect(new Set(seen).size).toBe(24);
  });
  it('discloses exhausted company coverage instead of silently changing companies', () => {
    const eligible = interviewBank.questions.filter(q => q.tracks.includes('speech') && q.company === 'dolby');
    const seen = eligible.slice(2).map(q => q.id);
    const result = retrieveInterviewQuestions({ resume: '语音', track: 'speech', company: 'dolby', count: 5, seenQuestionIds: seen });
    expect(result.hits).toHaveLength(5);
    expect(result.hits.every(h => h.question.company === 'dolby')).toBe(true);
    expect(result.unseenAvailable).toBe(2);
    expect(result.hits.slice(0, 2).every(h => !h.repeated)).toBe(true);
    expect(result.hits.filter(h => h.repeated)).toHaveLength(3);
    expect(result.warnings.join()).toContain('3 条已出题目');
  });
  it('does not introduce unrelated topics to avoid repeats in auto mode', () => {
    const first = retrieveInterviewQuestions({ resume: 'ECAPA-TDNN', count: 5 });
    const seen = first.hits.map(h => h.question.id);
    const again = retrieveInterviewQuestions({ resume: 'ECAPA-TDNN', count: 5, seenQuestionIds: seen });
    expect(again.hits.map(h => h.question.id)).toEqual(seen);
    expect(again.hits.every(h => h.repeated)).toBe(true);
    expect(retrieveInterviewQuestions({ resume: 'zzunknownqq', count: 5, seenQuestionIds: seen }).hits).toEqual([]);
  });
});

describe('generation grounded in a retrieved set', () => {
  it('attaches only registry IDs, ignoring model URL or source claims', () => {
    const raw = response();
    Object.assign(raw.questions[0], { sourceId: 'fake', url: 'https://fake.test' });
    const parsed = parseInterviewPlan(JSON.stringify(raw), 5, retrieval);
    expect(parsed.questions[0].grounding?.sourceId).toBe(retrieval.hits[0].question.sourceId);
    expect(JSON.stringify(parsed)).not.toContain('fake');
  });
  it.each(['unknown', 'duplicate', 'missing', 'too-many-extensions'])('rejects %s source claims', mode => {
    const raw = response();
    if (mode === 'unknown') raw.questions[0].bankQuestionId = 'fabricated';
    if (mode === 'duplicate') raw.questions[0].bankQuestionId = raw.questions[1].bankQuestionId;
    if (mode === 'missing') raw.questions[0].bankQuestionId = '';
    if (mode === 'too-many-extensions') raw.questions.forEach(q => q.adaptation = 'extension');
    expect(() => parseInterviewPlan(JSON.stringify(raw), 5, retrieval)).toThrow();
  });
  it('uses only enabled documents, maintains full text, and invalidates changed material', () => {
    const docs = [
      { id: 'a', name: 'paper.pdf', kind: 'paper' as const, enabled: true, text: 'content '.repeat(9000) + 'PAPER_END', addedAt: 0 },
      { id: 'b', name: 'private.pdf', kind: 'project' as const, enabled: false, text: 'DISABLED_SECRET', addedAt: 0 },
    ];
    const input: InterviewRequest = { requestId: 'x', action: 'generate', resume: '简历', resumeName: 'resume.pdf', options: defaultInterviewOptions, documents: docs };
    const messages = buildInterviewMessages(input, retrieval);
    expect(JSON.stringify(messages)).toContain('PAPER_END');
    expect(JSON.stringify(messages)).not.toContain('DISABLED_SECRET');
    expect(messages[0].content).toContain('论文不代表');
    expect(interviewSourceKey('简历', '', docs)).not.toBe(interviewSourceKey('简历'));
    expect(interviewSourceKey('简历', '', docs)).toBe(interviewSourceKey('简历', '', [docs[0]]));
  });
  it('returns insufficient coverage before calling a paid API', async () => {
    const complete = vi.fn();
    const input: InterviewRequest = { action: 'generate', requestId: 'x', resume: 'zzunknownqq', resumeName: 'r.txt', options: defaultInterviewOptions };
    const result = await runInterview({ apiKey: 'placeholder', model: 'm', baseUrl: 'https://example.test' }, input, new AbortController().signal, complete);
    expect(result.ok).toBe(false);
    expect(complete).not.toHaveBeenCalled();
  });
  it('custom colors retain readable light/dark backgrounds and invalid values fall back safely', () => {
    expect(paletteColors('custom', 'bad')).toEqual(paletteColors('custom', '#8db69b'));
    const colors = paletteColors('custom', '#ff0000');
    expect(colors.light.split(',').every(c => +c >= 220)).toBe(true);
    expect(colors.dark.split(',').every(c => +c <= 36)).toBe(true);
  });
});
