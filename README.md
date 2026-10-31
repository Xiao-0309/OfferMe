<p align="center">
  <img src="brand/exports/offerme-logo.png" alt="OfferMe" width="310" />
</p>
<p align="center"><strong>Your experience. Better explained.</strong></p>
<p align="center">Resume-grounded interview practice and a translucent workspace for conversations, documents and AI answers.</p>
<p align="center">
  <a href="https://github.com/Xiao-0309/OfferMe/actions/workflows/ci.yml"><img src="https://github.com/Xiao-0309/OfferMe/actions/workflows/ci.yml/badge.svg" alt="Verify" /></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-Apache--2.0-123E37" alt="Apache-2.0" /></a>
  <img src="https://img.shields.io/badge/desktop-macOS%20%7C%20Windows-123E37" alt="macOS and Windows" />
  <img src="https://img.shields.io/badge/models-cloud%20API%20only-123E37" alt="Cloud APIs only" />
</p>
<p align="center"><a href="docs/GUIDE.en.md">Setup guide</a> · <a href="docs/MACOS_AUDIO.md">macOS audio</a> · <a href="docs/INTERVIEW_BANK.md">Question bank</a> · <a href="README.zh-CN.md">中文</a></p>

![OfferMe's English conversation workspace](docs/assets/workspace-en.png)

OfferMe brings your resume, target role and project references into one desktop workspace. Prepare with sourced interview topics, rehearse your own answers, and review the concepts behind each question. When you need live transcription, connect a speech API and your meeting audio.

**Bring your own API keys.** No local model downloads, GPU setup, OfferMe account or bundled provider credits. English is the default interface and answer language; Chinese remains available in Settings.

## What you can do

| Feature | How it helps |
| --- | --- |
| **Resume-grounded practice** | Import a resume and optional JD; generate 5, 8 or 12 questions with project connections, knowledge points, answer outlines and follow-ups. |
| **Sourced interview bank** | Retrieve from 210 curated topics across 9 algorithm/ML directions and 39 public sources. Filter by direction or company preference; inspect the source behind every generated question. |
| **Practice and feedback** | Answer before revealing notes, request AI feedback, and prioritize unseen topics across consecutive rounds. History stays with the session. |
| **Projects and papers** | Attach PDF, DOCX, TXT and Markdown references. Preview extracted text, distinguish projects from papers, and choose what to include. |
| **Live transcription and answers** | Stream selected audio to an ASR provider; ask about a transcript segment or type a question. Answer and speech providers are configured separately. |
| **A translucent desktop** | Light/dark themes, six background palettes, a custom color and adjustable surface transparency. Text remains readable. |
| **Session workspace** | Keep separate transcripts, answers, materials and interview practice for each session. |
| **Optional vision** | Configure an image-capable chat endpoint for screenshot questions. |

### Practice from your own work

![English mock interview with source attribution and study notes](docs/assets/interview-en.png)

The local retriever matches your materials against the built-in bank. Your answer API adapts the selected topics to your experience. Source IDs are validated before a result is accepted; the model cannot invent a source link.

![Answer practice and AI feedback](docs/assets/practice-en.png)

### Browse the evidence

![Searchable English interview bank](docs/assets/bank-en.png)

Coverage includes LLMs and agents, NLP, recommendation/search/ads, computer vision, multimodal models, speech, reinforcement learning, AI infrastructure, and ML/algorithm fundamentals. Community reports are historical, self-reported accounts. Official-guide exercises are labeled separately. These are preparation topics, **not predictions of a company's current questions**. [How the bank works →](docs/INTERVIEW_BANK.md)

### Keep your materials close

![Project and paper references](docs/assets/documents-en.png)

Parsing happens locally. Enabled extracted text is included in AI context without an application-level character cut-off. Your provider's context window and billing limits still apply. Scanned PDFs need OCR first; OfferMe does not perform OCR or automatically search the web.

### Make the workspace yours

![Dark translucent workspace and appearance controls](docs/assets/appearance-en.png)

All screenshots above use synthetic materials and deterministic demo responses. They show the actual UI, not measured model quality. The illustrated background is generated inside the demo window; no desktop contents were captured.

## Download for macOS

[**Download OfferMe for Apple Silicon →**](https://github.com/Xiao-0309/OfferMe/releases/latest)

The prebuilt DMG and ZIP require **macOS 13+ and an Apple Silicon Mac (M-series)**. Open the DMG and drag OfferMe into Applications; Node.js and developer tools are not needed. This release is ad-hoc signed, **not Apple-notarized or Developer ID signed**, so macOS may require application-specific approval. Read the [installation guide](docs/DOWNLOAD.md) before opening it.

The package contains **no API keys, private endpoints, user settings or meeting history**. Enter your own providers on first launch. Intel Mac and Windows binaries are not included in this release; source setup is below.

## Run from source

You need **Node.js 22.12+ (22.x)**, npm and Git, on **macOS 13+** or Windows 10+. On macOS, also install Xcode Command Line Tools with `xcode-select --install` so the audio helper can compile. Windows builds do not need Swift.

```bash
git clone https://github.com/Xiao-0309/OfferMe.git
cd OfferMe
npm ci
npm run dev
```

The first-run wizard opens in English. For practice without audio, choose **Custom API setup**, configure the text answer provider, and open **Mock interview**. Live transcription also requires an ASR provider and audio input setup.

![English first-run setup](docs/assets/setup-en.png)

### Configure providers

| Slot | URL shape | What to enter |
| --- | --- | --- |
| Text answers | `https://your-provider.example/v1` | A Chat Completions-compatible base URL, model ID and that provider's API key. OfferMe appends `/chat/completions`. |
| Streaming ASR | `wss://…/api-ws/v1/inference` | A compatible Alibaba Cloud Fun-ASR/Paraformer endpoint, available model and matching regional/workspace key. |
| Optional vision | Chat Completions-compatible base URL | An image-capable model and its own key. |

The text answer URL is **not** a replacement for the streaming ASR URL. The [step-by-step guide](docs/GUIDE.en.md) includes current provider examples, connection tests, document import, privacy and troubleshooting.

For macOS meeting sound, route the output to both your headphones and **BlackHole 2ch**, then select BlackHole as OfferMe's other-party input. Selecting AirPods alone bypasses transcription; selecting BlackHole alone leaves you unable to hear. [Illustrated audio setup →](docs/MACOS_AUDIO.md)

## Build and verify

```bash
npm run verify        # Public-source scan, TypeScript, tests, production build
npm run test:ui       # Hidden-window integration checks with synthetic data
npm run screenshots   # Regenerate the illustrated documentation
npm run dist:dir      # Unpacked desktop application
```

Use `npm run dist:mac` on macOS for Apple Silicon DMG and ZIP packages, or `npm run dist:win` on Windows for x64 NSIS/portable builds. Outputs go to `release/`. Source builds are not automatically notarized or signed with a developer certificate. See [build and installation details](docs/GUIDE.en.md#build-a-desktop-package).

## Your data and your providers

OfferMe stores sessions locally and uses OS-backed API-key encryption when available. If OS encryption is unavailable, it explicitly reports a weaker fallback. Session text is plain JSON. Enabled materials can be sent to your answer provider for answers and background context warming; selected audio is sent to your ASR provider while capture is active. Connection tests may be billable. There is no built-in provider balance lookup. See the [data flow and storage guide](docs/GUIDE.en.md#data-storage-and-costs).

Use meeting capture with the participants' permission and follow the rules of the session. Capture protection is best-effort and does not guarantee that a window is absent from screen sharing.

## Contribute

Bug reports, translations, source-backed bank additions and provider compatibility fixes are welcome. Read [CONTRIBUTING.md](CONTRIBUTING.md), [architecture](docs/ARCHITECTURE.md) and [SECURITY.md](SECURITY.md). Please never include API keys, private resumes or meeting transcripts in an issue.

## License and acknowledgments

OfferMe is maintained by [Xiao-0309](https://github.com/Xiao-0309) under [Apache-2.0](LICENSE). It has its own brand, application identity and data directory. Parts of the code derive from [MeetingCopilot](https://github.com/JWM0203/MeetingCopilot); the original attribution and modification history are preserved in [NOTICE](NOTICE) and [UPSTREAM.md](UPSTREAM.md). This project is independently maintained and is not endorsed by the upstream author or the companies named in the question bank.
