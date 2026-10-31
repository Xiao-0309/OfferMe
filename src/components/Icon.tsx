import type { CSSProperties } from 'react';
const paths = {
  workspace: 'M3 4h18v16H3z M3 9h18 M9 9v11',
  file: 'M6 3h8l4 4v14H6z M14 3v5h4 M9 12h6 M9 16h6',
  book: 'M3 4h6c2 0 3 1 3 3v14c0-2-1-3-3-3H3z M21 4h-6c-2 0-3 1-3 3v14c0-2 1-3 3-3h6z',
  plus: 'M12 5v14 M5 12h14',
  message: 'M5 4h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H9l-5 3v-3H3V6a2 2 0 0 1 2-2z',
  spark: 'm12 3 2.6 6.4L21 12l-6.4 2.6L12 21l-2.6-6.4L3 12l6.4-2.6z',
  wave: 'M4 10v4 M8 6v12 M12 3v18 M16 6v12 M20 10v4',
  mic: 'M9 5a3 3 0 0 1 6 0v7a3 3 0 0 1-6 0z M5 10v2a7 7 0 0 0 14 0v-2 M12 19v3 M8 22h8',
  settings: 'M4 7h16 M4 17h16 M8 4v6 M16 14v6',
  help: 'M9 8a3 3 0 1 1 5 2c-2 1-2 2-2 4 M12 17h.01 M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0',
  pulse: 'M3 12h4l3-7 4 14 3-7h4',
  edit: 'm15 4 5 5 M4 20l5-1L21 7l-5-5L4 14z',
  trash: 'M3 6h18 M9 6V3h6v3 M6 6l1 15h10l1-15 M10 10v7 M14 10v7',
  close: 'M6 6l12 12 M18 6 6 18',
  minus: 'M5 12h14',
  arrow: 'M5 12h14 M13 6l6 6-6 6',
  send: 'm4 12 16-8-5 16-4-6z M11 14l9-10',
  copy: 'M9 8h12v13H9z M15 8V3H3v13h6',
  camera: 'M3 7h4l2-3h6l2 3h4v13H3z M16 13a4 4 0 1 1-8 0 4 4 0 0 1 8 0',
  check: 'm5 12 4 4L19 6',
  sun: 'M12 2v2 M12 20v2 M2 12h2 M20 12h2 M5 5l1.4 1.4 M17.6 17.6l1.4 1.4 M5 19l1.4-1.4 M17.6 6.4l1.4-1.4 M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0',
  moon: 'M21 13a9 9 0 1 1-10-10 7 7 0 0 0 10 10',
  play: 'm8 4 12 8-12 8z',
  stop: 'M6 6h12v12H6z',
} as const;
export type IconName = keyof typeof paths;
export function Icon({ name, size = 18, style }: { name: IconName; size?: number; style?: CSSProperties }) {
  return <svg className="icon" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={style}><path d={paths[name]} /></svg>;
}
