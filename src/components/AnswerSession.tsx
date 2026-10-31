/* Modified for OfferMe (2026); derived from MeetingCopilot. See UPSTREAM.md. */
import type { ReactNode } from 'react';
import { useEffect, useRef, useState } from 'react';
import type { KbSlot, StoredSession } from '../../shared/protocol';
import { Icon } from './Icon';
import { useT } from '../i18n';

export type TurnKind = 'segment' | 'continuous' | 'free' | 'translate' | 'vision';

export interface AnswerTurn {
  id: string;
  kind: TurnKind;
  label: string;
  text: string;
  status: 'streaming' | 'done' | 'error';
  error?: string;
}

/**
 * 智能体 conversation panel (R4) with a multi-session bar. Answers ACCUMULATE
 * as a scrolling session (never replaced); each meeting is its own session
 * with its own knowledge base. The 📷 screenshot button only appears in
 * multimodal mode (it needs a vision model).
 */
export function AnswerSession({
  sessions,
  currentId,
  turns,
  resumeName,
  resumeChars,
  jdName,
  jdChars,
  notice,
  documentsPanel,
  visionReady,
  answersReady,
  answersHint,
  onSwitch,
  onNew,
  onDelete,
  onRename,
  onPickKb,
  onClearKb,
  onCancel,
  onClear,
  onFreeAsk,
  onShotAsk,
}: {
  documentsPanel?: ReactNode;
  sessions: StoredSession[];
  currentId: string;
  turns: AnswerTurn[];
  resumeName?: string;
  resumeChars: number;
  jdName?: string;
  jdChars: number;
  /** transient parse warning (e.g. scanned PDF with no text layer) */
  notice?: string | null;
  visionReady: boolean;
  /** false = no LLM configured; asking is disabled with an explanation */
  answersReady: boolean;
  answersHint: string;
  onSwitch: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
  onRename: (id: string, name: string) => void;
  onPickKb: (slot: KbSlot) => void;
  onClearKb: (slot: KbSlot) => void;
  onCancel: (id: string) => void;
  onClear: () => void;
  onFreeAsk: (question: string) => void;
  onShotAsk: (question: string, imageDataUrl?: string) => void;
}) {
  const t = useT();
  const boxRef = useRef<HTMLDivElement>(null);
  const stick = useRef(true);
  const inputRef = useRef<HTMLInputElement>(null);
  const [editing, setEditing] = useState(false);
  const [nameDraft, setNameDraft] = useState('');
  const currentName = sessions.find((s) => s.id === currentId)?.name ?? '';

  useEffect(() => {
    if (stick.current && boxRef.current) boxRef.current.scrollTop = turns.length ? boxRef.current.scrollHeight : 0;
  });

  const onScroll = () => {
    const el = boxRef.current;
    if (!el) return;
    stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 48;
  };

  const submit = () => {
    const q = inputRef.current?.value.trim();
    if (!q) return;
    onFreeAsk(q);
    if (inputRef.current) inputRef.current.value = '';
  };

  return (
    <section className="pane pane-answer">
      <header className="pane-head session-bar">
        <div className="section-heading"><span className="section-icon"><Icon name="spark"/></span><div><h2>{t.uiLang === 'zh' ? 'AI 问答' : 'AI answers'}</h2><span>{t.uiLang === 'zh' ? '结合对话与本场资料' : 'Grounded in your conversation & documents'}</span></div></div>
        <div className="pane-head-actions">
          <button className="icon-button" title={t.answer.renameTitle} aria-label={t.answer.renameTitle} onClick={() => { setNameDraft(currentName); setEditing(!editing); }}><Icon name="edit" size={16}/></button>
          <button className="icon-button" title={t.answer.deleteTitle} aria-label={t.answer.deleteTitle} onClick={() => onDelete(currentId)}><Icon name="trash" size={16}/></button>
          <button className="btn btn-sm btn-quiet" onClick={onClear} title={t.answer.clearTitle}>{t.answer.clear}</button>
        </div>
      </header>
      {editing && <form className="session-rename" onSubmit={(event) => { event.preventDefault(); onRename(currentId, nameDraft); setEditing(false); }}><input autoFocus value={nameDraft} onChange={(event) => setNameDraft(event.target.value)} aria-label={t.answer.renameTitle} onKeyDown={(event) => { if(event.key === 'Escape') setEditing(false); }}/><button type="submit" className="btn btn-sm">{t.uiLang === 'zh' ? '保存名称' : 'Save name'}</button></form>}
      <div className="material-strip"><span>{t.uiLang === 'zh' ? '回答背景' : 'CONTEXT'}</span>        <button
          className={resumeChars > 0 ? 'btn btn-sm btn-on' : 'btn btn-sm'}
          onClick={() => onPickKb('resume')}
          title={
            resumeChars > 0
              ? t.answer.resumeSetTitle(resumeName ?? '', resumeChars)
              : t.answer.resumeEmptyTitle
          }
        >
          <Icon name="file" size={14}/>{t.answer.resume}{resumeChars > 0 && <Icon name="check" size={12}/>}
        </button>
        {resumeChars > 0 && (
          <button className="btn btn-sm" onClick={() => onClearKb('resume')} title={t.answer.resumeRemoveTitle}>
            ×
          </button>
        )}
        <button
          className={jdChars > 0 ? 'btn btn-sm btn-on' : 'btn btn-sm'}
          onClick={() => onPickKb('jd')}
          title={jdChars > 0 ? t.answer.jdSetTitle(jdName ?? '', jdChars) : t.answer.jdEmptyTitle}
        >
          <Icon name="file" size={14}/>{t.answer.jd}{jdChars > 0 && <Icon name="check" size={12}/>}
        </button>
        {jdChars > 0 && (
          <button className="btn btn-sm" onClick={() => onClearKb('jd')} title={t.answer.jdRemoveTitle}>
            ×
          </button>
        )}
</div>
      {documentsPanel}
      {notice && <div className="kb-notice">{notice}</div>}
      <div className="session" ref={boxRef} onScroll={onScroll}>
        {turns.length === 0 ? (
          <div className="pane-empty answer-empty">
            <span className="empty-symbol"><Icon name="spark" size={30}/></span>
            <h3>{t.uiLang === 'zh' ? '把信息，变成清晰的回答' : 'Turn context into clear answers'}</h3>
            <p>{t.uiLang === 'zh' ? '选择一段转录，或直接输入问题。添加项目与论文，让回答更贴近你的背景。' : 'Choose a transcript passage or ask a question. Add project documents and papers for more relevant answers.'}</p>
            <div className="prompt-suggestions">{(t.uiLang === 'zh' ? ['总结当前会话的关键内容', '提炼已添加论文的创新点', '梳理项目方案与技术难点'] : ['Summarize this conversation', 'Explain the papers’ contributions', 'Outline the project’s technical challenges']).map(question => <button key={question} disabled={!answersReady} onClick={() => { if (inputRef.current) { inputRef.current.value = question; inputRef.current.focus(); } }}><span>{question}</span><Icon name="arrow" size={15}/></button>)}</div>
          </div>
        ) : (
          turns.map((turn) => (
            <div key={turn.id} className={`turn turn-${turn.kind}`}>
              <div className="turn-head">
                <span className="turn-tag">{t.answer.kindTag[turn.kind]}</span>
                <span className="turn-label" title={turn.label}>
                  {turn.label}
                </span>
                {turn.status === 'streaming' ? (
                  <button className="btn btn-sm" onClick={() => onCancel(turn.id)}>
                    {t.answer.stop}
                  </button>
                ) : (
                  <button
                    className="btn btn-sm"
                    onClick={() => void navigator.clipboard.writeText(turn.text)}
                    title={t.answer.copyTitle}
                  >
                    <Icon name="copy" size={14}/>{t.answer.copy}
                  </button>
                )}
              </div>
              <div className="turn-body">
                {turn.status === 'error' ? (
                  <span className="answer-error">{turn.error}</span>
                ) : (
                  <>
                    {turn.text || (turn.kind === 'vision' ? t.answer.visionWaiting : t.answer.genWaiting)}
                    {turn.status === 'streaming' && <span className="cursor">▍</span>}
                  </>
                )}
              </div>
            </div>
          ))
        )}
      </div>
      {!answersReady && <div className="kb-notice">{answersHint}</div>}
      <div className="answer-input">
        <input
          ref={inputRef}
          disabled={!answersReady}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.nativeEvent.isComposing) submit();
          }}
          placeholder={answersReady ? t.answer.freePlaceholder : answersHint}
        />
        <button
          className="btn btn-primary"
          aria-label={t.uiLang === 'zh' ? '发送问题' : 'Send question'}
          disabled={!answersReady}
          title={answersReady ? undefined : answersHint}
          onClick={submit}
        >
          <Icon name="send" size={17}/><span>{t.uiLang === 'zh' ? '发送' : 'Send'}</span>
        </button>
        {visionReady && (
          <button
            className="btn"
            title={t.answer.shotTitle}
            onClick={async () => {
              const q = inputRef.current?.value.trim() ?? '';
              const img = await window.offerme.pickRegion();
              if (!img) return; // cancelled
              if (inputRef.current) inputRef.current.value = '';
              onShotAsk(q, img);
            }}
          >
            <Icon name="camera"/>
          </button>
        )}
      </div>
    </section>
  );
}
