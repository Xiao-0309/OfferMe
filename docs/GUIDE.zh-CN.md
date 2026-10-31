# OfferMe 中文快速指南

完整英文图文配置步骤见 [Setup guide](GUIDE.en.md)，项目中文介绍见 [README.zh-CN](../README.zh-CN.md)。

1. 使用 macOS 13+ 或 Windows 10+，安装 Node.js 22.12+（22.x）、Git；Mac 安装 Xcode Command Line Tools。
2. 克隆项目后运行 `npm ci`、`npm run dev`。
3. 首次启动可选择中文。仅模拟面试可进入高级设置，只配置文字回答 API。
4. 回答接口填 Chat Completions 兼容的基础地址、模型、该服务商密钥；应用会自动追加 `/chat/completions`。
5. 实时转写单独配置百炼兼容的 WebSocket 地址，例如 `wss://YOUR_WORKSPACE_ID.cn-beijing.maas.aliyuncs.com/api-ws/v1/inference`；用实际空间 ID 替换占位符，模型与密钥需有对应地域权限。聊天接口的 `/compatible-mode/v1` 不能当作语音 WebSocket 地址。
6. 分别测试回答和转写。服务测试成功后，还需测试实际收音。
7. Mac 安装 BlackHole 2ch，并按 [音频指南](MACOS_AUDIO.md) 创建“耳机／扬声器 + BlackHole”双输出。会议扬声器选系统默认，对方输入选 BlackHole。
8. 每个会话分别导入简历、JD、项目／论文资料，先检查提取预览，再选择启用内容。
9. 模拟面试选择方向、公司偏好和题数，查看检索来源，生成后先自行回答，再查看知识点与点评。

默认优先未出题；范围不足时会说明复习补充。题库是公开来源的历史考点，不保证当前公司原题或必考题。扫描 PDF 需先 OCR，超出模型上下文时应减少启用材料。

设置与会话保存在系统应用数据目录的 `OfferMe` 中。密钥优先系统加密，文本资料是普通 JSON。服务测试、转写、回答、上下文预热和点评可能产生服务商费用；额度请在服务商控制台查看。

排错时先区分：服务测试是否成功、是否有音量信号、是否有转写文字、是否有回答。请只分享检查过的脱敏诊断，不上传密钥或整个配置目录。
