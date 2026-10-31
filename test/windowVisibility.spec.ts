import { describe, expect, it, vi } from 'vitest';
import { revealWindow, toggleWindowVisibility, windowIsShown } from '../electron/windows/visibility';
describe('window restore', () => {
  it('restores minimized windows even if Electron reports them visible', () => {
    const win = { isDestroyed: () => false, isVisible: () => true, isMinimized: () => true, restore: vi.fn(), show: vi.fn(), focus: vi.fn(), hide: vi.fn() };
    expect(windowIsShown(win)).toBe(false);
    toggleWindowVisibility(win);
    expect(win.restore).toHaveBeenCalledOnce();
    expect(win.show).toHaveBeenCalledOnce();
    expect(win.focus).toHaveBeenCalledOnce();
    expect(win.hide).not.toHaveBeenCalled();
  });
  it('ignores a closed window', () => { revealWindow(null); expect(windowIsShown(null)).toBe(false); });
});
