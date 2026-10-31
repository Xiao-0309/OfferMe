export const palettes = {
  forest: { zh: '松绿', en: 'Forest', light: '233,244,235', dark: '17,29,24', swatch: '#8db69b' },
  ocean: { zh: '海蓝', en: 'Ocean', light: '229,240,252', dark: '16,26,41', swatch: '#87afd2' },
  lavender: { zh: '雾紫', en: 'Lavender', light: '241,234,251', dark: '29,22,39', swatch: '#b6a1d0' },
  sand: { zh: '暖砂', en: 'Sand', light: '249,240,224', dark: '34,28,19', swatch: '#cdb58c' },
  rose: { zh: '蔷薇', en: 'Rose', light: '251,233,237', dark: '37,21,29', swatch: '#d5a0b0' },
  slate: { zh: '石墨', en: 'Slate', light: '235,239,243', dark: '23,27,32', swatch: '#a2aeba' },
} as const;
export type PaletteId = keyof typeof palettes | 'custom';
export interface Appearance { glassOpacity?: number; backgroundPalette?: PaletteId; backgroundColor?: string; }
export function paletteColors(palette: PaletteId = 'forest', color = '#8db69b') {
  if (palette !== 'custom') return palettes[palette] ?? palettes.forest;
  const safe = /^#[\da-f]{6}$/i.test(color) ? color : '#8db69b';
  const rgb = [1, 3, 5].map(i => parseInt(safe.slice(i, i + 2), 16));
  return { light: rgb.map(c => Math.round(220 + c * .12)).join(','), dark: rgb.map(c => Math.round(10 + c * .1)).join(',') };
}
