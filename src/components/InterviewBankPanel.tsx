import { useMemo, useState } from 'react';
import { bankSource, companyLabel, bankQuestionText, bankSourceLabel, bankSearchText, interviewBank, tracks, type InterviewTrack, type InterviewCompany, type RetrievalResult } from '../../shared/interviewBank';

export function SourceCitation({ sourceId, company, zh }: { sourceId: string; company?: string; zh: boolean }) {
  const source = bankSource(sourceId);
  const [failed, setFailed] = useState(false);
  const label = source && bankSourceLabel(source, zh ? 'zh' : 'en');
  if (!source) return <p className="interview-caption">{zh ? '该来源不在当前题库中。' : 'Source absent from current bank.'}</p>;
  return <div className="source-citation">
    <span>{company ? companyLabel(company, zh ? 'zh' : 'en') : ''} · {source.kind === 'official' ? (zh ? '官方指南衍生练习' : 'Official guide exercise') : (zh ? '社区面经改编' : 'Community report adaptation')}</span>
    <button className="source-link" onClick={() => { void window.offerme.openInterviewSource(source.id).then(ok => setFailed(!ok)).catch(() => setFailed(true)); }}>{label?.title} ↗</button>
    <small>{label?.dateLabel}{source.access === 'search-index' ? (zh ? ' · 据公开索引整理' : ' · Public search index') : ''}</small>
    {failed && <small role="alert">{zh ? '无法打开来源，请稍后再试。' : 'Could not open source.'}</small>}
  </div>;
}

export function InterviewBankPanel({ zh, retrieval, track, company }: { zh: boolean; retrieval: RetrievalResult; track?: InterviewTrack; company?: InterviewCompany }) {
  const [search, setSearch] = useState('');
  const [browse, setBrowse] = useState(false);
  const rows = useMemo(() => interviewBank.questions.filter(q =>
    (!track || track === 'auto' || q.tracks.includes(track)) && (!company || company === 'all' || q.company === company) &&
    bankSearchText(q).toLowerCase().includes(search.trim().toLowerCase())), [track, company, search]);
  return <details className="interview-bank glass-card">
    <summary><span>{zh ? '面经资料库与检索依据' : 'Interview bank & retrieval'}</span><small>{interviewBank.questions.length} {zh ? '条' : 'questions'} · {interviewBank.sources.length} {zh ? '个来源' : 'sources'}</small></summary>
    <div className="bank-content">
      <p className="interview-caption">{zh ? `整理日期 ${interviewBank.checkedAt}。公开社区经验未经雇主确认，历史题不代表当前必考题；官方指南单独标注。` : `Curated ${interviewBank.checkedAt}. Community reports are not employer-verified; historical questions do not predict current interviews. Official guidelines are labeled.`}</p>
      <div className="bank-tabs"><button className={`btn btn-sm${!browse ? ' btn-on' : ''}`} onClick={() => setBrowse(false)}>{zh ? '下一组候选' : 'Next candidates'} ({retrieval.hits.length})</button><button className={`btn btn-sm${browse ? ' btn-on' : ''}`} onClick={() => setBrowse(true)}>{zh ? '浏览题库' : 'Browse bank'} ({rows.length})</button></div>
      {browse ? <>
        <input className="bank-search" aria-label={zh ? '搜索题库' : 'Search bank'} placeholder={zh ? '搜索考点；上方公司与方向筛选同样生效' : 'Search topics; uses company & direction filters above'} value={search} onChange={e => setSearch(e.target.value)}/>
        <div className="bank-coverage">{Object.entries(tracks).filter(([id]) => id !== 'auto').map(([id, labels]) => <span key={id}>{labels[zh ? 0 : 1]} {interviewBank.questions.filter(q => q.tracks.includes(id)).length}</span>)}</div>
      </> : <><p className="interview-caption">{zh ? '按简历、JD、已启用的项目／论文资料匹配。关键词与中英术语检索，不下载模型；生成时将这些题目交给回答 API 做关联改编。' : 'Matches your resume, JD and enabled documents using keywords and bilingual terms. No model download; your answer API adapts the retrieved questions.'}</p>{retrieval.warnings.map(w => <p className="interview-caption" key={w}>{w}</p>)}</>}
      <div className="bank-rows">{(browse ? rows : retrieval.hits.map(h => h.question)).map(q => {
        const hit = retrieval.hits.find(h => h.question.id === q.id);
        return <article className="bank-row" key={q.id}><p>{bankQuestionText(q, zh ? 'zh' : 'en')}</p><small>{q.tags.filter(tag => zh || !/[\u4e00-\u9fff]/.test(tag)).join(' · ')}</small>
          {!browse && hit && <small>{hit.repeated ? (zh ? '已出过 · 复习补充 · ' : 'Previously seen · Review · ') : ''}{hit.reason === 'track' ? (zh ? '所选方向基础练习' : 'Direction foundation') : `${zh ? '匹配词' : 'Matched terms'} · ${hit.matches.join(' / ')}`}</small>}
          <SourceCitation sourceId={q.sourceId} company={q.company} zh={zh}/></article>;
      })}{!(browse ? rows.length : retrieval.hits.length) && <p className="interview-caption">{zh ? '暂未匹配；请补充材料或调整筛选。' : 'No matches. Add materials or adjust filters.'}</p>}</div>
    </div>
  </details>;
}
