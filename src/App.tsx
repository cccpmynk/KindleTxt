import React, { useState, useRef, useEffect } from "react";
import JSZip from "jszip";
import jschardet from "jschardet";
import { Upload, FileText, Download, CheckCircle, AlertCircle, Loader2, BookOpen, Smartphone, Sparkles, Image as ImageIcon, Info, X, ShieldCheck, Users, Eye, BookMarked, FileCode, Archive } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { buildLocalEpub, extractChapters, decodeBufferToText } from "./epubBuilder";
import { parsePdfBuffer } from "./pdfParser";

/**
 * eReaderTxt - eReader Ebook Converter
 * A minimal, elegant tool to convert TXT & PDF files to eReader-compatible EPUB format.
 */

type ConversionStatus = "idle" | "uploading" | "generating_cover" | "converting" | "success" | "error";

const BTN_PARTICLES = Array.from({ length: 15 }).map((_, i) => ({
  id: i,
  size: Math.random() * 3 + 1.5,
  left: Math.random() * 100,
  top: Math.random() * 100,
  delay: Math.random() * 6,
  yOffset: Math.random() * -20 - 10,
  xOffset: (Math.random() - 0.5) * 20
}));

const translations = {
  zh: {
    guide: "使用指南",
    faq: "常见问题",
    about: "关于开发",
    aboutTitle: "👋 关于开发",
    aboutAuthor: "本应用由 Alex孟博士 开发",
    aboutEnjoy: "祝您阅读愉快 ：）",
    guideTitle: "📖 使用指南",
    guideStep1: "准备好您的 TXT 小说或 PDF 文档。对于 TXT 建议确保编码为 UTF-8；PDF 自动支持文字智能重排与目录提取。",
    guideStep2: "在首页点击上传区域，或者直接将 TXT / PDF 文件拖拽进来。",
    guideStep3: "点击“开始转换”。我们会自动为您识别章节（如：第一章、Chapter 1等）并生成电子书目录。",
    guideStep4: "下载生成的 EPUB 文件。您可以通过 USB 数据线复制到 eReader，或使用官方无线传输/邮箱服务发送。",
    guideStep5: "重要：若要在 eReader 上看到您选定的字体，请在阅读页面点击「Aa」-「字体」，选择「出版者字体」(Publisher Font)。",
    faqTitle: "❓ 常见问题",
    faqQ1: "为什么转换后是 EPUB 格式？",
    faqA1: "主流 eReader 电纸书及阅读应用全面支持标准 EPUB 格式。EPUB 具有极佳的跨设备兼容性与排版效果，是目前最推荐的格式。",
    faqQ2: "如何传输到 eReader 设备？",
    faqA2: "转换完成后下载 EPUB 文件，您可以通过 USB 数据线拷贝到 eReader，也可以使用设备专属的无线传输或邮箱推送服务发送至您的设备。",
    faqQ3: "发现文件转换后有乱码怎么办？",
    faqA3: "这是由于 TXT 文件编码不是 UTF-8 导致的。请尝试在编码设置中切换为 GBK 或在电脑上另存为 UTF-8 后重新上传。（PDF 文件无需担心编码）。",
    faqQ4: "我的隐私安全吗？",
    faqA4: "绝对安全。所有 TXT 与 PDF 解析、排版均在您的浏览器本地完成（纯前端本地运算），您的书稿文本绝不会上传到任何服务器，100% 保护您的隐私与版权。",
    faqQ5: "章节识别不准确是怎么回事？",
    faqA5: "我们通过正则及 PDF 目录书签匹配章节。如果您的文档章节格式非常特殊，可能无法精准匹配，但正文均会完整保留。",
    faqQ6: "为什么在部分 eReader 软件里无法调整字体粗细？",
    faqA6: "当您在转换时选择了特定的排版字体（如鸿蒙黑体、宋体），eReader 会以“出版者字体”模式运行，由于系统兼容性限制，此时往往会禁用其原生的粗细调整功能。如果您想拥有完整的加粗控制自由，请在转换时选择“系统默认”，这样在阅读时就可以自由切换 eReader 内置字体并调整粗细。",
    mainTitle: "让阅读回归纯粹",
    mainSub: "将您的本地 TXT / PDF 文档轻松转换为 eReader 支持的最佳格式 (EPUB)，自动章节识别与版面智能重排，极致排版体验。",
    dropZone: "点击或拖拽 TXT / PDF 文件到此处",
    dropZoneSub: "支持最大 50MB 的 TXT 纯文本与 PDF 文档（超大文件自动分卷）",
    remove: "移除",
    batchInfo: "该文件较大，系统将自动将其平均拆分为多个较小的分卷（约 3.5MB 每卷）在本地进行转换，并打包为一个 ZIP 文件供您下载。",
    aiCover: "使用 AI 自动生成专属封面",
    btnStart: "开始转换",
    btnStartBatch: "开始批量转换",
    btnError: "文件错误",
    btnConverting: "正在转换...",
    preparing: "系统正在准备中...",
    drawingCover: "正在绘制封面...",
    preparingCover: "AI 正在根据书名为您生成精美的封面配图，请稍候。",
    parsingLarge: "请您稍等片刻……",
    convertingVolume: "正在按照分卷逐一为您转换和排版，请耐心等待。",
    convertingStandard: "正在为您识别章节并重新排版，这可能需要几秒钟时间。",
    convertingPdf: "正在解析 PDF 页面并智能重排正文...",
    pdfScannedWarning: "未能从该 PDF 提取到有效文字，可能为纯扫描图片版。建议使用文字版 PDF 或 TXT 文档。",
    successTitle: "转换完成！",
    successSub: "您的电子书已准备就绪。",
    downloadZip: "立即下载 ZIP",
    downloadLabel: "立即下载",
    convertAnother: "转换另一个文件",
    kindleTipPrefix: "eReader 提示：您可以通过 USB 数据线或无线互传将生成的 EPUB 传输至您的设备，效果极佳。",
    kindleTipLink: "",
    kindleTipSuffix: "",
    errorTitle: "出错了",
    btnRetry: "返回重试",
    feature1Title: "多格式与多设备适配",
    feature1Sub: "支持 TXT 小说与 PDF 文档，生成的 EPUB 完美适配各类 eReader、墨水屏阅读器及电纸书设备。",
    feature2Title: "自动智能重排与目录",
    feature2Sub: "智能算法自动识别章节与 PDF 书签大纲，去除冗余页眉页码并生成精美目录。",
    footer: "© 2026 eReaderTxt. 隐私声明：所有转换与排版均在浏览器本地完成，文件绝不上传服务器，全面保护您的隐私与版权。",
    onlyTxt: "目前支持 TXT 和 PDF 格式文件。",
    fileTooLarge: "文件过大，为了保证您的设备运行稳定，暂不支持超过 50MB 的文件。",
    serverError: "文件太大，超出了处理上限",
    batchError: "分卷转换过程中发生故障",
    partFailed: "部分转换失败",
    modalClose: "我知道了",
    feedback: "建议反馈",
    feedbackTitle: "📬 留下您的建议",
    feedbackSub: "您的反馈是我们进步的动力 (最多300字)",
    feedbackPlaceholder: "请输入您的留言或建议...",
    feedbackSubmit: "提交反馈",
    feedbackSuccess: "提交成功，感谢您的建议！",
    feedbackError: "提交失败，请稍后重试",
    feedbackSending: "正在提交...",
    selectFont: "选择排版字体：",
    fontDefault: "系统默认 (推荐)",
    fontSerif: "宋体 (衬线体)",
    fontSans: "鸿蒙黑体 (无衬线体)",
    fontKaiti: "楷体 (手写感)",
    selectEncoding: "文件编码：",
    autoSplitLabel: "大文件分卷：",
    autoSplitOn: "开启 (推荐, 防卡顿)",
    autoSplitOff: "关闭 (单文件)",
    encodingAuto: "自动识别 (推荐)",
    encodingUtf8: "UTF-8 (国际标准)",
    encodingGb: "GBK / GB18030 (简体中文)",
    encodingBig5: "Big5 (繁体中文)",
    pdfOcrTitle: "扫描件 OCR 识别：",
    pdfOcrAuto: "智能自动检测 (推荐)",
    pdfOcrForce: "强制启用 OCR (扫描/图片版)",
    pdfOcrLangLabel: "OCR 识别语种：",
    pdfOcrLangZh: "中英双语识别",
    pdfOcrLangEn: "纯英文识别",
    pdfOcrLangZht: "繁体中文识别",
    pdfOcrSuccessNote: "✨ 已自动完成本地 OCR 文字识别与重排",
    cleanWatermarkTitle: "智能去水印与防噪：",
    cleanWatermarkOn: "开启 (清除背景浅灰倾斜水印/工号/广告)",
    cleanWatermarkOff: "保留原样",
    outputFormat: "输出格式",
    outputFormatDesc: "eReader 最佳排版 · 纯本地运算 (100% 保护隐私)",
    coverPreview: "预览效果",
    coverSettingTitle: "封面设置",
    coverModeSolid: "默认纯色",
    coverModeAi: "AI 智能配图",
    coverModeCustom: "自定义上传",
    coverCustomSelected: "已选择图片",
    coverProcessTitle: "封面处理方式",
    coverTitleTypeset: "系统排版书名",
    coverTitleClean: "保留原图纯净",
    coverReupload: "重传图片",
    fileTypeZip: "ZIP 压缩分卷包",
    fileTypeEpub: "EPUB 3.0 标准电子书",
    statusGenerated: "已生成",
    downloadBackup: "如果浏览器未自动下载，请点击此处备用链接",
    statsTotalViews: "总浏览量",
    statsUniqueVisitors: "独立访客",
    statsTotalConversions: "已转换书籍",
    statsLiveBadge: "实时统计",
  },
  en: {
    guide: "Guide",
    faq: "FAQ",
    feedback: "Feedback",
    feedbackTitle: "📬 Leave a Suggestion",
    feedbackSub: "Your feedback drives our progress (Max 300 chars)",
    feedbackPlaceholder: "Enter your message or suggestion...",
    feedbackSubmit: "Submit",
    feedbackSuccess: "Submitted successfully, thank you!",
    feedbackError: "Failed to submit, please try again",
    feedbackSending: "Sending...",
    about: "About",
    aboutTitle: "👋 About Project",
    aboutAuthor: "This app is developed by Dr. Alex Meng",
    aboutEnjoy: "Happy reading :)",
    guideTitle: "📖 User Guide",
    guideStep1: "Prepare your TXT or PDF document. Smart text reflow, OCR for scanned PDFs, and chapter outline extraction are supported.",
    guideStep2: "Click the upload area on the home page or directly drag and drop your TXT / PDF file.",
    guideStep3: "Click 'Start Conversion'. We will automatically recognize chapters (e.g., Chapter 1, Section 1) and generate a Table of Contents.",
    guideStep4: "Download the generated EPUB file. You can copy it to eReader via cable or use wireless transfer services.",
    guideStep5: "Important: To see your selected font on eReader, tap 'Aa' - 'Font' and select 'Publisher Font' while reading.",
    faqTitle: "❓ Frequently Asked Questions",
    faqQ1: "Why EPUB format?",
    faqA1: "Modern eReaders and apps natively support the EPUB format. EPUB offers better compatibility, typography, and reflowable layout quality.",
    faqQ2: "How to transfer files to eReader?",
    faqA2: "After conversion, download the EPUB file. You can transfer the file to your eReader via USB cable, email push, or wireless sync services.",
    faqQ3: "What if the converted file has garbled characters?",
    faqA3: "For TXT files, try switching encoding to GBK or UTF-8. PDF files are automatically parsed without encoding issues.",
    faqQ4: "Is my privacy secure?",
    faqA4: "Absolutely. All conversions, including local OCR for scanned PDFs, are performed locally in your browser. Your files are never uploaded to any server, 100% protecting your privacy and copyright.",
    faqQ5: "Why is chapter recognition inaccurate?",
    faqA5: "We use regex and PDF bookmarks to match chapters. If formatting is unusual, content will still be preserved sequentially.",
    faqQ6: "Why can't I adjust font weight in the eReader app?",
    faqA6: "When you select a specific font (like HarmonyOS or Songti), eReader operates in 'Publisher Font' mode. Due to system compatibility, this often disables native thickness adjustment. For full control over boldness, please choose 'System Default' during conversion to use built-in fonts.",
    mainTitle: "Pure Reading Experience",
    mainSub: "Effortlessly convert your local TXT and PDF documents to the best format for eReader (EPUB), with smart chapter recognition, OCR support, and clean layout.",
    dropZone: "Click or drag TXT / PDF file here",
    dropZoneSub: "Supports TXT and PDF files up to 50MB (large files will be automatically split)",
    remove: "Remove",
    batchInfo: "This file is large. The system will automatically split it into smaller parts (~3.5MB each) locally and package them into a ZIP file for you.",
    aiCover: "Generate exclusive AI cover",
    btnStart: "Start Conversion",
    btnStartBatch: "Start Batch Conversion",
    btnError: "File Error",
    btnConverting: "Converting...",
    preparing: "Preparing system...",
    drawingCover: "Drawing cover...",
    preparingCover: "AI is generating a beautiful cover for you based on the title, please wait.",
    parsingLarge: "Please wait a moment...",
    convertingVolume: "Converting volumes one by one, thank you for your patience.",
    convertingStandard: "Recognizing chapters and formatting, this may take a few seconds.",
    convertingPdf: "Parsing PDF pages and reflowing text...",
    pdfScannedWarning: "No extractable text found in this PDF. It may be a scanned image document. Please use text-based PDFs or TXT files.",
    successTitle: "Conversion Successful!",
    successSub: "Your E-book is ready.",
    downloadZip: "Download ZIP",
    downloadLabel: "Download",
    convertAnother: "Convert another file",
    kindleTipPrefix: "eReader Tip: Transfer the generated EPUB file to your eReader via USB or wireless sync for the best reading experience.",
    kindleTipLink: "",
    kindleTipSuffix: "",
    errorTitle: "Something went wrong",
    btnRetry: "Back & Retry",
    feature1Title: "Multi-device & Multi-format",
    feature1Sub: "Supports TXT and PDF (including scanned PDF OCR). Generated EPUB files work perfectly on all eReader and E-ink devices.",
    feature2Title: "Smart Chapters & Reflow",
    feature2Sub: "Intelligent algorithm automatically identifies chapter markers, PDF bookmarks, and generates a clean TOC.",
    footer: "© 2026 eReaderTxt. Privacy: All conversion and formatting happen locally in your browser. No files are uploaded to any server.",
    onlyTxt: "Currently supports TXT and PDF files.",
    fileTooLarge: "File too large. To ensure stability, files over 50MB are not supported.",
    serverError: "File too large for processing",
    batchError: "An error occurred during batch conversion.",
    partFailed: "Part failed to convert",
    modalClose: "Got it",
    selectFont: "Select Body Font:",
    fontDefault: "System Default (Best)",
    fontSerif: "Serif (Songti)",
    fontSans: "Sans-serif (HarmonyOS)",
    fontKaiti: "Kaiti (Handwriting)",
    selectEncoding: "File Encoding:",
    autoSplitLabel: "Split Large Files:",
    autoSplitOn: "On (Recommended)",
    autoSplitOff: "Off (Single file)",
    encodingAuto: "Auto-detect (Best)",
    encodingUtf8: "UTF-8 (Standard)",
    encodingGb: "GBK / GB18030 (Simplified)",
    encodingBig5: "Big5 (Traditional)",
    pdfOcrTitle: "Scanned PDF OCR:",
    pdfOcrAuto: "Auto-detect (Recommended)",
    pdfOcrForce: "Force OCR (For scans/images)",
    pdfOcrLangLabel: "OCR Recognition Language:",
    pdfOcrLangZh: "Chinese + English",
    pdfOcrLangEn: "English Only",
    pdfOcrLangZht: "Traditional Chinese",
    pdfOcrSuccessNote: "✨ Successfully extracted text via in-browser local OCR",
    cleanWatermarkTitle: "Smart De-watermark & Denoise:",
    cleanWatermarkOn: "Enabled (Remove background faint watermarks/IDs/ads)",
    cleanWatermarkOff: "Keep Raw",
    outputFormat: "Output Format",
    outputFormatDesc: "Best eReader layout · 100% Local processing (Private & Secure)",
    coverPreview: "Cover Preview",
    coverSettingTitle: "Cover Settings",
    coverModeSolid: "Solid Color",
    coverModeAi: "AI Illustration",
    coverModeCustom: "Upload Image",
    coverCustomSelected: "Image Selected",
    coverProcessTitle: "Text Overlay Style",
    coverTitleTypeset: "Typeset Title",
    coverTitleClean: "Clean (No Title)",
    coverReupload: "Change Image",
    fileTypeZip: "ZIP Archive (Split Volumes)",
    fileTypeEpub: "EPUB 3.0 Standard E-book",
    statusGenerated: "Ready",
    downloadBackup: "If download did not start automatically, click here for backup link",
    statsTotalViews: "Page Views",
    statsUniqueVisitors: "Unique Visitors",
    statsTotalConversions: "Books Converted",
    statsLiveBadge: "Live Stats",
  }
};

const Modal = ({ title, isOpen, onClose, children }: { title: string, isOpen: boolean, onClose: () => void, children: React.ReactNode }) => (
  <AnimatePresence>
    {isOpen && (
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm cursor-pointer" 
        />
        <motion.div 
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden"
        >
          <div className="p-8">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-semibold">{title}</h3>
              <button 
                onClick={onClose} 
                className="w-10 h-10 flex items-center justify-center rounded-xl text-slate-400 hover:text-slate-900 hover:bg-slate-100 transition-all cursor-pointer group"
              >
                <X size={24} className="group-hover:scale-110 transition-transform" />
              </button>
            </div>
            <div className="max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
              {children}
            </div>
          </div>
        </motion.div>
      </div>
    )}
  </AnimatePresence>
);

// Helper functions for cover generation
function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number) {
  const isChinese = /[\u4e00-\u9fa5]/.test(text);
  const words = isChinese ? text.split("") : text.split(" ");
  const lines: string[] = [];
  let currentLine = "";

  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    const testLine = currentLine + (currentLine && !isChinese ? " " : "") + word;
    const metrics = ctx.measureText(testLine);
    if (metrics.width > maxWidth && i > 0) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  }
  lines.push(currentLine);
  return lines;
}

interface StyleInfo {
  englishStyle: string;
  chineseTheme: string;
  englishTheme: string;
  accentColor: string;
  bgGradientStart: string;
  bgGradientEnd: string;
}

function getBookStyleInfo(title: string): StyleInfo {
  const lowercaseTitle = title.toLowerCase();
  
  // 1. Sci-Fi / Space / Tech / Cyberpunk
  const scifiKeywords = ['科幻', '未来', '太空', '星际', '宇宙', '机械', '量子', '光年', '智能', '科技', '代码', '程序', '异界', '系统', '网络', '数字', '末日', '病毒', '战舰', '星辉', '光速', '引力', '维度', '赛博', 'cyber', 'sci-fi', 'space', 'system'];
  if (scifiKeywords.some(keyword => lowercaseTitle.includes(keyword))) {
    return {
      englishStyle: "abstract cyberpunk artwork, glowing neon cyan and purple grid, majestic deep space nebula with shimmering digital star dust, futuristic technology texture, cold metallic glow, synthwave digital painting",
      chineseTheme: "科幻未来 (Sci-Fi & Tech)",
      englishTheme: "Sci-Fi & Tech",
      accentColor: "rgba(6, 182, 212, 0.95)", // Cyan-500
      bgGradientStart: "#030712", // gray-950
      bgGradientEnd: "#161b22" // sleek steel-dark
    };
  }

  // 2. Traditional Wuxia / Xianxia / History / Ancient China
  const traditionalKeywords = ['剑', '侠', '武', '仙', '道', '神', '鬼', '魔', '妖', '圣', '帝', '唐', '宋', '明', '汉', '秦', '朝', '传', '志', '录', '记', '卷', '纪', '古', '天下', '乾坤', '九天', '江湖', '修仙', '尊', '尘', '世', '劫', '山', '海', '雨', '墨', '风云', '无双'];
  if (traditionalKeywords.some(keyword => lowercaseTitle.includes(keyword))) {
    return {
      englishStyle: "traditional elegant Chinese ink wash landscape painting style, ethereal misty mountains shrouded in soft clouds, subtle gold leaf foil textures, historic hand-painted oriental watercolor elements, zen minimalism, luxury atmospheric scroll theme",
      chineseTheme: "古典仙侠 (Traditional & Fantasy)",
      englishTheme: "Classic & Fantasy",
      accentColor: "rgba(234, 179, 8, 0.95)", // Gold/Yellow-500
      bgGradientStart: "#1c1917", // warm stone dark
      bgGradientEnd: "#0c0a09"
    };
  }

  // 3. Romance / Sweet / Healing / Youth
  const romanceKeywords = ['情', '爱', '恋', '甜', '暖', '愈', '青春', '少女', '猫', '狗', '花', '夏', '秋', '春', '冬', '晴', '梦', '约定', '初恋', '星星', '眼泪', '心动', '温暖', '纸飞机', '物语', '告白', '歌', '草', '风吹'];
  if (romanceKeywords.some(keyword => lowercaseTitle.includes(keyword))) {
    return {
      englishStyle: "dreamy healing warm soft pastel watercolor style, fluffy pale pink and cream clouds, gentle sunbeam light leaks, aesthetic botanical floral abstract pattern, comforting nostalgic storybook concept art, warm feelings",
      chineseTheme: "治愈言情 (Romance & Healing)",
      englishTheme: "Romance & Healing",
      accentColor: "rgba(244, 63, 94, 0.95)", // Rose-500
      bgGradientStart: "#2e1065", // dark violet
      bgGradientEnd: "#1e1b4b" // dark navy
    };
  }

  // 4. Mystery / Thriller / Dark / Gothic
  const thrillerKeywords = ['悬疑', '惊悚', '推理', '罪', '谜', '暗', '黑', '夜', '雾', '影', '死', '血', '骨', '魂', '诡', '谎言', '尸', '深渊', '迷宫', '盲区', '凶手', '秘密', '夜深', '禁忌', '诅咒'];
  if (thrillerKeywords.some(keyword => lowercaseTitle.includes(keyword))) {
    return {
      englishStyle: "brooding gothic atmospheric oil painting style, heavy mysterious fog rolling over a dark landscape, low key chiaroscuro dramatic lighting, abstract deep crimson stains and dark charcoal textures, eerie cinematic suspense concept art",
      chineseTheme: "悬疑惊悚 (Mystery & Dark)",
      englishTheme: "Mystery & Thriller",
      accentColor: "rgba(239, 68, 68, 0.95)", // Red-500
      bgGradientStart: "#09090b", // zinc-950
      bgGradientEnd: "#18181b" // zinc-900
    };
  }

  // 5. Academic / Business / Personal Growth / Classic Literature / Modern Cities
  const classicKeywords = ['思维', '思考', '学', '法', '论', '思想', '经济', '金融', '管理', '商业', '投资', '资本', '市场', '法则', '科学', '社会', '世界', '人生', '智慧', '传记', '读本', '指南', '都市', '繁华', '孤独', '岁月', '时代'];
  if (classicKeywords.some(keyword => lowercaseTitle.includes(keyword))) {
    return {
      englishStyle: "sophisticated premium modern editorial design style, crisp clean minimalist geometric abstract shapes, marble texture with elegant golden lines, deep warm navy and copper color palettes, fine art paper canvas background, executive luxury look",
      chineseTheme: "社科经典 (Academic & Business)",
      englishTheme: "Academic & Business",
      accentColor: "rgba(14, 165, 233, 0.95)", // Sky-500
      bgGradientStart: "#0f172a", // slate-900
      bgGradientEnd: "#1e293b" // slate-800
    };
  }

  // Default theme
  return {
    englishStyle: "gorgeous elegant clean modern abstract painting style, beautiful organic flowing gradients, professional high-contrast color blocking, fine-art digital oil canvas texture",
    chineseTheme: "精致纪实 (Modern Abstract)",
    englishTheme: "Modern Abstract",
    accentColor: "rgba(129, 140, 248, 0.95)", // Indigo-400
    bgGradientStart: "#111827", // gray-900
    bgGradientEnd: "#1f2937" // gray-800
  };
}

function generateDefaultCover(bookTitle: string, backgroundImageSrc?: string): Promise<string> {
  return new Promise((resolve) => {
    const styleInfo = getBookStyleInfo(bookTitle);
    const canvas = document.createElement("canvas");
    canvas.width = 600;
    canvas.height = 800;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      resolve("");
      return;
    }

    const drawTypography = () => {
      // Draw background dark semi-transparent overlay to ensure text contrast for backgrounds
      if (backgroundImageSrc) {
        ctx.fillStyle = "rgba(15, 23, 42, 0.55)"; // slate-900 with 55% opacity
        ctx.fillRect(0, 0, 600, 800);
      }

      // Draw inner borders
      ctx.strokeStyle = "rgba(255, 255, 255, 0.25)";
      ctx.lineWidth = 2;
      ctx.strokeRect(30, 30, 540, 740);

      ctx.strokeStyle = "rgba(255, 255, 255, 0.1)";
      ctx.lineWidth = 1;
      ctx.strokeRect(36, 36, 528, 728);

      // Setup shadows for maximum text readability on arbitrary backgrounds
      ctx.shadowColor = "rgba(0, 0, 0, 0.75)";
      ctx.shadowBlur = 8;
      ctx.shadowOffsetX = 1;
      ctx.shadowOffsetY = 1;

      // Draw Title text
      ctx.fillStyle = "#ffffff";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      
      // Set appropriate font size depending on title length for better poster style layout
      let fontSize = 48;
      if (bookTitle.length > 15) {
        fontSize = 36;
      } else if (bookTitle.length > 8) {
        fontSize = 44;
      } else {
        fontSize = 54;
      }
      ctx.font = `bold ${fontSize}px "HarmonyOS Sans SC", "Microsoft YaHei", "Noto Sans SC", sans-serif`;
      
      const lines = wrapText(ctx, bookTitle, 460);
      const lineHeight = fontSize * 1.45;
      const totalHeight = lines.length * lineHeight;
      let startY = 400 - (totalHeight / 2);
      if (startY < 180) startY = 180;

      lines.forEach((line, index) => {
        ctx.fillText(line, 300, startY + index * lineHeight);
      });

      // Draw decorative line
      const accentY = startY + totalHeight + 35;
      ctx.fillStyle = styleInfo.accentColor;
      ctx.fillRect(250, accentY, 100, 3);

      // Reset shadows
      ctx.shadowColor = "transparent";
      ctx.shadowBlur = 0;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 0;

      resolve(canvas.toDataURL("image/jpeg", 0.95));
    };

    if (backgroundImageSrc) {
      const img = new Image();
      if (!backgroundImageSrc.startsWith("data:")) {
        img.crossOrigin = "anonymous";
      }
      img.onload = () => {
        ctx.drawImage(img, 0, 0, 600, 800);
        drawTypography();
      };
      img.onerror = () => {
        // Fallback to solid gradient from theme if image load fails
        const gradient = ctx.createLinearGradient(0, 0, 0, 800);
        gradient.addColorStop(0, styleInfo.bgGradientStart);
        gradient.addColorStop(1, styleInfo.bgGradientEnd);
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, 600, 800);
        drawTypography();
      };
      img.src = backgroundImageSrc;
    } else {
      // Draw solid gradient background from theme details
      const gradient = ctx.createLinearGradient(0, 0, 0, 800);
      gradient.addColorStop(0, styleInfo.bgGradientStart);
      gradient.addColorStop(1, styleInfo.bgGradientEnd);
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, 600, 800);
      drawTypography();
    }
  });
}

export default function App() {
  const [lang, setLang] = useState<"zh" | "en">(() => {
    try {
      const saved = localStorage.getItem("ereadertxt_lang");
      if (saved === "zh" || saved === "en") return saved;
    } catch (e) {
      // Ignore storage errors
    }
    if (typeof navigator !== "undefined" && navigator.language) {
      return navigator.language.toLowerCase().startsWith("zh") ? "zh" : "en";
    }
    return "zh";
  });

  const t = translations[lang];

  const handleToggleLang = () => {
    const nextLang = lang === "zh" ? "en" : "zh";
    setLang(nextLang);
    try {
      localStorage.setItem("ereadertxt_lang", nextLang);
    } catch (e) {
      // Ignore storage errors
    }
  };

  // Auto-detect language by IP location if no explicit preference saved
  useEffect(() => {
    try {
      const saved = localStorage.getItem("ereadertxt_lang");
      if (saved === "zh" || saved === "en") {
        return; // User has already chosen a preferred language
      }
    } catch (e) {
      // Continue detection
    }

    const chineseRegions = ["CN", "TW", "HK", "MO", "SG"];
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3000);

    fetch("https://api.country.is", { signal: controller.signal })
      .then((res) => res.json())
      .then((data) => {
        clearTimeout(timer);
        if (data && data.country) {
          const isChineseRegion = chineseRegions.includes(String(data.country).toUpperCase());
          setLang(isChineseRegion ? "zh" : "en");
        }
      })
      .catch(() => {
        // Fallback to secondary geo IP query if primary is unreachable
        fetch("https://ipapi.co/json/", { signal: controller.signal })
          .then((res) => res.json())
          .then((data) => {
            if (data && data.country_code) {
              const isChineseRegion = chineseRegions.includes(String(data.country_code).toUpperCase());
              setLang(isChineseRegion ? "zh" : "en");
            }
          })
          .catch(() => {
            // Keep browser language
          });
      });

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, []);

  const [status, setStatus] = useState<ConversionStatus>("idle");
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [batchProgress, setBatchProgress] = useState({ current: 0, total: 0 });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [showGuide, setShowGuide] = useState(false);
  const [showFAQ, setShowFAQ] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const [showAbout, setShowAbout] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [coverMode, setCoverMode] = useState<"default" | "ai" | "custom">("default");
  const [customCoverBase64, setCustomCoverBase64] = useState<string | null>(null);
  const [customCoverWithTitle, setCustomCoverWithTitle] = useState(true);
  const [customCoverPreview, setCustomCoverPreview] = useState<string | null>(null);
  const customCoverInputRef = useRef<HTMLInputElement>(null);
  const [fontFamily, setFontFamily] = useState<"default" | "serif" | "sans" | "kaiti">("default");
  const [encoding, setEncoding] = useState<"auto" | "utf-8" | "gb18030" | "big5">("auto");
  const [autoSplit, setAutoSplit] = useState(false);
  const [forceOcr, setForceOcr] = useState(false);
  const [ocrLang, setOcrLang] = useState<"chi_sim+eng" | "eng" | "chi_tra+eng">("chi_sim+eng");
  const [removeWatermark, setRemoveWatermark] = useState(true);
  const [pdfProgressMsg, setPdfProgressMsg] = useState<string>("");
  const [isOcrResult, setIsOcrResult] = useState(false);
  const [outputFileName, setOutputFileName] = useState<string>("");
  const [outputBlob, setOutputBlob] = useState<Blob | null>(null);

  const triggerDownload = (url: string, filename: string) => {
    try {
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      link.style.display = "none";
      document.body.appendChild(link);
      link.click();
      setTimeout(() => {
        if (link.parentNode) {
          document.body.removeChild(link);
        }
      }, 300);
    } catch (e) {
      console.error("Download trigger error:", e);
    }
  };
  
  const [feedbackContent, setFeedbackContent] = useState("");
  const [isSubmittingFeedback, setIsSubmittingFeedback] = useState(false);
  const [feedbackStatus, setFeedbackStatus] = useState<"none" | "success" | "error">("none");
  const operationAreaRef = useRef<HTMLElement>(null);
  
  const [stats, setStats] = useState<{
    pageViews: number;
    uniqueVisitors: number;
    totalConversions: number;
  }>(() => {
    try {
      const saved = localStorage.getItem("ereadertxt_cached_stats");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (typeof parsed.pageViews === "number") {
          return {
            pageViews: Math.max(parsed.pageViews, 1),
            uniqueVisitors: Math.max(parsed.uniqueVisitors, 1),
            totalConversions: Math.max(parsed.totalConversions || 0, 0),
          };
        }
      }
    } catch (e) {
      // ignore
    }
    return {
      pageViews: 1,
      uniqueVisitors: 1,
      totalConversions: 0,
    };
  });

  // Track page view and visitor stats (Directly powered by Busuanzi with local cache)
  useEffect(() => {
    let isNewVisitor = false;
    try {
      let vid = localStorage.getItem("ereadertxt_vid");
      if (!vid) {
        vid = "v_" + Math.random().toString(36).substring(2) + Date.now().toString(36);
        localStorage.setItem("ereadertxt_vid", vid);
        isNewVisitor = true;
      }
    } catch (e) {
      // ignore
    }

    const saveStatsLocally = (newStats: { pageViews: number; uniqueVisitors: number; totalConversions: number }) => {
      setStats(newStats);
      try {
        localStorage.setItem("ereadertxt_cached_stats", JSON.stringify(newStats));
      } catch (e) {
        // ignore
      }
    };

    // Query Busuanzi directly
    try {
      const callbackName = "bsz_cb_" + Math.random().toString(36).substring(2, 9);
      const script = document.createElement("script");
      const cleanup = () => {
        try {
          delete (window as any)[callbackName];
          if (script.parentNode) script.parentNode.removeChild(script);
        } catch (e) {
          // ignore
        }
      };

      const timeout = setTimeout(() => {
        cleanup();
        // Fallback local self-increment if network is slow/offline
        setStats((prev) => {
          const next = {
            pageViews: prev.pageViews + 1,
            uniqueVisitors: prev.uniqueVisitors + (isNewVisitor ? 1 : 0),
            totalConversions: prev.totalConversions,
          };
          saveStatsLocally(next);
          return next;
        });
      }, 4000);

      (window as any)[callbackName] = (data: any) => {
        clearTimeout(timeout);
        cleanup();
        if (data && (typeof data.site_pv === "number" || typeof data.page_pv === "number")) {
          const pv = Math.max(Number(data.site_pv || data.page_pv || 1), 1);
          const uv = Math.max(Number(data.site_uv || 1), 1);
          setStats((prev) => {
            const next = {
              pageViews: pv,
              uniqueVisitors: uv,
              totalConversions: prev.totalConversions,
            };
            saveStatsLocally(next);
            return next;
          });
        }
      };

      script.src = `https://busuanzi.ibruce.info/busuanzi?jsonpCallback=${callbackName}`;
      script.async = true;
      script.referrerPolicy = "no-referrer-when-downgrade";
      script.onerror = () => {
        clearTimeout(timeout);
        cleanup();
      };
      document.head.appendChild(script);

      return () => {
        clearTimeout(timeout);
        cleanup();
      };
    } catch (e) {
      // ignore
    }
  }, []);

  const trackConversionSuccess = () => {
    setStats((prev) => {
      const next = { ...prev, totalConversions: prev.totalConversions + 1 };
      try {
        localStorage.setItem("ereadertxt_cached_stats", JSON.stringify(next));
      } catch (e) {
        // ignore
      }
      return next;
    });
    fetch("/api/stats/conversion", { method: "POST" }).catch(() => {});
  };

  useEffect(() => {
    if (coverMode === "custom" && customCoverBase64) {
      if (customCoverWithTitle && file) {
        const bookName = file.name.replace(/\.(txt|pdf)$/i, "");
        generateDefaultCover(bookName, customCoverBase64).then(setCustomCoverPreview);
      } else {
        setCustomCoverPreview(customCoverBase64);
      }
    } else {
      setCustomCoverPreview(null);
    }
  }, [coverMode, customCoverBase64, customCoverWithTitle, file]);

  const processFile = (selectedFile: File) => {
    setError(null);
    const isTxt = selectedFile.type === "text/plain" || selectedFile.name.toLowerCase().endsWith(".txt");
    const isPdf = selectedFile.type === "application/pdf" || selectedFile.name.toLowerCase().endsWith(".pdf");
    
    if (!isTxt && !isPdf) {
      setError(t.onlyTxt);
      setFile(null);
      return;
    }
    
    if (selectedFile.size > 50 * 1024 * 1024) {
      setError(t.fileTooLarge);
      setFile(selectedFile); // 依然显示文件，但是会展示报错
      return;
    }
    
    setFile(selectedFile);
    setStatus("idle");
    setTimeout(() => {
      operationAreaRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 100);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      processFile(selectedFile);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsDragging(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const selectedFile = e.dataTransfer.files?.[0];
    if (selectedFile) {
      if (status !== "idle" && status !== "error" && status !== "success") return;
      processFile(selectedFile);
    }
  };

  const handleCustomCoverUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = 600;
        canvas.height = 800;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        const imgRatio = img.width / img.height;
        const canvasRatio = canvas.width / canvas.height;
        let drawWidth, drawHeight, offsetX, offsetY;

        if (imgRatio > canvasRatio) {
          drawHeight = canvas.height;
          drawWidth = img.width * (canvas.height / img.height);
          offsetX = (canvas.width - drawWidth) / 2;
          offsetY = 0;
        } else {
          drawWidth = canvas.width;
          drawHeight = img.height * (canvas.width / img.width);
          offsetX = 0;
          offsetY = (canvas.height - drawHeight) / 2;
        }

        ctx.drawImage(img, offsetX, offsetY, drawWidth, drawHeight);
        setCustomCoverBase64(canvas.toDataURL("image/jpeg", 0.95));
        setCoverMode("custom");
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleUpload = async () => {
    if (!file) return;

    setStatus("uploading");
    setError(null);

    const isPdf = file.name.toLowerCase().endsWith(".pdf") || file.type === "application/pdf";
    const bookTitleBase = file.name.replace(/\.(txt|pdf)$/i, "");

    let generatedCoverBase64: string | null = null;
    
    if (coverMode === "custom" && customCoverBase64) {
      if (customCoverWithTitle) {
        setStatus("generating_cover");
        try {
          generatedCoverBase64 = await generateDefaultCover(bookTitleBase, customCoverBase64);
        } catch (err) {
          console.error("Failed to generate custom cover with title:", err);
          generatedCoverBase64 = customCoverBase64;
        }
      } else {
        generatedCoverBase64 = customCoverBase64;
      }
    } else if (coverMode === "ai") {
      setStatus("generating_cover");
      try {
        const styleInfo = getBookStyleInfo(bookTitleBase);
        const promptString = `A gorgeous, elegant and clean abstract background illustration or textured art theme for a book cover. Style keyword: ${styleInfo.englishStyle}. Specific visual elements inspired by the title "${bookTitleBase}". Strictly NO text, NO letters, NO words, minimal style, empty space in the center, professional color palette, high resolution digital painting.`;
        
        // 使用免费免 Key 的图片生成服务
        const coverUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(promptString)}?width=600&height=800&nologo=true`;
        generatedCoverBase64 = await generateDefaultCover(bookTitleBase, coverUrl);
      } catch (err) {
        console.error("Failed to generate cover:", err);
      }
    }

    // fallback generator for non-AI mode or failed AI fetch
    if (!generatedCoverBase64) {
      try {
        generatedCoverBase64 = await generateDefaultCover(bookTitleBase);
      } catch (err) {
        console.error("Failed to generate default canvas cover:", err);
      }
    }

    // Pure client-side local EPUB conversion
    setStatus("converting");

    try {
      const buffer = await file.arrayBuffer();

      // Handle PDF conversion
      if (isPdf) {
        setBatchProgress({ current: 0, total: -2 }); // -2 indicates PDF parsing
        setPdfProgressMsg(t.convertingPdf);
        setIsOcrResult(false);

        const pdfResult = await parsePdfBuffer(
          buffer,
          (info) => {
            setBatchProgress({ current: info.current, total: info.total });
            if (lang === "zh") {
              if (info.type === 'extracting') {
                setPdfProgressMsg(`正在提取页面文字 (${info.current}/${info.total})...`);
              } else if (info.type === 'ocr_init') {
                setPdfProgressMsg('检测到扫描/图片版 PDF，正在初始化本地 OCR 识别引擎...');
              } else if (info.type === 'ocr_page') {
                setPdfProgressMsg(`正在本地 OCR 识别第 ${info.current}/${info.total} 页...`);
              } else if (info.message) {
                setPdfProgressMsg(info.message);
              }
            } else {
              if (info.type === 'extracting') {
                setPdfProgressMsg(`Extracting text from page ${info.current}/${info.total}...`);
              } else if (info.type === 'ocr_init') {
                setPdfProgressMsg('Scanned PDF detected. Initializing local OCR engine...');
              } else if (info.type === 'ocr_page') {
                setPdfProgressMsg(`Running local OCR on page ${info.current}/${info.total}...`);
              } else if (info.message) {
                setPdfProgressMsg(info.message);
              }
            }
          },
          {
            forceOcr,
            ocrLang,
            removeWatermark
          }
        );

        if (!pdfResult.rawText || !pdfResult.rawText.trim()) {
          throw new Error(t.pdfScannedWarning);
        }

        setIsOcrResult(!!pdfResult.isOcr);

        const finalBookTitle = pdfResult.title && pdfResult.title.length > 1 ? pdfResult.title : bookTitleBase;
        const finalAuthor = pdfResult.author && pdfResult.author.length > 1 ? pdfResult.author : "eReaderTxt";

        const epubBlob = await buildLocalEpub({
          title: finalBookTitle,
          author: finalAuthor,
          chapters: pdfResult.chapters,
          coverBase64: generatedCoverBase64,
          fontFamily,
          lang,
        });

        const fileName = `${finalBookTitle}.epub`;
        const url = window.URL.createObjectURL(epubBlob);
        setDownloadUrl(url);
        setOutputFileName(fileName);
        setOutputBlob(epubBlob);
        setStatus("success");
        trackConversionSuccess();
        setBatchProgress({ current: 0, total: 0 });
        triggerDownload(url, fileName);
        return;
      }

      // Handle TXT conversion
      const uint8Array = new Uint8Array(buffer);
      const decodedText = decodeBufferToText(uint8Array, jschardet, encoding);
      const bookTitle = bookTitleBase;

      if (autoSplit && file.size > 4.5 * 1024 * 1024) {
        setBatchProgress({ current: 0, total: -1 });
        await new Promise(resolve => setTimeout(resolve, 300));

        const lines = decodedText.split('\n');
        const chunks: string[] = [];
        let currentChunk: string[] = [];
        let currentSize = 0;
        const TARGET_SIZE = 3.5 * 1024 * 1024; // 3.5MB
        const textEncoder = new TextEncoder();

        for (let i = 0; i < lines.length; i++) {
          if (i % 5000 === 0) {
            await new Promise(r => setTimeout(r, 0));
          }
          const line = lines[i];
          const lineSize = textEncoder.encode(line).length + 1;
          if (currentSize + lineSize > TARGET_SIZE && currentChunk.length > 0) {
            chunks.push(currentChunk.join('\n'));
            currentChunk = [];
            currentSize = 0;
          }
          currentChunk.push(line);
          currentSize += lineSize;
        }
        if (currentChunk.length > 0) {
          chunks.push(currentChunk.join('\n'));
        }

        const zip = new JSZip();
        for (let i = 0; i < chunks.length; i++) {
          setBatchProgress({ current: i + 1, total: chunks.length });
          await new Promise(r => setTimeout(r, 20));

          const partTitle = `${bookTitle} (${lang === "zh" ? `第 ${i + 1} 卷` : `Part ${i + 1}`})`;
          const partChapters = extractChapters(chunks[i], lang);
          const epubBlob = await buildLocalEpub({
            title: partTitle,
            author: "eReaderTxt",
            chapters: partChapters,
            coverBase64: generatedCoverBase64,
            fontFamily,
            lang,
          });

          zip.file(`${bookTitle}_part${i + 1}.epub`, epubBlob);
        }

        const zipBlob = await zip.generateAsync({ type: "blob" });
        const fileName = `${bookTitle}_${lang === "zh" ? "分卷包" : "volumes"}.zip`;
        const url = window.URL.createObjectURL(zipBlob);
        setDownloadUrl(url);
        setOutputFileName(fileName);
        setOutputBlob(zipBlob);
        setStatus("success");
        trackConversionSuccess();
        setBatchProgress({ current: 0, total: 0 });
        triggerDownload(url, fileName);
        return;
      }

      // Single file conversion (100% client side)
      await new Promise(resolve => setTimeout(resolve, 200));
      const chapters = extractChapters(decodedText, lang);
      const epubBlob = await buildLocalEpub({
        title: bookTitle,
        author: "eReaderTxt",
        chapters,
        coverBase64: generatedCoverBase64,
        fontFamily,
        lang,
      });

      const fileName = `${bookTitle}.epub`;
      const url = window.URL.createObjectURL(epubBlob);
      setDownloadUrl(url);
      setOutputFileName(fileName);
      setOutputBlob(epubBlob);
      setStatus("success");
      trackConversionSuccess();
      setBatchProgress({ current: 0, total: 0 });
      triggerDownload(url, fileName);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : (lang === "zh" ? "本地转换过程中发生故障" : "An error occurred during local conversion"));
      setStatus("error");
      setBatchProgress({ current: 0, total: 0 });
    }
  };

  const handleFeedbackSubmit = async () => {
    if (!feedbackContent.trim() || isSubmittingFeedback) return;
    
    setIsSubmittingFeedback(true);
    setFeedbackStatus("none");
    
    try {
      const response = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: feedbackContent.trim() }),
      });
      
      if (response.ok) {
        setFeedbackStatus("success");
        setFeedbackContent("");
        setTimeout(() => setShowFeedback(false), 2000);
      } else {
        setFeedbackStatus("error");
      }
    } catch (err) {
      console.error(err);
      setFeedbackStatus("error");
    } finally {
      setIsSubmittingFeedback(false);
    }
  };

  const reset = () => {
    setFile(null);
    setStatus("idle");
    setError(null);
    setDownloadUrl(null);
    setOutputFileName("");
    setOutputBlob(null);
    setBatchProgress({ current: 0, total: 0 });
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <div 
      className="min-h-screen bg-[#FDFCFB] text-slate-900 font-sans selection:bg-orange-100"
      onDragOver={handleDragOver}
      onDragEnter={(e) => e.preventDefault()}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Top Navigation */}
      <header className="border-b border-slate-200 bg-white/80 backdrop-blur-md sticky top-0 z-50">
        <div className="w-full max-w-[96vw] 2xl:max-w-[2200px] mx-auto px-6 lg:px-12 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setShowAbout(true)} 
              className="flex items-center gap-2 hover:opacity-70 transition-opacity cursor-pointer group"
            >
              <div className="bg-slate-900 text-white p-1.5 rounded-lg group-hover:scale-110 transition-transform">
                <BookOpen size={20} />
              </div>
              <span className="font-semibold text-lg tracking-tight">eReaderTxt</span>
            </button>

            {/* Subtle Visitor Indicator in Header */}
            {stats.uniqueVisitors > 0 && (
              <div className="hidden xl:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100/90 text-slate-500 text-xs font-medium border border-slate-200/60" title={`${t.statsUniqueVisitors}: ${stats.uniqueVisitors}`}>
                <Users size={12} className="text-slate-400" />
                <span className="tabular-nums font-semibold text-slate-700">{stats.uniqueVisitors.toLocaleString()}</span>
              </div>
            )}
          </div>

          <nav className="flex items-center gap-3 sm:gap-6 text-sm font-medium text-slate-500">
            <div className="hidden md:flex portrait:hidden portrait:lg:flex items-center gap-6">
              <button onClick={() => setShowGuide(true)} className="hover:text-slate-900 transition-colors cursor-pointer">{t.guide}</button>
              <button onClick={() => setShowFAQ(true)} className="hover:text-slate-900 transition-colors cursor-pointer">{t.faq}</button>
              <button onClick={() => { setShowFeedback(true); setFeedbackStatus("none"); }} className="hover:text-slate-900 transition-colors cursor-pointer">{t.feedback}</button>
            </div>
            <button 
              onClick={handleToggleLang} 
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 transition-all text-slate-700 font-semibold cursor-pointer"
            >
              <span className={lang === "zh" ? "text-slate-900" : "text-slate-400"}>文</span>
              <span className="text-slate-300">/</span>
              <span className={lang === "en" ? "text-slate-900" : "text-slate-400"}>A</span>
            </button>
          </nav>
        </div>
      </header>

      {/* About Modal */}
      <Modal title={t.aboutTitle} isOpen={showAbout} onClose={() => setShowAbout(false)}>
        <div className="text-center py-4">
          <p className="text-slate-600 text-lg leading-relaxed">
            {lang === "zh" ? (
              <>本应用由 <a href="https://me.onapp.xyz" target="_blank" rel="noopener noreferrer" className="text-slate-900 font-bold underline underline-offset-4 hover:text-orange-600 transition-colors">Alex孟博士</a> 开发</>
            ) : (
              <>This app is developed by <a href="https://me.onapp.xyz" target="_blank" rel="noopener noreferrer" className="text-slate-900 font-bold underline underline-offset-4 hover:text-orange-600 transition-colors">Dr. Alex Meng</a></>
            )}
          </p>
          <p className="text-slate-400 mt-4 italic">
            {t.aboutEnjoy}
          </p>
        </div>
      </Modal>

      {/* Guide Modal */}
      <Modal title={t.guideTitle} isOpen={showGuide} onClose={() => setShowGuide(false)}>
        <div className="space-y-6 text-slate-600 leading-relaxed">
          <div className="flex gap-4">
            <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center shrink-0 font-bold text-slate-900">1</div>
            <p>{t.guideStep1}</p>
          </div>
          <div className="flex gap-4">
            <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center shrink-0 font-bold text-slate-900">2</div>
            <p>{t.guideStep2}</p>
          </div>
          <div className="flex gap-4">
            <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center shrink-0 font-bold text-slate-900">3</div>
            <p>{t.guideStep3}</p>
          </div>
          <div className="flex gap-4">
            <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center shrink-0 font-bold text-slate-900">4</div>
            <p>{t.guideStep4}</p>
          </div>
          <div className="flex gap-4">
            <div className="w-8 h-8 rounded-full bg-indigo-50 flex items-center justify-center shrink-0 font-bold text-indigo-600">5</div>
            <p className="font-medium text-slate-900">{t.guideStep5}</p>
          </div>
        </div>
      </Modal>

      {/* FAQ Modal */}
      <Modal title={t.faqTitle} isOpen={showFAQ} onClose={() => setShowFAQ(false)}>
        <div className="space-y-8 text-slate-600 leading-relaxed">
          <div>
            <h4 className="font-bold text-slate-900 mb-2">{t.faqQ1}</h4>
            <p>{t.faqA1}</p>
          </div>
          <div>
            <h4 className="font-bold text-slate-900 mb-2">{t.faqQ2}</h4>
            <p>{t.faqA2}</p>
          </div>
          <div>
            <h4 className="font-bold text-slate-900 mb-2">{t.faqQ3}</h4>
            <p>{t.faqA3}</p>
          </div>
          <div>
            <h4 className="font-bold text-slate-900 mb-2">{t.faqQ4}</h4>
            <p>{t.faqA4}</p>
          </div>
          <div>
            <h4 className="font-bold text-slate-900 mb-2">{t.faqQ5}</h4>
            <p>{t.faqA5}</p>
          </div>
          <div className="pt-4 border-t border-slate-100">
            <h4 className="font-bold text-slate-900 mb-2">{t.faqQ6}</h4>
            <p className="text-sm bg-indigo-50 p-3 rounded-xl text-indigo-900">{t.faqA6}</p>
          </div>
        </div>
      </Modal>

      {/* Feedback Modal */}
      <Modal title={t.feedbackTitle} isOpen={showFeedback} onClose={() => setShowFeedback(false)}>
        <div className="space-y-4">
          <p className="text-sm text-slate-500">{t.feedbackSub}</p>
          <textarea
            value={feedbackContent}
            onChange={(e) => setFeedbackContent(e.target.value.slice(0, 300))}
            placeholder={t.feedbackPlaceholder}
            className="w-full h-40 p-4 rounded-2xl border border-slate-200 focus:border-slate-900 focus:ring-1 focus:ring-slate-900 outline-none transition-all resize-none text-slate-700 bg-slate-50/50"
          />
          <div className="flex items-center justify-between">
            <span className={`text-xs ${feedbackContent.length >= 300 ? "text-red-500" : "text-slate-400"}`}>
              {feedbackContent.length}/300
            </span>
            <button
              onClick={handleFeedbackSubmit}
              disabled={!feedbackContent.trim() || isSubmittingFeedback}
              className={`px-6 py-2.5 rounded-xl font-semibold transition-all flex items-center gap-2 ${
                !feedbackContent.trim() || isSubmittingFeedback
                  ? "bg-slate-100 text-slate-400 cursor-not-allowed"
                  : "bg-slate-900 text-white hover:bg-slate-800"
              }`}
            >
              {isSubmittingFeedback ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  {t.feedbackSending}
                </>
              ) : (
                t.feedbackSubmit
              )}
            </button>
          </div>
          
          <AnimatePresence>
            {feedbackStatus !== "none" && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className={`p-3 rounded-xl text-center text-sm font-medium ${
                  feedbackStatus === "success" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
                }`}
              >
                {feedbackStatus === "success" ? t.feedbackSuccess : t.feedbackError}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </Modal>

      <main className="w-full max-w-[94vw] 2xl:max-w-[2000px] mx-auto px-6 lg:px-12 py-12 md:py-20">
        <section className="text-center mb-16">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <h1 className="text-4xl md:text-5xl font-serif font-medium mb-4 text-slate-900 italic">
              {t.mainTitle}
            </h1>
            <p className="text-lg text-slate-500 max-w-xl mx-auto leading-relaxed">
              {t.mainSub}
            </p>
          </motion.div>
        </section>

        {/* Converter Card */}
        <section className="w-full max-w-[90vw] 2xl:max-w-[1800px] mx-auto" ref={operationAreaRef}>
          <motion.div 
            layout
            className="bg-white border border-slate-200 rounded-3xl shadow-sm overflow-hidden"
          >
            <div className="p-8 md:p-12 xl:p-16">
              <AnimatePresence mode="wait">
                {status === "idle" && (
                  <motion.div
                    key="idle"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className={!file ? "flex flex-col items-center" : "grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-16 xl:gap-20 items-end"}
                  >
                    {!file ? (
                      <div 
                        onClick={() => fileInputRef.current?.click()}
                        className={`w-full border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-all group ${
                          isDragging 
                            ? "border-orange-400 bg-orange-50/50" 
                            : "border-slate-200 hover:border-slate-400 hover:bg-slate-50/50"
                        }`}
                      >
                        <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 transition-transform ${
                          isDragging ? "bg-orange-100 scale-110" : "bg-slate-50 group-hover:scale-110"
                        }`}>
                          <Upload className={isDragging ? "text-orange-500" : "text-slate-400 group-hover:text-slate-600"} size={28} />
                        </div>
                        <p className="font-medium text-slate-700 mb-1">{t.dropZone}</p>
                        <p className="text-sm text-slate-400">{t.dropZoneSub}</p>
                        <input 
                          type="file" 
                          ref={fileInputRef}
                          onChange={handleFileChange}
                          accept=".txt,.pdf,text/plain,application/pdf"
                          className="hidden" 
                        />
                      </div>
                    ) : (
                      <>
                        <div className="w-full flex flex-col gap-6">
                          <div className={`flex items-center gap-4 p-6 rounded-2xl border transition-colors ${
                            error ? "bg-red-50 border-red-100" : "bg-slate-50 border-slate-100"
                          }`}>
                          <div className={`w-12 h-12 rounded-xl shadow-sm flex items-center justify-center transition-colors ${
                            error 
                              ? "bg-white text-red-500" 
                              : (file.name.toLowerCase().endsWith(".pdf") || file.type === "application/pdf")
                                ? "bg-red-50 text-red-600"
                                : "bg-white text-slate-400"
                          }`}>
                            {error ? <AlertCircle size={20} /> : (
                              (file.name.toLowerCase().endsWith(".pdf") || file.type === "application/pdf")
                                ? <span className="font-bold text-xs">PDF</span>
                                : <FileText size={20} />
                            )}
                          </div>
                          <div className="flex-1 min-w-0 text-left">
                            <div className="flex items-center gap-2">
                              <h3 className={`font-medium truncate ${error ? "text-red-900" : "text-slate-900"}`}>{file.name}</h3>
                              {(file.name.toLowerCase().endsWith(".pdf") || file.type === "application/pdf") && (
                                <span className="px-1.5 py-0.5 text-[10px] font-semibold bg-red-100 text-red-700 rounded">PDF</span>
                              )}
                            </div>
                            <p className={`text-sm ${error ? "text-red-600" : "text-slate-500"}`}>
                              {(file.size / 1024 / 1024).toFixed(2)} MB
                            </p>
                          </div>
                          <button 
                            onClick={reset}
                            className="text-sm text-slate-400 hover:text-red-500 underline underline-offset-4"
                          >
                            {t.remove}
                          </button>
                        </div>

                        {!error && file && coverMode !== "custom" && (
                          <div className="mb-6 p-4 bg-orange-50/40 rounded-2xl border border-orange-100/50 flex items-center gap-3 text-slate-700 text-sm text-left">
                            <Sparkles size={18} className="text-orange-500 shrink-0" />
                            <div>
                              <p className="font-semibold text-slate-800">
                                {lang === "zh" ? "书名风格匹配" : "Theme Style Matched"}
                              </p>
                              <p className="text-xs text-slate-500 mt-0.5">
                                {lang === "zh" 
                                  ? `智能算法已分析书名，并自动匹配 ${getBookStyleInfo(file.name.replace(/\.(txt|pdf)$/i, "")).chineseTheme} 专属设计风格` 
                                  : `AI analyzed the title and matched ${getBookStyleInfo(file.name.replace(/\.(txt|pdf)$/i, "")).englishTheme} design style`}
                              </p>
                            </div>
                          </div>
                        )}

                        {error && status === "idle" && (
                          <div className="mb-6 p-4 bg-red-50/50 rounded-2xl border border-red-100/50 flex gap-3 text-red-800 text-sm text-left">
                            <AlertCircle size={18} className="shrink-0 mt-0.5" />
                            <p>{error}</p>
                          </div>
                        )}

                        {file.size > 4.5 * 1024 * 1024 && !error && status === "idle" && !(file.name.toLowerCase().endsWith(".pdf") || file.type === "application/pdf") && (
                          <div className="p-4 bg-blue-50/50 rounded-2xl border border-blue-100/50 flex gap-3 text-blue-800 text-sm text-left">
                            <Info size={18} className="shrink-0 mt-0.5" />
                            <p>{t.batchInfo}</p>
                          </div>
                        )}

                        {coverMode === "custom" && customCoverPreview && (
                          <div className="flex flex-col items-center bg-slate-50 border border-slate-200 rounded-xl p-6">
                            <div className="text-sm font-semibold text-slate-700 mb-4 self-start">{t.coverPreview}</div>
                            <div className="relative shadow-md overflow-hidden rounded border border-slate-200" style={{ width: "225px", height: "300px" }}>
                              <img src={customCoverPreview} alt="Cover Preview" className="w-full h-full object-cover" />
                            </div>
                          </div>
                        )}
                        </div>
                        
                        <div className="w-full flex flex-col gap-6">
                          <div className="flex items-center justify-between p-3.5 bg-slate-50 border border-slate-200/80 rounded-xl text-left">
                            <div className="flex items-center gap-2.5">
                              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
                              <div>
                                <span className="text-xs font-semibold text-slate-800 tracking-tight">{t.outputFormat}</span>
                                <p className="text-[11px] text-slate-500">{t.outputFormatDesc}</p>
                              </div>
                            </div>
                            <span className="px-2.5 py-1 text-xs font-bold bg-slate-900 text-white rounded-lg tracking-wide">
                              EPUB
                            </span>
                          </div>

                          {!(file.name.toLowerCase().endsWith(".pdf") || file.type === "application/pdf") && (
                            <>
                              <div className="flex flex-col gap-3 mb-6">
                                <label className="text-sm font-semibold text-slate-700 block text-left">{t.selectEncoding}</label>
                                <div className="grid grid-cols-2 gap-2">
                                  {[
                                    { id: "auto", label: t.encodingAuto },
                                    { id: "utf-8", label: t.encodingUtf8 },
                                    { id: "gb18030", label: t.encodingGb },
                                    { id: "big5", label: t.encodingBig5 },
                                  ].map((enc) => (
                                    <button
                                      key={enc.id}
                                      onClick={() => setEncoding(enc.id as any)}
                                      className={`py-2 px-2.5 text-xs font-medium rounded-xl border transition-all text-center truncate ${
                                        encoding === enc.id
                                          ? "bg-slate-900 text-white border-slate-900 shadow-sm"
                                          : "bg-white text-slate-600 border-slate-200 hover:border-slate-400 hover:bg-slate-50"
                                      }`}
                                      title={enc.label}
                                    >
                                      {enc.label}
                                    </button>
                                  ))}
                                </div>
                              </div>

                              <div className="flex flex-col gap-3 mb-6">
                                <label className="text-sm font-semibold text-slate-700 block text-left">{t.autoSplitLabel}</label>
                                <div className="grid grid-cols-2 gap-2">
                                  <button
                                    onClick={() => setAutoSplit(false)}
                                    className={`py-2 px-2.5 text-xs font-medium rounded-xl border transition-all text-center truncate ${
                                      !autoSplit
                                        ? "bg-slate-900 text-white border-slate-900 shadow-sm"
                                        : "bg-white text-slate-600 border-slate-200 hover:border-slate-400 hover:bg-slate-50"
                                    }`}
                                  >
                                    {t.autoSplitOff}
                                  </button>
                                  <button
                                    onClick={() => setAutoSplit(true)}
                                    className={`py-2 px-2.5 text-xs font-medium rounded-xl border transition-all text-center truncate ${
                                      autoSplit
                                        ? "bg-slate-900 text-white border-slate-900 shadow-sm"
                                        : "bg-white text-slate-600 border-slate-200 hover:border-slate-400 hover:bg-slate-50"
                                    }`}
                                  >
                                    {t.autoSplitOn}
                                  </button>
                                </div>
                              </div>
                            </>
                          )}

                          {(file.name.toLowerCase().endsWith(".pdf") || file.type === "application/pdf") && (
                            <div className="flex flex-col gap-4 mb-6 p-4 bg-slate-50 border border-slate-200/80 rounded-2xl">
                              <div className="flex flex-col gap-2">
                                <label className="text-sm font-semibold text-slate-800 block text-left">{t.pdfOcrTitle}</label>
                                <div className="grid grid-cols-2 gap-2">
                                  <button
                                    onClick={() => setForceOcr(false)}
                                    className={`py-2 px-2.5 text-xs font-medium rounded-xl border transition-all text-center ${
                                      !forceOcr
                                        ? "bg-slate-900 text-white border-slate-900 shadow-sm"
                                        : "bg-white text-slate-600 border-slate-200 hover:border-slate-400 hover:bg-slate-50"
                                    }`}
                                  >
                                    {t.pdfOcrAuto}
                                  </button>
                                  <button
                                    onClick={() => setForceOcr(true)}
                                    className={`py-2 px-2.5 text-xs font-medium rounded-xl border transition-all text-center ${
                                      forceOcr
                                        ? "bg-slate-900 text-white border-slate-900 shadow-sm"
                                        : "bg-white text-slate-600 border-slate-200 hover:border-slate-400 hover:bg-slate-50"
                                    }`}
                                  >
                                    {t.pdfOcrForce}
                                  </button>
                                </div>
                              </div>

                              <div className="flex flex-col gap-2">
                                <label className="text-xs font-medium text-slate-600 block text-left">{t.pdfOcrLangLabel}</label>
                                <div className="grid grid-cols-3 gap-1.5">
                                  {[
                                    { id: "chi_sim+eng", label: t.pdfOcrLangZh },
                                    { id: "eng", label: t.pdfOcrLangEn },
                                    { id: "chi_tra+eng", label: t.pdfOcrLangZht },
                                  ].map((langItem) => (
                                    <button
                                      key={langItem.id}
                                      onClick={() => setOcrLang(langItem.id as any)}
                                      className={`py-1.5 px-2 text-[11px] font-medium rounded-lg border transition-all text-center truncate ${
                                        ocrLang === langItem.id
                                          ? "bg-slate-800 text-white border-slate-800 shadow-sm"
                                          : "bg-white text-slate-600 border-slate-200 hover:border-slate-400"
                                      }`}
                                      title={langItem.label}
                                    >
                                      {langItem.label}
                                    </button>
                                  ))}
                                </div>
                              </div>

                              <div className="flex flex-col gap-2">
                                <label className="text-xs font-medium text-slate-600 block text-left">{t.cleanWatermarkTitle}</label>
                                <div className="grid grid-cols-2 gap-2">
                                  <button
                                    onClick={() => setRemoveWatermark(true)}
                                    className={`py-1.5 px-2 text-[11px] font-medium rounded-lg border transition-all text-center ${
                                      removeWatermark
                                        ? "bg-slate-800 text-white border-slate-800 shadow-sm"
                                        : "bg-white text-slate-600 border-slate-200 hover:border-slate-400"
                                    }`}
                                  >
                                    {t.cleanWatermarkOn}
                                  </button>
                                  <button
                                    onClick={() => setRemoveWatermark(false)}
                                    className={`py-1.5 px-2 text-[11px] font-medium rounded-lg border transition-all text-center ${
                                      !removeWatermark
                                        ? "bg-slate-800 text-white border-slate-800 shadow-sm"
                                        : "bg-white text-slate-600 border-slate-200 hover:border-slate-400"
                                    }`}
                                  >
                                    {t.cleanWatermarkOff}
                                  </button>
                                </div>
                              </div>
                            </div>
                          )}

                          <div className="flex flex-col gap-3 mb-6">
                          <label className="text-sm font-semibold text-slate-700 block text-left">{t.selectFont}</label>
                          <div className="grid grid-cols-2 gap-2">
                            {[
                              { id: "default", label: t.fontDefault },
                              { id: "serif", label: t.fontSerif },
                              { id: "sans", label: t.fontSans },
                              { id: "kaiti", label: t.fontKaiti },
                            ].map((f) => (
                              <button
                                key={f.id}
                                onClick={() => setFontFamily(f.id as any)}
                                className={`py-2.5 px-3 text-xs font-medium rounded-xl border transition-all text-center ${
                                  fontFamily === f.id
                                    ? "bg-slate-900 text-white border-slate-900 shadow-sm"
                                    : "bg-white text-slate-600 border-slate-200 hover:border-slate-400 hover:bg-slate-50"
                                }`}
                              >
                                {f.label}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div className="flex flex-col gap-3 mb-6">
                          <label className="text-sm font-semibold text-slate-700 block text-left">{t.coverSettingTitle}</label>
                          <div className="grid grid-cols-3 gap-2">
                            <button
                              onClick={() => setCoverMode("default")}
                              className={`py-2 px-2 text-xs font-medium rounded-xl border transition-all text-center flex flex-col items-center justify-center gap-1.5 h-20 ${
                                coverMode === "default"
                                  ? "bg-slate-900 text-white border-slate-900 shadow-sm"
                                  : "bg-white text-slate-600 border-slate-200 hover:border-slate-400 hover:bg-slate-50"
                              }`}
                            >
                              <BookOpen size={20} className={coverMode === "default" ? "text-white" : "text-slate-400"} />
                              {t.coverModeSolid}
                            </button>
                            <button
                              onClick={() => setCoverMode("ai")}
                              className={`py-2 px-2 text-xs font-medium rounded-xl border transition-all text-center flex flex-col items-center justify-center gap-1.5 h-20 ${
                                coverMode === "ai"
                                  ? "bg-slate-900 text-white border-slate-900 shadow-sm"
                                  : "bg-white text-slate-600 border-slate-200 hover:border-slate-400 hover:bg-slate-50"
                              }`}
                            >
                              <Sparkles size={20} className={coverMode === "ai" ? "text-orange-400" : "text-orange-500"} />
                              {t.coverModeAi}
                            </button>
                            <button
                              onClick={() => {
                                setCoverMode("custom");
                                if (!customCoverBase64) {
                                  customCoverInputRef.current?.click();
                                }
                              }}
                              className={`relative py-2 px-2 text-xs font-medium rounded-xl border transition-all text-center flex flex-col items-center justify-center gap-1.5 overflow-hidden h-20 ${
                                coverMode === "custom"
                                  ? "bg-slate-900 text-white border-slate-900 shadow-sm"
                                  : "bg-white text-slate-600 border-slate-200 hover:border-slate-400 hover:bg-slate-50"
                              }`}
                            >
                              {coverMode === "custom" && customCoverBase64 ? (
                                <>
                                  <img src={customCoverBase64} alt="Custom cover" className="absolute inset-0 w-full h-full object-cover opacity-40 blur-sm" />
                                  <ImageIcon size={20} className="relative z-10 text-white" />
                                  <span className="relative z-10">{t.coverCustomSelected}</span>
                                </>
                              ) : (
                                <>
                                  <Upload size={20} className={coverMode === "custom" ? "text-white" : "text-slate-400"} />
                                  {t.coverModeCustom}
                                </>
                              )}
                              <input 
                                ref={customCoverInputRef}
                                type="file" 
                                accept="image/*" 
                                className="hidden" 
                                onChange={handleCustomCoverUpload}
                              />
                            </button>
                          </div>
                          
                          {coverMode === "custom" && customCoverBase64 && (
                            <div className="flex flex-col gap-2 mt-1">
                              <div className="flex flex-wrap justify-between items-center bg-slate-50 border border-slate-200 rounded-xl p-3">
                                 <div className="text-xs text-slate-500 font-medium">{t.coverProcessTitle}</div>
                                 <div className="flex gap-4 items-center">
                                    <label className="flex items-center gap-1.5 cursor-pointer">
                                      <input 
                                        type="radio" 
                                        checked={customCoverWithTitle} 
                                        onChange={() => setCustomCoverWithTitle(true)} 
                                        className="w-3.5 h-3.5 text-slate-900 border-slate-300 focus:ring-slate-900" 
                                      />
                                      <span className="text-xs font-medium text-slate-700">{t.coverTitleTypeset}</span>
                                    </label>
                                    <label className="flex items-center gap-1.5 cursor-pointer">
                                      <input 
                                        type="radio" 
                                        checked={!customCoverWithTitle} 
                                        onChange={() => setCustomCoverWithTitle(false)} 
                                        className="w-3.5 h-3.5 text-slate-900 border-slate-300 focus:ring-slate-900" 
                                      />
                                      <span className="text-xs font-medium text-slate-700">{t.coverTitleClean}</span>
                                    </label>
                                    <div className="w-px h-3 bg-slate-300 mx-1"></div>
                                    <button 
                                      onClick={(e) => { e.preventDefault(); customCoverInputRef.current?.click(); }} 
                                      className="text-xs text-orange-500 hover:text-orange-600 font-semibold"
                                    >
                                      {t.coverReupload}
                                    </button>
                                 </div>
                              </div>
                            </div>
                          )}
                        </div>

                        <button 
                          onClick={handleUpload}
                            disabled={!!error}
                            className={`relative overflow-hidden w-full py-4 rounded-xl font-semibold flex items-center justify-center gap-2 group shadow-lg transition-all ${
                              error 
                                ? "bg-slate-200 text-slate-400 cursor-not-allowed shadow-none" 
                                : "bg-slate-900 text-white hover:bg-slate-800 shadow-slate-200"
                            }`}
                          >
                            {!error && (
                              <div className="absolute inset-0 pointer-events-none">
                                {BTN_PARTICLES.map((p) => (
                                  <motion.div
                                    key={p.id}
                                    className="absolute rounded-full bg-white/30"
                                    style={{
                                      width: p.size,
                                      height: p.size,
                                      left: `${p.left}%`,
                                      top: `${p.top}%`,
                                    }}
                                    animate={{
                                      opacity: [0, 0.8, 0],
                                      scale: [0.5, 1.5, 0.5],
                                      y: [0, p.yOffset],
                                      x: [0, p.xOffset]
                                    }}
                                    transition={{
                                      duration: 6,
                                      repeat: Infinity,
                                      ease: "easeInOut",
                                      delay: p.delay,
                                    }}
                                  />
                                ))}
                              </div>
                            )}
                            <span className="relative z-10">
                              {error ? t.btnError : (status === "idle" ? (file.size > 4.5 * 1024 * 1024 ? t.btnStartBatch : t.btnStart) : t.btnConverting)}
                            </span>
                            {!error && <Download size={18} className="relative z-10 group-hover:translate-y-0.5 transition-transform" />}
                          </button>
                        </div>
                      </>
                    )}
                  </motion.div>
                )}

                {(status === "converting" || status === "uploading" || status === "generating_cover") && (() => {
                  const progressPct = batchProgress.total > 0
                    ? Math.min(100, Math.max(0, Math.round((batchProgress.current / batchProgress.total) * 100)))
                    : 0;

                  return (
                    <motion.div
                      key="processing"
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      className="flex flex-col items-center py-10 w-full"
                    >
                      <div className="relative mb-6">
                        <div className="w-20 h-20 rounded-full border-4 border-orange-100 animate-pulse" />
                        {status === "generating_cover" ? (
                          <Sparkles className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-orange-500 animate-pulse" size={36} />
                        ) : (
                          <Loader2 className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-orange-600 animate-spin" size={36} />
                        )}
                      </div>

                      <h3 className="text-xl font-bold text-slate-900 mb-1.5 text-center">
                          {status === "generating_cover" ? t.drawingCover : 
                           (batchProgress.total > 0 ? (
                             (file?.name.toLowerCase().endsWith(".pdf") || file?.type === "application/pdf")
                               ? (pdfProgressMsg || (lang === "zh" ? `正在解析与重排 PDF (${batchProgress.current}/${batchProgress.total} 页)...` : `Reflowing PDF (Page ${batchProgress.current}/${batchProgress.total})...`))
                               : (lang === "zh" ? `正在转换 (分卷 ${batchProgress.current}/${batchProgress.total})...` : `Converting (Volume ${batchProgress.current}/${batchProgress.total})...`)
                           ) : 
                            batchProgress.total === -1 ? t.preparing :
                            batchProgress.total === -2 ? (pdfProgressMsg || t.convertingPdf) : t.btnConverting)}
                      </h3>

                      <p className="text-slate-500 text-center max-w-sm text-sm">
                        {status === "generating_cover" 
                          ? t.preparingCover
                          : (batchProgress.total > 0 ? (
                              (file?.name.toLowerCase().endsWith(".pdf") || file?.type === "application/pdf")
                                ? (pdfProgressMsg || t.convertingPdf)
                                : t.convertingVolume
                            ) : 
                             batchProgress.total === -1 ? t.parsingLarge :
                             batchProgress.total === -2 ? (pdfProgressMsg || t.convertingPdf) : t.convertingStandard)}
                      </p>

                      {/* Smooth Animated Progress Bar */}
                      {batchProgress.total > 0 && (
                        <motion.div 
                          initial={{ opacity: 0, scale: 0.96 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ duration: 0.25 }}
                          className="w-full max-w-md mt-6 bg-slate-50/80 border border-slate-200/80 rounded-2xl p-4 shadow-sm"
                        >
                          <div className="flex items-center justify-between text-xs font-semibold mb-2">
                            <span className="text-slate-700 flex items-center gap-1.5">
                              <span className="w-2 h-2 rounded-full bg-orange-500 animate-ping inline-block" />
                              {file?.name.toLowerCase().endsWith(".pdf") || file?.type === "application/pdf"
                                ? (lang === "zh" ? "本地解析与排版进度" : "Local Parsing Progress")
                                : (lang === "zh" ? "分卷压缩转换进度" : "Volume Generation Progress")}
                            </span>
                            <span className="tabular-nums text-orange-600 bg-orange-100/70 px-2 py-0.5 rounded-full border border-orange-200 text-xs font-mono font-bold">
                              {progressPct}%
                            </span>
                          </div>

                          {/* Progress Track */}
                          <div className="w-full h-3 bg-slate-200/70 rounded-full overflow-hidden p-0.5 border border-slate-300/40 shadow-inner">
                            <motion.div
                              className="h-full rounded-full bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 shadow-sm relative overflow-hidden"
                              initial={{ width: "0%" }}
                              animate={{ width: `${progressPct}%` }}
                              transition={{
                                type: "spring",
                                stiffness: 50,
                                damping: 14,
                                mass: 0.5
                              }}
                            >
                              <div className="absolute inset-0 bg-white/25 animate-pulse" />
                            </motion.div>
                          </div>

                          <div className="flex items-center justify-between text-[11px] text-slate-400 mt-2 px-0.5">
                            <span>
                              {file?.name.toLowerCase().endsWith(".pdf") || file?.type === "application/pdf"
                                ? (lang === "zh" ? `第 ${batchProgress.current} / ${batchProgress.total} 页` : `Page ${batchProgress.current} of ${batchProgress.total}`)
                                : (lang === "zh" ? `分卷 ${batchProgress.current} / ${batchProgress.total}` : `Part ${batchProgress.current} of ${batchProgress.total}`)}
                            </span>
                            <span className="text-slate-500 font-medium">
                              {batchProgress.current === batchProgress.total 
                                ? (lang === "zh" ? "✨ 正在打包生成 EPUB..." : "✨ Packaging EPUB...") 
                                : (lang === "zh" ? "⚡ 浏览器本地高速处理中" : "⚡ Processing locally in browser")}
                            </span>
                          </div>
                        </motion.div>
                      )}

                      {/* Indeterminate loader bar for preparing state */}
                      {(batchProgress.total === -1 || batchProgress.total === -2) && (
                        <div className="w-full max-w-sm mt-5">
                          <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden border border-slate-200/80 p-0.5 relative">
                            <motion.div
                              className="h-full w-1/3 rounded-full bg-gradient-to-r from-orange-400 to-amber-500"
                              animate={{
                                x: ["-100%", "300%"]
                              }}
                              transition={{
                                repeat: Infinity,
                                duration: 1.5,
                                ease: "easeInOut"
                              }}
                            />
                          </div>
                        </div>
                      )}
                    </motion.div>
                  );
                })()}

                {status === "success" && (
                  <motion.div
                    key="success"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0 }}
                    className="flex flex-col items-center w-full"
                  >
                    <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mb-4 border border-emerald-100/80 shadow-sm">
                      <CheckCircle size={32} />
                    </div>
                    <h3 className="text-2xl font-bold text-slate-900 mb-1">{t.successTitle}</h3>
                    <p className="text-slate-500 text-sm mb-5">{t.successSub}</p>
                    
                    {isOcrResult && (
                      <div className="mb-4 px-3.5 py-1.5 bg-amber-50 border border-amber-200/80 rounded-full text-amber-800 text-xs font-medium flex items-center gap-1.5">
                        <Sparkles size={14} className="text-amber-600" />
                        <span>{t.pdfOcrSuccessNote}</span>
                      </div>
                    )}

                    {/* File info card */}
                    <div className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 mb-5 flex items-center justify-between text-left">
                      <div className="flex items-center gap-3 min-w-0 pr-2">
                        <div className="w-10 h-10 rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center shrink-0">
                          {outputFileName.endsWith(".zip") ? <Archive size={20} /> : <BookOpen size={20} />}
                        </div>
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-slate-800 truncate" title={outputFileName}>
                            {outputFileName || (file ? `${file.name.replace(/\.(txt|pdf)$/i, "")}.epub` : "ebook.epub")}
                          </div>
                          <div className="text-xs text-slate-400 mt-0.5 flex items-center gap-2">
                            <span>{outputFileName.endsWith(".zip") ? t.fileTypeZip : t.fileTypeEpub}</span>
                            {outputBlob && (
                              <>
                                <span>•</span>
                                <span>{(outputBlob.size / 1024 < 1024 ? `${(outputBlob.size / 1024).toFixed(1)} KB` : `${(outputBlob.size / (1024 * 1024)).toFixed(2)} MB`)}</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="shrink-0">
                        <span className="inline-flex items-center px-2.5 py-1 rounded-md text-[11px] font-semibold bg-emerald-100 text-emerald-800">
                          {t.statusGenerated}
                        </span>
                      </div>
                    </div>
                    
                    <div className="flex flex-col gap-3 w-full">
                      <button 
                        onClick={() => {
                          if (downloadUrl && outputFileName) {
                            triggerDownload(downloadUrl, outputFileName);
                          }
                        }}
                        className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-4 rounded-xl font-semibold transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-200/60 cursor-pointer active:scale-[0.99]"
                      >
                        <Download size={19} />
                        <span>{outputFileName.endsWith(".zip") ? t.downloadZip : `${t.downloadLabel} EPUB`}</span>
                      </button>

                      {downloadUrl && (
                        <a 
                          href={downloadUrl} 
                          download={outputFileName || "ebook.epub"}
                          className="text-xs text-slate-400 hover:text-slate-700 transition-colors text-center py-1 underline decoration-slate-300"
                        >
                          {t.downloadBackup}
                        </a>
                      )}

                      <button 
                        onClick={reset}
                        className="w-full py-3.5 rounded-xl font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer text-sm"
                      >
                        {t.convertAnother}
                      </button>
                    </div>

                    <div className="mt-8 p-5 bg-indigo-50 rounded-2xl border border-indigo-100/50 flex gap-4 text-indigo-900 text-sm leading-relaxed">
                      <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center shrink-0">
                        <Smartphone size={18} className="text-indigo-600" />
                      </div>
                      <p>
                        {t.kindleTipPrefix}
                        {t.kindleTipLink ? (
                          <a 
                            href="https://www.amazon.com/sendtokindle" 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="font-bold underline decoration-2 underline-offset-2 hover:text-indigo-600 transition-colors ml-1"
                          >
                            {t.kindleTipLink}
                          </a>
                        ) : null}
                        {t.kindleTipSuffix}
                      </p>
                    </div>
                  </motion.div>
                )}

                {status === "error" && (
                  <motion.div
                    key="error"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="flex flex-col items-center"
                  >
                    <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mb-4">
                      <AlertCircle size={32} />
                    </div>
                    <h3 className="text-xl font-semibold mb-2">{t.errorTitle}</h3>
                    <p className="text-red-500 mb-8">{error}</p>
                    <button 
                      onClick={reset}
                      className="bg-slate-900 text-white px-8 py-3 rounded-xl font-medium hover:bg-slate-800 transition-colors"
                    >
                      {t.btnRetry}
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>

          {/* Features Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-12">
            <div className="p-6 rounded-2xl bg-white border border-slate-100 shadow-sm">
              <Smartphone className="text-orange-500 mb-3" size={24} />
              <h4 className="font-semibold mb-2">{t.feature1Title}</h4>
              <p className="text-sm text-slate-500 leading-relaxed italic">
                {t.feature1Sub}
              </p>
            </div>
            <div className="p-6 rounded-2xl bg-white border border-slate-100 shadow-sm">
              <CheckCircle className="text-indigo-500 mb-3" size={24} />
              <h4 className="font-semibold mb-2">{t.feature2Title}</h4>
              <p className="text-sm text-slate-500 leading-relaxed italic">
                {t.feature2Sub}
              </p>
            </div>
          </div>
        </section>
      </main>

      <footer className="w-full max-w-[94vw] 2xl:max-w-[2000px] mx-auto px-6 lg:px-12 py-12 border-t border-slate-200 mt-20 flex flex-col items-center gap-6">
        {/* Visitor & Usage Stats Counter */}
        <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-6 text-xs text-slate-600 bg-white/80 backdrop-blur border border-slate-200/90 shadow-xs px-5 py-2.5 rounded-2xl">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span className="font-semibold text-slate-700">{t.statsLiveBadge}</span>
          </div>

          <span className="text-slate-200 hidden sm:inline">|</span>

          <div className="flex items-center gap-1.5" title={t.statsTotalViews}>
            <Eye size={14} className="text-slate-400" />
            <span>{t.statsTotalViews}:</span>
            <span className="font-bold text-slate-800 tabular-nums">
              {(stats.pageViews || 1).toLocaleString()}
            </span>
          </div>

          <span className="text-slate-200 hidden sm:inline">|</span>

          <div className="flex items-center gap-1.5" title={t.statsUniqueVisitors}>
            <Users size={14} className="text-slate-400" />
            <span>{t.statsUniqueVisitors}:</span>
            <span className="font-bold text-slate-800 tabular-nums">
              {(stats.uniqueVisitors || 1).toLocaleString()}
            </span>
          </div>

          {stats.totalConversions > 0 && (
            <>
              <span className="text-slate-200 hidden sm:inline">|</span>
              <div className="flex items-center gap-1.5" title={t.statsTotalConversions}>
                <BookMarked size={14} className="text-amber-500" />
                <span>{t.statsTotalConversions}:</span>
                <span className="font-bold text-amber-600 tabular-nums">
                  {stats.totalConversions.toLocaleString()}
                </span>
              </div>
            </>
          )}
        </div>

        <p className="text-sm text-slate-400 text-center max-w-2xl">
          {t.footer}
        </p>
      </footer>
    </div>
  );
}
