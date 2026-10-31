/* Modified for OfferMe (2026); derived from MeetingCopilot. See UPSTREAM.md. */
import { Icon } from './Icon';
import { useState } from 'react';
import type { DocumentImportResult, DocumentKind, ReferenceDocument, UiLang } from '../../shared/protocol';

interface Props {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  documents: ReferenceDocument[];
  lang: UiLang;
  onImport: (kind: DocumentKind) => Promise<DocumentImportResult | null>;
  onToggle: (id: string, enabled: boolean) => void;
  onRemove: (id: string) => void;
}

export function DocumentsPanel({ documents, lang, onImport, onToggle, onRemove, open, onOpenChange }: Props) {
  const zh = lang === 'zh';
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [previewId, setPreviewId] = useState<string | null>(null);
  const active = documents.filter((doc) => doc.enabled);
  const chars = active.reduce((sum, doc) => sum + doc.text.length, 0);
  const preview = documents.find((doc) => doc.id === previewId);
  const importFiles = async (kind: DocumentKind) => {
    setBusy(true);
    setNotice('');
    try {
      const result = await onImport(kind);
      if (!result) return;
      const added = result.documents.filter((doc) => !documents.some((old) => old.id === doc.id)).length;
      const messages = [zh ? `已添加 ${added} 份资料（相同内容自动去重）。` : `Added ${added} documents (duplicate content skipped).`];
      for (const error of result.errors) {
        const reason = error.code === 'no-text'
          ? (zh ? '未提取到文字；扫描版请先做 OCR。' : 'No text layer. Run OCR on scanned PDFs first.')
          : error.code === 'unsupported'
            ? (zh ? '不支持此文件格式。' : 'Unsupported file format.')
            : (zh ? '无法解析，请检查文件是否损坏或受密码保护。' : 'Could not parse. Check for corruption or password protection.');
        messages.push(`${error.name}: ${reason}`);
      }
      setNotice(messages.join('\n'));
    } catch {
      setNotice(zh ? '导入失败，请重新选择文件。' : 'Import failed. Please select the files again.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <details className="documents-panel" open={open} onToggle={(event) => onOpenChange?.(event.currentTarget.open)}>
      <summary><Icon name="book" size={16}/>{zh ? '项目与论文资料' : 'Projects & papers'} <span className="documents-count">{active.length}/{documents.length} · {chars.toLocaleString()} {zh ? '字' : 'characters'}</span></summary>
      <div className="documents-content">
        <div className="documents-actions">
          <button className="btn btn-sm" disabled={busy} onClick={() => void importFiles('project')}>{zh ? '＋ 项目资料' : '+ Projects'}</button>
          <button className="btn btn-sm" disabled={busy} onClick={() => void importFiles('paper')}>{zh ? '＋ 论文' : '+ Papers'}</button>
          {busy && <span role="status">{zh ? '正在提取文字…' : 'Extracting text…'}</span>}
        </div>
        <p className="documents-help documents-intro">{zh
          ? '支持 PDF、Word 和文本。本机解析，勾选的全文将发送给回答服务；原文件保留在本机。'
          : 'Import PDF, Word or text. Parsing is local; enabled full text goes to your answer provider. Original files stay on this computer.'}</p>
        {documents.length === 0 && <p className="documents-help">{zh ? '添加项目说明或论文后，可以问“总结这篇论文的创新点”或“结合项目说明介绍技术方案”。' : 'Add documents, then ask about a paper’s contributions or a project’s design.'}</p>}
        <ul className="documents-list">
          {documents.map((doc) => (
            <li key={doc.id}>
              <label className="document-choice">
                <input type="checkbox" checked={doc.enabled} onChange={(event) => onToggle(doc.id, event.target.checked)} />
                <Icon name={doc.kind === 'paper' ? 'book' : 'file'} size={16}/><span className="document-name" title={doc.name}>{doc.name}</span>
              </label>
              <span className="document-meta">{doc.kind === 'paper' ? (zh ? '论文' : 'Paper') : (zh ? '项目' : 'Project')} · {doc.text.length.toLocaleString()}</span>
              <button className="btn btn-sm" aria-label={`${zh ? '查看' : 'View'} ${doc.name}`} onClick={() => setPreviewId(previewId === doc.id ? null : doc.id)}>{zh ? '查看' : 'View'}</button>
              <button className="btn btn-sm" aria-label={`${zh ? '移除' : 'Remove'} ${doc.name}`} onClick={() => { onRemove(doc.id); if (previewId === doc.id) setPreviewId(null); }}>{zh ? '移除' : 'Remove'}</button>
            </li>
          ))}
        </ul>
        {chars > 0 && <details className="document-guide"><summary>{zh ? '导入说明与模型限制' : 'Import details & model limits'}</summary><p className="documents-help">{zh ? '可用上下文由回答模型决定；多篇长论文可能超出上限或增加费用，可取消勾选不需要的资料。扫描版、图表及公式不保证能提取，请查看文字核对。' : 'The answer model sets the context limit. Long papers may exceed it or increase cost; deselect files you do not need. Check extracted text: scanned pages, figures and formulas may be missing.'}</p></details>}
        {notice && <div className="documents-notice" role="status">{notice}</div>}
        {preview && <div className="document-preview"><strong>{preview.name}</strong><pre tabIndex={0}>{preview.text}</pre></div>}
      </div>
    </details>
  );
}
