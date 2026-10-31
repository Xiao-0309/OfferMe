import { createHash } from 'node:crypto';
import { basename, extname } from 'node:path';
import { extractDocText, DOC_EXTENSIONS } from '../docparse';
import type { DocumentImportResult, DocumentKind } from '../../shared/protocol';

/** Each selected file succeeds or fails independently; paths and parser errors stay private. */
export async function importDocuments(
  paths: readonly string[],
  kind: DocumentKind,
  extract: (path: string) => Promise<string> = extractDocText,
): Promise<DocumentImportResult> {
  const result: DocumentImportResult = { documents: [], errors: [] };
  const seen = new Set<string>();
  for (const path of paths) {
    const name = basename(path);
    if (!DOC_EXTENSIONS.includes(extname(path).slice(1).toLowerCase())) {
      result.errors.push({ name, code: 'unsupported' });
      continue;
    }
    try {
      const text = (await extract(path)).trim();
      if (!text) {
        result.errors.push({ name, code: 'no-text' });
        continue;
      }
      const id = createHash('sha256').update(kind).update('\0').update(text).digest('hex');
      if (seen.has(id)) continue;
      seen.add(id);
      result.documents.push({ id, name, kind, text, enabled: true, addedAt: Date.now() });
    } catch {
      result.errors.push({ name, code: 'parse-failed' });
    }
  }
  return result;
}
