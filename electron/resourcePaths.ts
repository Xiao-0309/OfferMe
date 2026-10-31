/* Modified for OfferMe (2026); derived from MeetingCopilot. See UPSTREAM.md. */
/** Real filesystem root for bundled audio helpers, guides and test fixtures. */
import { app } from 'electron';

/**
 * Pure decision half of {@link getResourceRoot}, so the rule can be unit
 * tested without booting electron.
 */
export function resolveResourceRoot(
  isPackaged: boolean,
  resourcesPath: string,
  appPath: string,
): string {
  return isPackaged ? resourcesPath : appPath;
}

/** Root directory for shipped, non-bundled resources. Always a real directory. */
export function getResourceRoot(): string {
  return resolveResourceRoot(app.isPackaged, process.resourcesPath, app.getAppPath());
}
