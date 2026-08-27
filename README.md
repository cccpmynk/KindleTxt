<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/9bf80058-0f82-4707-9ecf-b0e27cbd0356

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

# eReaderTxt - 纯前端、零上传的开源 TXT/PDF 转 EPUB 电子书工具

<p align="center">
  <strong>100% 隐私安全 / 智能章节识别 / 离线可用 / 极简无广告</strong>
</p>

<p align="center">
  <a href="https://onapp.xyz"><strong>👉 立即在线体验 eReaderTxt 👈</strong></a>
</p>

---

## 💡 为什么做这个项目？

作为一个电子书重度用户，平时经常需要把网络上下载的 TXT 小说或长文放进 Kindle、掌阅（iReader）、文石（Onyx Boox）或 Kobo 里阅读。但在使用市面上的在线转码工具时，经常遇到两个难以忍受的痛点：
1. **隐私焦虑**：把自己的私密文档、甚至还没发表的创作手稿上传到不明第三方的服务器，总觉得隐私没有保障。
2. **排版灾难**：很多工具转出来的 EPUB 是一整块巨大的 HTML 文件，没有目录导航（TOC）。放进墨水屏阅读器后，一翻页就卡死，根本没办法按章节跳转。

为了彻底解决这两个痛点，我用业余时间开发了 **eReaderTxt**——一个完全运行在浏览器本地、智能切分章节、极简干净的电子书转换工具。现已完全开源！

---

## ✨ 核心亮点

* 🔒 **100% 纯前端（零上传）**：所有转换逻辑和文件解析完全在你的浏览器本地（客户端）运行。**文件绝对不会上传到任何服务器**。打开网页后，你甚至可以拔掉网线、关闭 Wi-Fi 离线使用，隐私 100% 安全。
* 📂 **支持 TXT & 文本型 PDF**：不仅能完美转换普通文本，还支持将文本型 PDF 转换为对阅读器更友好的 EPUB 格式。
* 🏷️ **智能章节 TOC 识别**：采用高性能正则匹配，智能识别文本中的“第一章”、“第 X 卷”、“楔子”等结构，自动将文件切分为标准片段并生成完美的目录导航。**彻底解决阅读器因文件过大而翻页卡顿的问题**。
* 🎨 **高度自定义排版**：支持自定义书籍封面、字体大小、直排/横排切换，转出来的电子书完美适配主流墨水屏设备。
* 🌐 **中英文双语**：Web App 操作界面原生支持中文与英文，满足全球用户的阅读定制需求。
* 🚫 **极简无广告**：秒开即用，没有任何弹窗、贴片广告或套路。

---

## 🛠️ 如何使用？

1. 打开网站：(https://ereader-txt.onapp.xyz/)
2. 拖入或选择你的 `TXT` 或 `PDF` 文件。
3. （可选）在配置面板中调整你的封面、字体或排版偏好。
4. 点击“转换”按钮，即可在浏览器内秒转完成并自动下载标准的 `EPUB` 文件。

---

## 🤝 参与贡献与意见反馈

本项目目前还处于早期阶段，难免会有不完美的地方（例如某些特殊的小说断章格式未能成功识别）。
* 如果你遇到了章节识别失败的文件，欢迎在 [Issues]([https://github.com/cccpmynk/KindleTxt)) 中提交排版格式样本。
* 非常欢迎提交 Pull Request 来一起优化识别规则、丰富排版样式或改进 UI 体验！

如果你觉得这个小工具对你的阅读有所帮助，欢迎点一个 **⭐ Star** 给予独立开发者最大的鼓励！
