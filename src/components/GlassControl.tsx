import { useEffect, useRef, useState } from 'react';
import { palettes, paletteColors, type Appearance, type PaletteId } from '../../shared/appearance';

/** Tint and alpha affect background surfaces only. Saves are ordered to avoid slider races. */
export function GlassControl({ value, palette = 'forest', color = '#8db69b', zh, onSaved }: {
  value: number; palette?: PaletteId; color?: string; zh: boolean; onSaved: (patch: Appearance) => void;
}) {
  const [draft, setDraft] = useState<Appearance>({ glassOpacity: value, backgroundPalette: palette, backgroundColor: color });
  const [error, setError] = useState(false);
  const latest = useRef(draft);
  const chain = useRef(Promise.resolve());
  useEffect(() => { const next = { glassOpacity: value, backgroundPalette: palette, backgroundColor: color }; setDraft(next); latest.current = next; }, [value, palette, color]);
  useEffect(() => {
    const root = document.documentElement;
    const colors = paletteColors(draft.backgroundPalette, draft.backgroundColor);
    root.style.setProperty('--glass-alpha', String(Math.max(.25, Math.min(1, draft.glassOpacity ?? .68))));
    root.style.setProperty('--glass-light-rgb', colors.light);
    root.style.setProperty('--glass-dark-rgb', colors.dark);
  }, [draft]);
  const save = () => {
    const next = latest.current;
    chain.current = chain.current.catch(() => {}).then(async () => {
      try { await window.offerme.setSettings({ ui: next }); if (latest.current === next) { onSaved(next); setError(false); } }
      catch { setError(true); }
    });
  };
  const change = (patch: Appearance, persist = true) => { latest.current = { ...latest.current, ...patch }; setDraft(latest.current); if (persist) save(); };
  const transparency = Math.round((1 - (draft.glassOpacity ?? .68)) * 100);
  return <details className="glass-control"><summary title={zh ? '背景颜色与透明度' : 'Background & transparency'}>{zh ? '外观' : 'Appearance'} <span>{transparency}%</span></summary>
    <div className="glass-popover">
      <label>{zh ? '背景色调' : 'Background tint'}</label>
      <div className="palette-grid">{Object.entries(palettes).map(([id, p]) => <button key={id} className="palette-option" title={zh ? p.zh : p.en} aria-label={zh ? p.zh : p.en} aria-pressed={draft.backgroundPalette === id} onClick={() => change({ backgroundPalette: id as PaletteId })}><i style={{ background: p.swatch }}/><span>{zh ? p.zh : p.en}</span></button>)}</div>
      <label className="custom-color">{zh ? '自定义色调' : 'Custom tint'}<input aria-label={zh ? '自定义背景色' : 'Custom background color'} type="color" value={draft.backgroundColor ?? '#8db69b'} onChange={e => change({ backgroundPalette: 'custom', backgroundColor: e.target.value })}/></label>
      <label htmlFor="glass-alpha">{zh ? '背景透明度' : 'Background transparency'}<strong>{transparency}%</strong></label>
      <input id="glass-alpha" type="range" min="0" max="75" step="1" value={transparency} onChange={e => change({ glassOpacity: 1 - Number(e.target.value) / 100 }, false)} onPointerUp={save} onKeyUp={save} onBlur={save}/>
      <p>{zh ? '色调自动适配深浅主题，文字保持清晰。设置自动保存。' : 'Tint adapts to light and dark themes. Text stays crisp. Saved automatically.'}</p>
      {error && <p role="alert">{zh ? '保存失败，请重新调整。' : 'Could not save. Try adjusting again.'}</p>}
    </div>
  </details>;
}
