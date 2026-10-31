# Contributing to OfferMe

Thank you for helping improve OfferMe. Small, focused pull requests are easiest to review. Use English for shared documentation and issues when possible; Chinese UI translations are also maintained.

## Local development

Use Node.js 22.12+ (22.x) and npm. macOS 13+ additionally needs Xcode Command Line Tools for the Swift audio helper.

```bash
npm ci
npm run dev
```

Use a separate profile for testing with `OFFERME_USERDATA` set to a temporary directory. Never copy real API keys, resumes or session data into the source tree. Automated tests use fixtures and mock providers, not your account.

## Before opening a pull request

```bash
npm run verify
npm run test:ui
```

`verify` runs the public-source scan, TypeScript checks, unit/integration tests and production build. `test:ui` runs the hidden Electron workflow against a loopback mock. It needs a desktop-capable runner; it does not record audio or your screen. CI runs the core checks on macOS and Windows. For UI changes, regenerate screenshots with `npm run screenshots`, inspect the images and keep all example content synthetic.

Explain the user-visible problem, resulting behavior and relevant validation. Keep tests focused on meaningful behavior and regressions. Mention any platform or external-provider path you could not test. Do not claim Windows or live-provider testing based only on a macOS mock run.

## Project map

- `src/`: React UI, localization and audio capture.
- `electron/`: main/preload processes, settings, providers, document parsing and desktop services.
- `shared/`: typed contracts, retrieval, provider metadata and pure domain logic.
- `resources/interview-bank/`: original source registry and English display/search translations.
- `native/macos/`: CoreAudio route helper.
- `tools/`: builds, publication checks and deterministic UI screenshots.
- `test/`: regression tests and synthetic fixtures.

See [architecture](docs/ARCHITECTURE.md) before changing IPC, credential handling or audio routing. Renderer processes must not gain access to stored plaintext keys or arbitrary local paths.

## Add a sourced interview topic

Follow [the bank contribution rules](docs/INTERVIEW_BANK.md#contributing-topics). Include a public source URL, accurate date and source metadata (no personal usernames), a short paraphrase and an English translation. Keep stable IDs. Do not copy an entire article, redistribute paid/private material, invent employer attribution or label historical topics as guaranteed current questions.

## Report a bug

Include your OS, app version, the exact steps and the expected/actual behavior. For transcription failures, distinguish **provider test**, **audio signal**, **transcript** and **answer** results. A redacted diagnostics report is useful after you review it. Never attach your full profile, keys, private meeting recordings or real resume.

Security issues should follow [SECURITY.md](SECURITY.md). Preserve existing copyright and license notices in contributed derivative files.
