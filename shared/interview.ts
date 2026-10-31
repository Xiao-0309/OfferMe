import type { InterviewTrack, InterviewCompany, RetrievalResult } from './interviewBank';
import { knownQuestionIds } from './interviewBank';
import type { ReferenceDocument } from './protocol';
/** Resume-based practice lives in each session; it never uses meeting transcripts. */
export interface InterviewOptions {
  role: string;
  track?: InterviewTrack;
  company?: InterviewCompany;
  preferUnseen?: boolean;
  difficulty: 'foundation' | 'standard' | 'advanced';
  count: 5 | 8 | 12;
  language: 'zh' | 'en';
}
export interface InterviewQuestion {
  id: string;
  category: string;
  question: string;
  resumeEvidence: string;
  focus: string;
  knowledgePoints: string[];
  answerOutline: string[];
  followUps: string[];
  grounding?: { bankQuestionId: string; sourceId: string; adaptation: 'adapted' | 'extension'; projectLink: string };
}
export interface InterviewPlan {
  title: string;
  summary: string;
  questions: InterviewQuestion[];
  createdAt: number;
  resumeName: string;
  model: string;
  sourceKey: string;
  retrieval?: RetrievalResult;
}
export interface InterviewFeedback {
  summary: string;
  strengths: string[];
  improvements: string[];
  nextQuestion: string;
}
export interface InterviewState {
  seenQuestionIds?: string[];
  options?: InterviewOptions;
  plan?: InterviewPlan;
  answers?: Record<string, string>;
  feedback?: Record<string, InterviewFeedback>;
  currentIndex?: number;
}
export type InterviewRequest = {
  requestId: string;
  resume: string;
  resumeName: string;
  jd?: string;
  documents?: ReferenceDocument[];
  seenQuestionIds?: string[];
  options: InterviewOptions;
} & ({ action: 'generate' } | { action: 'feedback'; question: InterviewQuestion; answer: string });
export type InterviewResult =
  | { ok: true; action: 'generate'; plan: InterviewPlan }
  | { ok: true; action: 'feedback'; feedback: InterviewFeedback }
  | { ok: false; error: string; cancelled?: boolean };

export const defaultInterviewOptions: InterviewOptions = { role: '', difficulty: 'standard', count: 8, language: 'en' };

/** Legacy plans also count as seen; only a successfully accepted new plan extends history. */
export function interviewHistoryIds(state: InterviewState, nextPlan?: InterviewPlan): string[] {
  return knownQuestionIds([
    ...(state.seenQuestionIds ?? []),
    ...[state.plan, nextPlan].flatMap(plan => plan?.questions.flatMap(q => q.grounding ? [q.grounding.bankQuestionId] : []) ?? []),
  ]);
}

/** Change detection only, not a cryptographic digest. Never sent as an identity. */
export function interviewSourceKey(resume: string, jd = '', documents: ReferenceDocument[] = []): string {
  const active = documents.filter(d => d.enabled).map(({ name, kind, text }) => ({ name, kind, text }));
  const input = JSON.stringify(active.length ? [resume, jd, active] : [resume, jd]);
  let hash = 2166136261;
  for (let i = 0; i < input.length; i++) hash = Math.imul(hash ^ input.charCodeAt(i), 16777619);
  return `${input.length}:${hash >>> 0}`;
}
