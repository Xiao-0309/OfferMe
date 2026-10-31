# Download and install OfferMe

[Official project downloads](https://github.com/Xiao-0309/OfferMe/releases/latest) · [Setup guide](GUIDE.en.md) · [中文安装说明](#中文安装说明)

## Requirements and files

- **macOS 13 or newer**, **Apple Silicon (M-series)**. This release does not contain Intel Mac or Windows binaries.
- `OfferMe-0.7.0-mac-arm64.dmg`: recommended; open and drag OfferMe into Applications.
- `OfferMe-0.7.0-mac-arm64.zip`: alternative; extract and move OfferMe.app into Applications.
- `SHA256SUMS.txt`: checksums for both packages. In the download directory, run `shasum -a 256 -c SHA256SUMS.txt` after downloading both archives, or compare an individual file with `shasum -a 256 <filename>`.

The prebuilt application includes its runtime. Node.js, Xcode and local model downloads are not required. BlackHole 2ch is a separate installation if you want to capture meeting playback on macOS; it is unnecessary for text-only practice.

## First opening

This release is **ad-hoc signed**, but it is **not signed with an Apple Developer ID certificate or notarized by Apple**. A valid ad-hoc signature verifies bundle integrity; it does not establish a trusted developer identity. macOS may block the first launch of an internet download.

1. Download from this repository's Releases page and check the published SHA-256 checksum.
2. Move OfferMe into Applications, then try to open it.
3. If macOS reports an unidentified developer or cannot verify the developer, and you trust this download, open **System Settings → Privacy & Security → Open Anyway**, then confirm **Open**. The option appears after an attempted launch. See [Apple's official instructions](https://support.apple.com/en-us/102445).
4. Do not disable Gatekeeper globally. A damaged-file or malware warning is different: stop and verify the download instead of bypassing that warning.

## Configure your own providers

The package contains no personal API keys, private service endpoints, saved user settings, resumes or meeting transcripts. It does not import credentials from another app. A fresh profile opens the setup wizard; the default UI is English, with Chinese selectable during setup or in Settings.

Configure a Chat Completions-compatible answer API and, for live transcription, a separate supported streaming speech API. OfferMe itself is free and open source; provider calls may be billable. Start with [the illustrated setup guide](GUIDE.en.md), then follow [macOS audio routing](MACOS_AUDIO.md) for headphones and BlackHole.

If you already use an earlier OfferMe build with the same application profile, locally saved settings may still appear. They come from your computer, not from the installer. The installer does not erase your personal data.

## 中文安装说明

1. 从 [项目官方下载页](https://github.com/Xiao-0309/OfferMe/releases/latest) 下载 DMG；系统要求为 **macOS 13+、M 系列芯片**。打开后把 OfferMe 拖入「应用程序」。ZIP 是备用下载格式。
2. 安装包自带运行环境，无需 Node.js、Xcode 或本地模型。可使用 `shasum -a 256 文件名` 与 `SHA256SUMS.txt` 核对文件完整性。
3. 本版本使用临时签名（ad-hoc），**尚无 Apple Developer ID 签名和公证**。第一次打开若提示无法验证开发者，在确认下载来源与校验值后，可按 [Apple 官方说明](https://support.apple.com/en-us/102445)，到「系统设置 → 隐私与安全性」单独选择「仍要打开」。不要关闭系统安全保护；文件损坏或恶意软件提示应先排查。
4. 新用户首次启动默认英文，可选择中文。请配置自己的回答 API；实时转写还需要单独配置语音 API。软件免费，服务商可能收取调用费用。
5. 会议收音需要另行安装 BlackHole 2ch，并设置「耳机／扬声器 + BlackHole」双输出，详见 [音频指南](MACOS_AUDIO.md)。仅做文字模拟面试不需要 BlackHole。

安装包没有作者的 API 密钥、私人接口、个人设置、简历或会议记录，也不会读取其他应用的配置。若电脑以前安装过同一配置目录的 OfferMe，已有设置可能仍会显示；这是本机数据，安装包不会将其删除。详细配置见 [中文指南](GUIDE.zh-CN.md)。
