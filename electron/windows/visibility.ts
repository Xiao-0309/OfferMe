/** Window state shared by Dock, tray and hotkeys. */
interface AppWindow {
  isDestroyed(): boolean;
  isMinimized(): boolean;
  isVisible(): boolean;
  restore(): void;
  show(): void;
  focus(): void;
  hide(): void;
}

export function windowIsShown(win: AppWindow | null): boolean {
  return !!win && !win.isDestroyed() && win.isVisible() && !win.isMinimized();
}

export function revealWindow(win: AppWindow | null): void {
  if (!win || win.isDestroyed()) return;
  if (win.isMinimized()) win.restore();
  win.show();
  win.focus();
}

export function toggleWindowVisibility(win: AppWindow | null): void {
  if (windowIsShown(win)) win!.hide();
  else revealWindow(win);
}
