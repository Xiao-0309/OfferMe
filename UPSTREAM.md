# Source provenance and independent maintenance

OfferMe is independently maintained by [Xiao-0309](https://github.com/Xiao-0309). Its public repository is [Xiao-0309/OfferMe](https://github.com/Xiao-0309/OfferMe).

Parts of this codebase derive from [JWM0203/MeetingCopilot](https://github.com/JWM0203/MeetingCopilot), licensed under Apache-2.0. The starting source snapshot was upstream commit `337973a`, followed by local API and audio fixes. This repository preserves that license and attribution; it does not claim sole authorship of inherited code or endorsement by the upstream author.

## OfferMe changes

- Cloud API-only transcription, with local model runtimes, Python sidecars and model download workflows removed.
- Independent OfferMe brand, O/conversation/check logo, translucent visual system and color controls.
- Independent application ID `io.github.xiao0309.offerme`, `OfferMe` profile directory, native audio-route identity and `offerme` renderer bridge.
- English-first onboarding and interface, Chinese language support, and English translations of every curated bank topic/source label.
- Resume/JD context and per-session project/paper attachments with local PDF/DOCX extraction, previews, selection and full extracted-text context.
- Resume-grounded mock interviews, source-validated adaptation, written practice feedback and persistent unseen-topic preference.
- A curated interview bank with 210 short paraphrased topics from 39 public sources, nine directions and bilingual lexical retrieval.
- macOS audio-route management, signal diagnostics, device recovery and minimized-window restoration fixes.
- Reproducible synthetic UI screenshots, public-source checks, regression tests and English setup/contribution documentation.

Modified inherited source files carry modification notices. Original copyright/license notices are retained. Synthetic document and test-audio fixtures inherited from the original repository are included for tests; their presence is not a claim of newly authored material. Third-party packages retain their respective licenses.

The initial Git commit is a transparent source snapshot of this derivative project. It does not reconstruct or invent upstream commit history. Earlier private working names were MeetingAssistant and MeetingAssistant Design; those applications are separate and their profiles are not automatically imported by OfferMe 0.7.

## Interview-source material

Source pages belong to their respective authors. The bank stores short paraphrased topics and attribution metadata, not complete articles or their answers. English translations are maintained separately from the original topic metadata. See [the bank guide](docs/INTERVIEW_BANK.md) and [source registry](resources/interview-bank/seed.json). Company names identify reported sources; they imply no sponsorship, verification or affiliation.
