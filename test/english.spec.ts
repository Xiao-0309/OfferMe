import { describe, expect, it } from 'vitest';
import english from '../resources/interview-bank/en.json';
import { bankQuestionText, bankSourceLabel, companyLabel, companies, interviewBank, retrieveInterviewQuestions } from '../shared/interviewBank';
import { defaultSettings } from '../electron/settings';
import { buildInterviewMessages } from '../electron/llm/interview';
import { defaultInterviewOptions } from '../shared/interview';

describe('English onboarding and practice', () => {
  it('starts a fresh profile in English without requiring an OS locale change', () => {
    expect(defaultSettings().ui.lang).toBe('en');
    expect(defaultSettings().llm.answerLang).toBe('english');
  });

  it('covers every source and topic without replacing the original attribution', () => {
    expect(Object.keys(english.questions).sort()).toEqual(interviewBank.questions.map(q => q.id).sort());
    expect(Object.keys(english.sources).sort()).toEqual(interviewBank.sources.map(s => s.id).sort());
    for (const q of interviewBank.questions) {
      expect(bankQuestionText(q, 'en')).not.toMatch(/[\u4e00-\u9fff]/);
      expect(bankQuestionText(q, 'zh')).toBe(q.question);
    }
    for (const s of interviewBank.sources) {
      expect(JSON.stringify(bankSourceLabel(s, 'en'))).not.toMatch(/[\u4e00-\u9fff]/);
      expect(bankSourceLabel(s, 'zh').title).toBe(s.title);
    }
    for (const id of Object.keys(companies)) expect(companyLabel(id, 'en')).not.toMatch(/[\u4e00-\u9fff]/);
  });

  it('retrieves an English-only concept and supplies translated topics with original source IDs', () => {
    const retrieval = retrieveInterviewQuestions({ resume: 'Nested named entities', count: 5, language: 'en' });
    expect(retrieval.hits.map(h => h.question.id)).toContain('baidu-ner');
    const messages = buildInterviewMessages({ requestId: 'demo', action: 'generate', resume: 'Nested named entities', resumeName: 'synthetic-resume.txt', options: defaultInterviewOptions }, retrieval);
    const payload = JSON.parse(messages[1].content as string);
    expect(payload.retrievedQuestions.every((q: { question: string }) => !/[\u4e00-\u9fff]/.test(q.question))).toBe(true);
    expect(payload.retrievedQuestions.map((q: { sourceId: string }) => q.sourceId)).toEqual(retrieval.hits.map(h => h.question.sourceId));
    expect(messages[0].content).toContain('Write all values in English');
  });

  it('explains limited company coverage in the selected language', () => {
    const result = retrieveInterviewQuestions({ resume: 'speech', track: 'speech', company: 'tencent', count: 5, language: 'en' });
    expect(result.warnings.join()).toContain('Other companies');
    expect(result.warnings.join()).not.toMatch(/[\u4e00-\u9fff]/);
  });
});
