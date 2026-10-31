# Security and privacy

## Report a vulnerability

Use [GitHub's private vulnerability reporting](https://github.com/Xiao-0309/OfferMe/security/advisories/new) when available. Do not publish working credentials, private documents or exploit details in a public issue. If private reporting is unavailable, open a minimal issue requesting a private contact channel without sensitive details.

Include the affected version, environment, reproduction steps, impact and a minimal synthetic example. Only the current main branch is actively maintained; this project does not promise a response SLA.

## Data boundaries

API requests are made in the Electron main/ASR processes. Stored keys are not returned to the renderer; the UI receives presence flags and short hints. Keys use OS-backed `safeStorage` when available. The explicit weak-storage fallback is base64 obfuscation, not encryption.

Transcripts, document text, answers and practice history are stored locally as plain JSON. Your configured providers receive audio, questions, enabled context or screenshots according to the features in use. Context prewarming and memo updates can also make answer API requests. See [the guide](docs/GUIDE.en.md#data-storage-and-costs).

Imported files and model responses are untrusted data. External-link allowlists, bounded IPC contracts and structured interview validation limit their effects. These controls do not guarantee factual AI answers or eliminate every prompt-injection risk. Use public/synthetic inputs for reproducible bug reports.

`npm run check:public` detects common token, private-profile and personal-path patterns in the source tree. It is a publication guard, not a complete secret scanner. Review staged files before publishing. Signing credentials and production API keys must never be committed.

## Dependency audit

The 2026-10-31 publication audit reports no production-package advisories and no high/critical advisories in the full dependency tree. Fifteen moderate entries remain in the development packaging chain, all arising from the transitive `minimatch` glob-pattern denial-of-service advisory. They are not fifteen independent flaws. Packaging uses repository-controlled patterns; do not run the build tools with untrusted glob inputs. A forced downgrade of `electron-builder` is not used as a workaround. Audit results change over time; run `npm audit` when reviewing or updating dependencies.
