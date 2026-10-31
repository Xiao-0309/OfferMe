import { retrieveInterviewQuestions, tracks, companies, companyLabel, bankQuestionText, type InterviewTrack, type InterviewCompany } from '../../shared/interviewBank';
import { InterviewBankPanel, SourceCitation } from './InterviewBankPanel';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { StoredSession } from '../../shared/protocol';
import { defaultInterviewOptions, interviewSourceKey, interviewHistoryIds, type InterviewState, type InterviewOptions, type InterviewRequest } from '../../shared/interview';
import { Icon } from './Icon';

interface Props {
  session: StoredSession;
  zh: boolean;
  ready: boolean;
  model: string;
  notice: string | null;
  onPatch: (update: (state: InterviewState) => InterviewState) => void;
  onImport: (slot: 'resume' | 'jd') => Promise<void>;
  onSettings: () => void;
  onMaterials: () => void;
}
export function InterviewPanel({ session, zh, ready, model, notice, onPatch, onImport, onSettings, onMaterials }: Props) {
  const state = session.interview ?? {};
  const options = state.options ?? { ...defaultInterviewOptions, language: zh ? 'zh' : 'en' };
  const plan = state.plan;
  const [busy, setBusy] = useState<'generate' | 'feedback' | 'import' | null>(null);
  const [error, setError] = useState('');
  const [practice, setPractice] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const request = useRef<string | null>(null);
  const mounted = useRef(true);
  const currentIndex = Math.min(state.currentIndex ?? 0, Math.max(0, (plan?.questions.length ?? 1) - 1));
  const question = plan?.questions[currentIndex];
  const answer = question ? state.answers?.[question.id] ?? '' : '';
  const feedback = question ? state.feedback?.[question.id] : undefined;
  const stale = !!plan && plan.sourceKey !== interviewSourceKey(session.resumeText ?? '', session.jdText, session.documents);
  const seenQuestionIds = useMemo(() => interviewHistoryIds(state), [state.seenQuestionIds, plan]);
  const retrieval = useMemo(() => retrieveInterviewQuestions({ resume: session.resumeText ?? '', jd: session.jdText,
    role: options.role, documents: session.documents?.filter(d => d.enabled).map(d => d.text).join('\n'),
    track: options.track, company: options.company, count: options.count, language: zh ? 'zh' : 'en',
    seenQuestionIds: options.preferUnseen !== false ? seenQuestionIds : undefined }),
    [session.resumeText, session.jdText, session.documents, options.role, options.track, options.company, options.count, options.preferUnseen, seenQuestionIds, zh]);
  const basis = question?.grounding && plan?.retrieval?.hits.find(h => h.question.id === question.grounding?.bankQuestionId);
  const tr = (cn: string, en: string) => zh ? cn : en;
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; if (request.current) window.offerme.cancelInterview(request.current); };
  }, []);
  useEffect(() => { setRevealed(false); }, [question?.id, plan?.createdAt]);
  function changeOptions(patch: Partial<InterviewOptions>) {
    onPatch(s => ({ ...s, options: { ...options, ...patch } }));
  }
  async function importFile(slot: 'resume' | 'jd') {
    setError(''); setBusy('import');
    try { await onImport(slot); } catch { if (mounted.current) setError(tr('导入失败，请重试或换一个文件。', 'Import failed. Try again or choose another file.')); }
    finally { if (mounted.current) setBusy(null); }
  }
  function cancel() {
    if (request.current) window.offerme.cancelInterview(request.current);
    request.current = null; setBusy(null);
    setError(tr('已取消，原练习内容已保留。', 'Cancelled. Your previous practice is kept.'));
  }
  async function run(action: 'generate' | 'feedback') {
    if (request.current || busy || !session.resumeText?.trim() || !ready) return;
    if (action === 'feedback' && (!question || !answer.trim() || stale)) return;
    const requestId = crypto.randomUUID();
    request.current = requestId; setBusy(action); setError('');
    const common = { requestId, resume: session.resumeText, resumeName: session.resumeName ?? '', jd: session.jdText, documents: session.documents?.filter(d => d.enabled), options, seenQuestionIds };
    const input: InterviewRequest = action === 'generate' ? { ...common, action } : { ...common, action, question: question!, answer };
    try {
      const result = await window.offerme.runInterview(input);
      if (!mounted.current || request.current !== requestId) return;
      if (!result.ok) { setError(result.error); return; }
      if (result.action === 'generate') {
        onPatch(s => ({ ...s, options, plan: result.plan, seenQuestionIds: interviewHistoryIds(s, result.plan), answers: {}, feedback: {}, currentIndex: 0 }));
        setPractice(false); setRevealed(false);
      } else {
        const id = question!.id;
        onPatch(s => ({ ...s, feedback: { ...s.feedback, [id]: result.feedback } }));
      }
    } catch {
      if (mounted.current && request.current === requestId) setError(tr('请求失败，请检查回答服务后重试。原练习已保留。', 'Request failed. Check the answer service and retry. Your previous practice is kept.'));
    } finally {
      if (mounted.current && request.current === requestId) { request.current = null; setBusy(null); }
    }
  }
  const notes = question && <div className="interview-notes">
    <section><h3>{tr('为什么会问', 'What it tests')}</h3><p>{question.focus}</p><blockquote>{question.resumeEvidence}</blockquote></section>
    <section><h3>{tr('需要掌握的知识点', 'Knowledge to review')}</h3><ul>{question.knowledgePoints.map((item, i) => <li key={i}>{item}</li>)}</ul></section>
    <section><h3>{tr('回答思路', 'Answer outline')}</h3><ol>{question.answerOutline.map((item, i) => <li key={i}>{item}</li>)}</ol></section>
    <section><h3>{tr('可能的追问', 'Follow-up questions')}</h3><ul>{question.followUps.map((item, i) => <li key={i}>{item}</li>)}</ul></section>
  </div>;
  return <section className="interview-panel" aria-label={tr('模拟面试', 'Mock interview')}>
    <div className="interview-hero"><div className="section-icon"><Icon name="spark" size={22}/></div><div><span className="eyebrow">INTERVIEW STUDIO</span><h2>{tr('从你的经历，开始一场练习', 'Turn your experience into practice')}</h2><p>{tr('从有出处的面经中检索，结合你的项目深入追问。', 'Prepare tailored questions, understand the concepts, then practice in your own words.')}</p></div></div>
    <div className="interview-config glass-card">
      <div className="interview-upload-row">
        <button className="btn" onClick={() => void importFile('resume')} disabled={!!busy}><Icon name="file"/>{session.resumeName ? tr('更换简历', 'Replace resume') : tr('上传简历', 'Upload resume')}</button>
        <span className="interview-filename" title={session.resumeName}>{session.resumeName ? `${session.resumeName} · ${session.resumeText?.length ?? 0} ${tr('字', 'chars')}` : tr('支持 PDF、Word、TXT、Markdown', 'PDF, Word, TXT or Markdown')}</span>
        <button className="btn btn-quiet" onClick={() => void importFile('jd')} disabled={!!busy}><Icon name="plus" size={14}/>{session.jdName ? tr('更换 JD', 'Replace JD') : tr('添加 JD（可选）', 'Add JD (optional)')}</button>
      </div>
      {session.resumeText && <details className="interview-resume"><summary>{tr('查看提取的简历文字', 'Preview extracted resume')}</summary><pre>{session.resumeText}</pre></details>}
      {session.jdName && <p className="interview-caption">JD · {session.jdName}</p>}
      <div className="interview-options">
        <label>{tr('算法方向', 'Direction')}<select aria-label={tr('算法方向', 'Direction')} value={options.track ?? 'auto'} disabled={!!busy} onChange={e => changeOptions({ track: e.target.value as InterviewTrack })}>{Object.entries(tracks).map(([id, name]) => <option key={id} value={id}>{name[zh ? 0 : 1]}</option>)}</select></label>
        <label>{tr('公司偏好', 'Company preference')}<select aria-label={tr('公司偏好', 'Company preference')} value={options.company ?? 'all'} disabled={!!busy} onChange={e => changeOptions({ company: e.target.value as InterviewCompany })}>{Object.keys(companies).map(id => <option key={id} value={id}>{companyLabel(id, zh ? 'zh' : 'en')}</option>)}</select></label>
        <label className="interview-role">{tr('目标岗位', 'Target role')}<input value={options.role} placeholder={tr('留空则根据简历推荐方向', 'Leave blank to infer from your resume')} disabled={!!busy} onChange={e => changeOptions({ role: e.target.value })}/></label>
        <label>{tr('难度', 'Difficulty')}<select value={options.difficulty} disabled={!!busy} onChange={e => changeOptions({ difficulty: e.target.value as InterviewOptions['difficulty'] })}><option value="foundation">{tr('基础', 'Foundation')}</option><option value="standard">{tr('标准', 'Standard')}</option><option value="advanced">{tr('深入追问', 'Advanced')}</option></select></label>
        <label>{tr('题数', 'Questions')}<select aria-label={tr('题数', 'Question count')} value={options.count} disabled={!!busy} onChange={e => changeOptions({ count: Number(e.target.value) as InterviewOptions['count'] })}>{[5, 8, 12].map(n => <option value={n} key={n}>{n}</option>)}</select></label>
        <label>{tr('语言', 'Language')}<select value={options.language} disabled={!!busy} onChange={e => changeOptions({ language: e.target.value as 'zh' | 'en' })}><option value="zh">中文</option><option value="en">English</option></select></label>
        <button className="btn btn-primary" disabled={!!busy || !ready || !session.resumeText?.trim()} onClick={() => void run('generate')}><Icon name="spark" size={15}/>{busy === 'generate' ? tr('正在准备题目…', 'Preparing…') : plan ? tr('重新生成', 'Regenerate') : tr('生成面试题', 'Generate questions')}</button>
      </div>
      <div className="interview-variety"><label><input type="checkbox" checked={options.preferUnseen !== false} disabled={!!busy} onChange={e => changeOptions({ preferUnseen: e.target.checked })}/>{tr('优先未出过的题', 'Prefer unseen questions')}</label><span>{tr(`本会话已出 ${seenQuestionIds.length} 条 · 当前筛选匹配 ${retrieval.available} 条`, `${seenQuestionIds.length} seen in this session · ${retrieval.available} eligible`)}{options.preferUnseen !== false ? tr(` · 未出 ${retrieval.unseenAvailable ?? 0} 条`, ` · ${retrieval.unseenAvailable ?? 0} unseen`) : ''}</span></div>
      <p className="interview-caption">{tr('文件在本机提取文字；生成或点评会将简历、JD、已启用的项目／论文资料及练习内容发送给回答 API。练习按会话保存。', 'Files are parsed locally. Generating questions or feedback sends your resume, JD, enabled documents and practice to your configured text answer API. Practice is saved per session on this device.')} · {model || tr('尚未配置模型', 'No model configured')}</p>
      <p className="interview-caption"><button className="btn btn-sm" disabled={!!busy} onClick={onMaterials}>{tr('管理项目／论文资料', 'Manage project / paper files')}</button> · {session.documents?.filter(d => d.enabled).length ?? 0} {tr('份已启用资料参与匹配；论文仅作参考，不视为你的成果。', 'enabled documents; papers are references, not assumed to be your work.')}</p>
      {!ready && <p className="interview-caption"><button className="btn btn-sm" onClick={onSettings}>{tr('配置回答 API', 'Configure answer API')}</button></p>}
      {busy && busy !== 'import' && <p className="interview-progress" role="status">{tr('模型正在分析，请稍候…', 'The model is working…')} <button className="btn btn-sm" onClick={cancel}>{tr('取消', 'Cancel')}</button></p>}
      {error && <p className="interview-error" role="alert">{error}</p>}
      {notice && <p className="interview-error" role="alert">{notice}</p>}
    </div>
    <InterviewBankPanel zh={zh} retrieval={retrieval} track={options.track} company={options.company}/>
    {plan && <>
      <div className="interview-plan-head"><div><h2>{plan.title}</h2><p>{plan.summary}</p><span className="interview-caption">{plan.resumeName} · {plan.questions.length} {tr('题', 'questions')} · {plan.model}</span></div><button className={`btn${practice ? ' btn-on' : ''}`} onClick={() => { setPractice(v => !v); setRevealed(false); }}>{practice ? tr('查看题目与知识点', 'Study questions') : tr('开始逐题练习', 'Practice one by one')}</button></div>
      {!plan.retrieval && <p className="interview-caption">{tr('这是旧版练习，未记录面经出处。重新生成可使用资料库。', 'Legacy practice without source citations. Regenerate to use the bank.')}</p>}
      {stale && <p className="interview-error" role="status">{tr('简历、JD 或参考资料已更换；以下是之前的题目，请重新生成后再获取点评。', 'Your resume, JD or reference documents changed. These are previous questions; regenerate before requesting feedback.')}</p>}
      <div className="interview-body"><nav className="interview-question-list" aria-label={tr('面试题目', 'Interview questions')}>
        {plan.questions.map((q, index) => <button key={q.id} className={`interview-question-nav${currentIndex === index ? ' is-active' : ''}`} onClick={() => onPatch(s => ({ ...s, currentIndex: index }))} disabled={busy === 'feedback'}><span>{String(index + 1).padStart(2, '0')}</span><div><small>{q.category}{state.answers?.[q.id]?.trim() ? ' · ✓' : ''}</small><p>{q.question}</p></div></button>)}
      </nav><article className="interview-question glass-card" aria-live="polite">
        {question && <><span className="eyebrow">{tr('第', 'QUESTION')} {currentIndex + 1} / {plan.questions.length} · {question.category}</span><h2>{question.question}</h2>
          {question.grounding && <aside className="question-grounding">
            <span className="eyebrow">{question.grounding.adaptation === 'extension' ? tr('延伸练习', 'Extension') : tr('基于资料库改编', 'Bank adaptation')}</span>
            <p>{question.grounding.projectLink}</p>
            {basis && <details><summary>{tr('查看题库考点与匹配依据', 'Original topic & match')}</summary><p>{bankQuestionText(basis.question, zh ? 'zh' : 'en')}</p><small>{basis.reason === 'track' ? tr('按所选方向补充', 'Direction-based match') : basis.matches.join(' · ')}</small></details>}
            <SourceCitation sourceId={question.grounding.sourceId} company={basis?.question.company} zh={zh}/>
          </aside>}
          {practice && <div className="interview-practice">
            <label htmlFor="practice-answer">{tr('你的回答', 'Your answer')}</label><textarea id="practice-answer" value={answer} disabled={!!busy} placeholder={tr('先独立回答，再查看知识点或获取点评。', 'Try answering before revealing notes or requesting feedback.')} onChange={e => { const value = e.target.value; onPatch(s => { const nextFeedback = { ...s.feedback }; delete nextFeedback[question.id]; return { ...s, answers: { ...s.answers, [question.id]: value }, feedback: nextFeedback }; }); }}/>
            <div className="interview-actions"><button className="btn btn-primary" disabled={!!busy || !answer.trim() || !ready || stale} onClick={() => void run('feedback')}>{busy === 'feedback' ? tr('正在点评…', 'Reviewing…') : tr('获取 AI 点评', 'Get AI feedback')}</button><button className="btn" onClick={() => setRevealed(v => !v)}>{revealed ? tr('隐藏知识点', 'Hide notes') : tr('查看知识点与思路', 'Reveal notes')}</button></div>
            {feedback && <div className="interview-feedback"><h3>{tr('练习点评', 'Practice feedback')}</h3><p>{feedback.summary}</p><h4>{tr('做得好的地方', 'Strengths')}</h4><ul>{feedback.strengths.map((s, i) => <li key={i}>{s}</li>)}</ul><h4>{tr('可以改进', 'Improvements')}</h4><ul>{feedback.improvements.map((s, i) => <li key={i}>{s}</li>)}</ul><p><strong>{tr('继续想一想：', 'Follow-up: ')}</strong>{feedback.nextQuestion}</p></div>}
          </div>}
          {(!practice || revealed) && notes}
          <div className="interview-actions interview-pagination"><button className="btn" disabled={currentIndex === 0 || !!busy} onClick={() => onPatch(s => ({ ...s, currentIndex: currentIndex - 1 }))}>{tr('上一题', 'Previous')}</button><span>{tr('已练习', 'Answered')} {plan.questions.filter(q => state.answers?.[q.id]?.trim()).length} / {plan.questions.length}</span><button className="btn" disabled={currentIndex === plan.questions.length - 1 || !!busy} onClick={() => onPatch(s => ({ ...s, currentIndex: currentIndex + 1 }))}>{tr('下一题', 'Next')}<Icon name="arrow" size={14}/></button></div>
        </>}
      </article></div>
    </>}
    {!plan && <div className="interview-empty"><Icon name="book" size={30}/><h3>{tr('把简历里的每个亮点，准备成有依据的回答', 'Be ready to explain every highlight on your resume')}</h3><p>{tr('项目深挖 · 核心知识 · 设计取舍 · 经验复盘', 'Project deep dives · Key concepts · Trade-offs · Reflection')}</p></div>}
  </section>;
}
