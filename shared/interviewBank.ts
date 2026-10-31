import seed from '../resources/interview-bank/seed.json';
import english from '../resources/interview-bank/en.json';
import type { UiLang } from './protocol';

export const tracks = {
  auto: ['自动匹配', 'Auto'], llm: ['大模型与 Agent', 'LLM & agents'], nlp: ['自然语言处理', 'NLP'],
  recommendation: ['推荐／搜索／广告', 'Recommendation & search'], cv: ['计算机视觉', 'Computer vision'],
  multimodal: ['多模态与生成', 'Multimodal'], speech: ['语音与音频', 'Speech & audio'],
  rl: ['强化学习', 'Reinforcement learning'], infra: ['AI Infra', 'AI Infra'], general: ['机器学习与算法基础', 'ML & algorithms'],
} as const;
export type InterviewTrack = keyof typeof tracks;
export const companies = {
  all: '全部公司', bytedance: '字节跳动', alibaba: '阿里巴巴', tencent: '腾讯', meituan: '美团',
  baidu: '百度', kuaishou: '快手', xiaohongshu: '小红书', sensetime: '商汤', vivo: 'vivo',
  jd: '京东', didi: '滴滴', aibee: 'Aibee', dolby: '杜比', geely: '吉利／极氪', byd: '比亚迪',
  zuoyebang: '作业帮', iflytek: '科大讯飞',
  amazon: 'Amazon', microsoft: 'Microsoft', multiple: '多家公司（未逐题归属）',
} as const;
export type InterviewCompany = keyof typeof companies;
export interface BankSource {
  id: string; title: string; url: string; company: string; role: string; publishedAt: string | null;
  dateLabel: string; kind: 'community' | 'official'; access: 'page' | 'search-index'; checkedAt: string;
}
export interface BankQuestion {
  id: string; sourceId: string; company: string; tracks: string[]; category: string; question: string; tags: string[];
}
const englishCompanies: Record<InterviewCompany, string> = {
  all: 'All companies', bytedance: 'ByteDance', alibaba: 'Alibaba', tencent: 'Tencent', meituan: 'Meituan',
  baidu: 'Baidu', kuaishou: 'Kuaishou', xiaohongshu: 'Xiaohongshu', sensetime: 'SenseTime', vivo: 'vivo',
  jd: 'JD', didi: 'DiDi', aibee: 'Aibee', dolby: 'Dolby', geely: 'Geely / Zeekr', byd: 'BYD',
  zuoyebang: 'Zuoyebang', iflytek: 'iFLYTEK', amazon: 'Amazon', microsoft: 'Microsoft', multiple: 'Multiple companies (not individually attributed)',
};
const englishQuestions: Record<string, string> = english.questions;
const englishSources: Record<string, { title: string; dateLabel: string }> = english.sources;
export function companyLabel(id: string, lang: UiLang): string {
  return (lang === 'en' ? englishCompanies : companies)[id as InterviewCompany] ?? id;
}
export function bankQuestionText(question: BankQuestion, lang: UiLang): string {
  return lang === 'en' ? englishQuestions[question.id] ?? question.question : question.question;
}
export function bankSourceLabel(source: BankSource, lang: UiLang): { title: string; dateLabel: string } {
  return lang === 'en' ? englishSources[source.id] ?? source : source;
}
/** Keep original source text and IDs intact; translations are an independent display/search layer. */
export function bankSearchText(question: BankQuestion): string {
  return [question.question, englishQuestions[question.id] ?? '', ...question.tags, ...question.tracks].join(' ');
}
export const interviewBank = seed as { version: string; checkedAt: string; sources: BankSource[]; questions: BankQuestion[] };
export const bankSource = (id: string) => interviewBank.sources.find(s => s.id === id);
export function interviewSourceUrl(id: unknown): string | null {
  if (typeof id !== 'string') return null;
  const source = bankSource(id);
  if (!source) return null;
  const url = new URL(source.url);
  return url.protocol === 'https:' && !url.username && !url.password &&
    ['www.nowcoder.com', 'ac.nowcoder.com', 'amazon.jobs', 'careers.microsoft.com'].includes(url.hostname) ? source.url : null;
}

// Small, inspectable lexical index. These aliases connect Chinese resumes and English papers.
const aliases = [
  ['llm', '大模型', 'large language model'], ['nlp', '自然语言', 'natural language'],
  ['cv', '计算机视觉', 'computer vision', '目标检测', 'object detection'],
  ['speech', '语音', '音频', 'audio', 'asr', 'tts'], ['rl', '强化学习', 'reinforcement learning', 'ppo', 'grpo', 'dpo'],
  ['recommendation', '推荐', '搜广推', '搜推', 'recommender'], ['multimodal', '多模态', '图文'],
  ['infra', '分布式', 'cuda', 'gpu', '推理优化'], ['retrieval', '检索', '召回', 'rag'],
  ['rerank', '重排', '精排', 'ranking'], ['finetuning', '微调', 'lora', 'sft', 'fine-tuning'],
  ['contrastive', '对比学习', 'infonce'], ['evaluation', '评估', '指标', 'metric'],
  ['diffusion', '扩散', 'ddpm', 'flow matching'], ['ner', '命名实体', '序列标注'],
  ['general', '机器学习', 'machine learning'], ['optimization', '优化器', '梯度', 'optimizer'],
];
const stop = new Set(['项目', '使用', '负责', '我们', '如何', '一个', '进行', '可以', '相关', '以及', '中的', '什么', '哪些', 'the', 'and', 'with', 'for', 'of', 'to', 'a', 'an', 'in', 'on', 'how', 'would', 'you', 'your', 'is', 'are', 'do', 'does', 'what', 'which', 'it', 'its', 'from', 'or', 'as', 'by', 'at', 'that']);
function tokens(text: string): string[] {
  const lower = text.toLowerCase();
  const result = (lower.match(/[a-z][a-z0-9-]*/g) ?? []).filter(t => !stop.has(t));
  for (const run of lower.match(/[\u4e00-\u9fff]+/g) ?? []) {
    for (let i = 0; i < run.length - 1; i++) { const t = run.slice(i, i + 2); if (!stop.has(t)) result.push(t); }
  }
  for (const [key, ...terms] of aliases) {
    if ([key, ...terms].some(t => /[\u4e00-\u9fff]/.test(t) ? lower.includes(t) : new RegExp(`\\b${t}\\b`, 'i').test(lower))) result.push(`concept:${key}`);
  }
  return result;
}
const index = interviewBank.questions.map(q => {
  const all = tokens(bankSearchText(q));
  const frequencies = new Map<string, number>();
  for (const t of all) frequencies.set(t, (frequencies.get(t) ?? 0) + 1);
  return { q, frequencies, length: all.length };
});
const averageLength = index.reduce((n, x) => n + x.length, 0) / index.length;
const frequency = new Map<string, number>();
for (const doc of index) for (const t of doc.frequencies.keys()) frequency.set(t, (frequency.get(t) ?? 0) + 1);
export interface RetrievalHit { question: BankQuestion; score: number; matches: string[]; reason: 'content' | 'track'; repeated?: boolean; }
export interface RetrievalResult { version: string; hits: RetrievalHit[]; available: number; unseenAvailable?: number; warnings: string[]; }
export interface RetrievalInput { resume: string; jd?: string; role?: string; documents?: string; track?: InterviewTrack; company?: InterviewCompany; count: number; seenQuestionIds?: readonly string[]; language?: UiLang; }

/** Keep history bounded to this corpus, preserving stable IDs across bank releases. */
export function knownQuestionIds(ids: readonly string[]): string[] {
  const known = new Set(interviewBank.questions.map(q => q.id));
  return [...new Set(ids)].filter(id => known.has(id));
}

/** BM25 + explicit direction/company preferences, with source diversity. Never fills with unsourced questions. */
export function retrieveInterviewQuestions(input: RetrievalInput): RetrievalResult {
  const seen = new Set(input.seenQuestionIds ?? []);
  const en = input.language === 'en';
  const query = new Map<string, number>();
  for (const [content, weight] of [[input.resume, 1], [input.documents ?? '', 1], [input.jd ?? '', 1.5], [input.role ?? '', 2]] as const) {
    for (const t of new Set(tokens(content))) query.set(t, (query.get(t) ?? 0) + weight);
  }
  const ranked = index.flatMap(({ q, frequencies, length }) => {
    if (input.track && input.track !== 'auto' && !q.tracks.includes(input.track)) return [];
    let score = 0;
    const matches: string[] = [];
    for (const [t, weight] of query) {
      const tf = frequencies.get(t) ?? 0;
      if (!tf) continue;
      const df = frequency.get(t) ?? 0;
      score += weight * Math.log(1 + (index.length - df + .5) / (df + .5)) * tf * 2.2 / (tf + 1.2 * (.25 + .75 * length / averageLength));
      matches.push(t.replace('concept:', ''));
    }
    const reason = score > 0 ? 'content' as const : 'track' as const;
    if (!score && (!input.track || input.track === 'auto')) return [];
    return [{ question: q, score: Math.round(score * 100) / 100, matches: [...new Set(matches)].slice(0, 6), reason, repeated: seen.has(q.id) }];
  });
  const preferred = input.company && input.company !== 'all' ? ranked.filter(h => h.question.company === input.company) : [];
  const warnings: string[] = [];
  if (input.company && input.company !== 'all' && preferred.length < input.count) warnings.push(en ? `${preferred.length} matches for the preferred company. Other companies will supplement this set; each topic retains its actual source.` : `目标公司匹配 ${preferred.length} 条，不足部分会补充其他公司来源，逐题保留实际出处。`);
  const pool = preferred.length >= input.count ? preferred : ranked;
  const unseenAvailable = pool.filter(h => !h.repeated).length;
  if (seen.size && unseenAvailable < input.count && pool.length >= input.count) warnings.push(en ? `${unseenAvailable} unseen topics remain. This set includes ${input.count - unseenAvailable} previously seen topics for review; change the direction or company for broader coverage.` : `当前筛选还剩 ${unseenAvailable} 条未出题目，本组将包含 ${input.count - unseenAvailable} 条已出题目用于复习；可调整方向或公司。`);
  const hits: RetrievalHit[] = [];
  const usedSources = new Map<string, number>();
  while (pool.length && hits.length < input.count) {
    pool.sort((a, b) => {
      // Recency is a preference within the eligible material/direction/company pool.
      // Do not use random unrelated questions just to avoid a repeat.
      if (a.repeated !== b.repeated) return a.repeated ? 1 : -1;
      const rank = (h: RetrievalHit) => (h.score + 1) * (h.question.company === input.company ? 1.3 : 1) / (1 + .18 * (usedSources.get(h.question.sourceId) ?? 0));
      return rank(b) - rank(a) || a.question.id.localeCompare(b.question.id);
    });
    const hit = pool.shift()!; hits.push(hit);
    usedSources.set(hit.question.sourceId, (usedSources.get(hit.question.sourceId) ?? 0) + 1);
  }
  if (hits.some(h => h.reason === 'track')) warnings.push(en ? 'Some topics match the selected direction without a direct material keyword match; they are labeled as foundation exercises.' : '部分题目按所选方向补充，尚未在材料中找到直接关键词依据，将标明为基础练习。');
  if (hits.length < input.count) warnings.push(en ? `Only ${hits.length} matching topics. Reduce the count, add materials or broaden the direction.` : `只找到 ${hits.length} 条匹配题目；请减少题数、补充材料或放宽方向。`);
  return { version: interviewBank.version, hits, available: hits.length + pool.length, unseenAvailable, warnings };
}
