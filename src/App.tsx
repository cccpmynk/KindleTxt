import React, { useState, useRef, useEffect } from "react";
import JSZip from "jszip";
import jschardet from "jschardet";
import { Upload, FileText, Download, CheckCircle, AlertCircle, Loader2, BookOpen, Smartphone, Sparkles, Image as ImageIcon, Info } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

/**
 * KindleTxt - Kindle Ebook Converter
 * A minimal, elegant tool to convert TXT files to Kindle-compatible EPUB format.
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
    guideStep1: "准备好您的 TXT 文档。建议确保文件编码为 UTF-8，以避免转换后出现乱码。",
    guideStep2: "在首页点击上传区域，或者直接将文件拖拽进来。",
    guideStep3: "点击“开始转换”。我们会自动为您识别章节（如：第一章、Chapter 1等）并生成电子书目录。",
    guideStep4: "下载生成的 EPUB 文件。您可以通过电缆复制到 Kindle，或使用亚马逊官方的 Send to Kindle 服务发送。",
    faqTitle: "❓ 常见问题",
    faqQ1: "为什么转换后是 EPUB 而不是 AZW3？",
    faqA1: "亚马逊官方自2022年起已经全面支持 EPUB 格式，并且现在的 Kindle 已经停止支持通过邮件发送 MOBI。EPUB 具有更好的兼容性和排版效果，是目前最推荐的格式。",
    faqQ2: "Send to Kindle 如何使用？",
    faqA2: "转换完成后下载 EPUB 文件，您可以通过浏览器访问亚马逊官方的 Send to Kindle 网页端，把文件拖入即可无线推送到您的 Kindle。您也可以将文件作为附件发邮件至您的专属 Kindle 邮箱。",
    faqQ3: "发现文件转换后有乱码怎么办？",
    faqA3: "这是由于 TXT 文件编码不是 UTF-8 导致的。请尝试在电脑上用记事本打开 TXT，选择“另存为”，在编码处选择 UTF-8，然后重新上传转换。",
    faqQ4: "我的隐私安全吗？",
    faqA4: "绝对安全。本工具在服务器内存中完成转换，所有数据在转换完成后立即从内存中销毁，我们不会在任何地方存储您的书稿。",
    faqQ5: "章节识别不准确是怎么回事？",
    faqA5: "我们通过正则匹配常见的章节标识。如果您的文档章节格式非常特殊，可能无法识别。建议确保章节名单独占一行。",
    mainTitle: "让阅读回归纯粹",
    mainSub: "将您的本地 TXT 文档轻松转换为 Kindle 支持的最佳格式 (EPUB)，自动章节识别，极致排版体验。",
    dropZone: "点击或拖拽 TXT 文件到此处",
    dropZoneSub: "支持最大 50MB 的 TXT 纯文本文件（超大文件将自动分卷）",
    remove: "移除",
    batchInfo: "该文件较大，系统将自动将其平均拆分为多个较小的分卷（约 3.5MB 每卷）进行转换，并最终打包为一个 ZIP 文件供您下载。",
    outputFormat: "选择输出格式：",
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
    successTitle: "转换完成！",
    successSub: "您的电子书已准备就绪。",
    downloadZip: "立即下载 ZIP",
    downloadLabel: "立即下载",
    convertAnother: "转换另一个文件",
    kindleTip: "Kindle 提示：使用官方的 Send to Kindle 网页端，或发送邮件到设备专属邮箱即可推送至设备，效果极佳。",
    errorTitle: "出错了",
    btnRetry: "返回重试",
    feature1Title: "多设备适配",
    feature1Sub: "生成的 EPUB 完美适配 Kindle、掌阅 iReader 以及各品牌电纸书。",
    feature2Title: "自动章节识别",
    feature2Sub: "智能算法自动识别文档中的章节标识，并生成目录索引。",
    footer: "© 2026 KindleTxt. 隐私声明：所有转换在服务器内存中处理，转换后立即销毁，保护您的版权与隐私。",
    onlyTxt: "目前仅支持 TXT 格式文件。",
    fileTooLarge: "文件过大，为了保证您的设备运行稳定，暂不支持超过 50MB 的文件。",
    serverError: "文件太大，超出了服务器处理上限 (4.5MB)",
    batchError: "分卷转换过程中发生故障",
    partFailed: "部分转换失败",
    modalClose: "我知道了"
  },
  en: {
    guide: "Guide",
    faq: "FAQ",
    about: "About",
    aboutTitle: "👋 About Project",
    aboutAuthor: "This app is developed by Dr. Alex Meng",
    aboutEnjoy: "Happy reading :)",
    guideTitle: "📖 User Guide",
    guideStep1: "Prepare your TXT document. Ensure the encoding is UTF-8 to avoid garbled characters after conversion.",
    guideStep2: "Click the upload area on the home page or directly drag and drop the file.",
    guideStep3: "Click 'Start Conversion'. We will automatically recognize chapters (e.g., Chapter 1, Section 1) and generate a Table of Contents.",
    guideStep4: "Download the generated EPUB file. You can copy it to Kindle via cable or use Amazon's official 'Send to Kindle' service.",
    faqTitle: "❓ Frequently Asked Questions",
    faqQ1: "Why EPUB instead of AZW3?",
    faqA1: "Amazon has fully supported the EPUB format since 2022, and modern Kindles no longer support sending MOBI via email. EPUB offers better compatibility and layout quality.",
    faqQ2: "How to use Send to Kindle?",
    faqA2: "After conversion, download the EPUB file. You can visit the official Send to Kindle web interface and drag the file in to push it wirelessly. You can also send the file as an email attachment to your Kindle email address.",
    faqQ3: "What if the converted file has garbled characters?",
    faqA3: "This is usually due to the TXT file not being UTF-8 encoded. Try opening it with Notepad, choosing 'Save As', selecting UTF-8 encoding, and re-uploading.",
    faqQ4: "Is my privacy secure?",
    faqA4: "Absolutely. All conversions are performed in the server's memory and destroyed immediately after. We do not store your manuscripts anywhere.",
    faqQ5: "Why is chapter recognition inaccurate?",
    faqA5: "We use regex to match common chapter patterns. If your document has unusual formatting, it might not be recognized. Ensure chapter titles are on their own lines.",
    mainTitle: "Pure Reading Experience",
    mainSub: "Effortlessly convert your local TXT documents to the best format for Kindle (EPUB), with smart chapter recognition and clean layout.",
    dropZone: "Click or drag TXT file here",
    dropZoneSub: "Supports TXT files up to 50MB (large files will be automatically split)",
    remove: "Remove",
    batchInfo: "This file is large. The system will automatically split it into smaller parts (~3.5MB each) and package them into a ZIP file for you.",
    outputFormat: "Output Format:",
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
    successTitle: "Conversion Successful!",
    successSub: "Your E-book is ready.",
    downloadZip: "Download ZIP",
    downloadLabel: "Download",
    convertAnother: "Convert another file",
    kindleTip: "Kindle Tip: Use official Send to Kindle web interface or email to push files wirelessly for the best experience.",
    errorTitle: "Something went wrong",
    btnRetry: "Back & Retry",
    feature1Title: "Multi-device Support",
    feature1Sub: "Generated EPUB files work perfectly on Kindle, iReader, and other E-ink devices.",
    feature2Title: "Smart Chapters",
    feature2Sub: "Intelligent algorithm automatically identifies chapter markers and generates a TOC.",
    footer: "© 2026 KindleTxt. Privacy: All processing happens in-memory and is wiped instantly. Your data stays private.",
    onlyTxt: "Currently only supports TXT files.",
    fileTooLarge: "File too large. To ensure stability, files over 50MB are not supported.",
    serverError: "File too large for server processing (4.5MB limit)",
    batchError: "An error occurred during batch conversion.",
    partFailed: "Part failed to convert",
    modalClose: "Got it"
  }
};

export default function App() {
  const [lang, setLang] = useState<"zh" | "en">("zh");
  const t = translations[lang];

  const [status, setStatus] = useState<ConversionStatus>("idle");
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [batchProgress, setBatchProgress] = useState({ current: 0, total: 0 });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [showGuide, setShowGuide] = useState(false);
  const [showFAQ, setShowFAQ] = useState(false);
  const [showAbout, setShowAbout] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [useAICover, setUseAICover] = useState(false);
  const [outputFormat, setOutputFormat] = useState<"epub" | "azw3">("epub");

  const processFile = (selectedFile: File) => {
    setError(null);
    if (selectedFile.type !== "text/plain" && !selectedFile.name.toLowerCase().endsWith(".txt")) {
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
      if (status !== "idle" && status !== "error") return;
      processFile(selectedFile);
    }
  };

  const handleUpload = async () => {
    if (!file) return;

    setStatus("uploading");
    setError(null);

    let generatedCoverBase64: string | null = null;
    
    if (useAICover) {
      setStatus("generating_cover");
      try {
        const bookName = file.name.replace(/\.txt$/i, "");
        const promptString = `A minimalist, elegant and beautiful book cover design for a book titled "${bookName}". Clean and modern style, centered title, professional typography.`;
        
        // 使用免费免 Key 的图片生成服务
        const coverUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(promptString)}?width=600&height=800&nologo=true`;
        
        const imageRes = await fetch(coverUrl);
        if (imageRes.ok) {
          const imageBlob = await imageRes.blob();
          const arrayBuffer = await imageBlob.arrayBuffer();
          const base64 = btoa(
            new Uint8Array(arrayBuffer)
              .reduce((data, byte) => data + String.fromCharCode(byte), '')
          );
          generatedCoverBase64 = `data:${imageBlob.type || 'image/jpeg'};base64,${base64}`;
        }
      } catch (err) {
        console.error("Failed to generate cover:", err);
      }
    }

    if (file.size > 4.5 * 1024 * 1024) {
      setStatus("converting");
      setBatchProgress({ current: 0, total: -1 });
      
      // Delay to allow UI animations to finish before synchronous blocking operations
      await new Promise(resolve => setTimeout(resolve, 500));

      try {
        const buffer = await file.arrayBuffer();
        const uint8Array = new Uint8Array(buffer);
        
        let detectedEncoding = "utf-8";
        try {
          const sampleSize = Math.min(uint8Array.length, 500000);
          const sample = uint8Array.slice(0, sampleSize);
          let str = "";
          for (let i = 0; i < sample.length; i += 4096) {
            str += String.fromCharCode.apply(null, Array.from(sample.slice(i, i + 4096)));
          }
          const detected = jschardet.detect(str);
          if (detected && detected.encoding) {
            detectedEncoding = detected.encoding.toLowerCase();
          }
        } catch (e) {
          console.warn("jschardet detection failed", e);
        }

        if (detectedEncoding === "ascii" || detectedEncoding.includes("windows-1252") || detectedEncoding.includes("windows-1251")) detectedEncoding = "utf-8";
        if (detectedEncoding.includes("gb")) detectedEncoding = "gb18030";
        if (detectedEncoding === "big5") detectedEncoding = "big5";
        
        let text = "";
        try {
          const decoder = new TextDecoder(detectedEncoding);
          text = decoder.decode(uint8Array);
        } catch (e) {
          console.warn("TextDecoder failed, using utf-8 fallback");
          const decoder = new TextDecoder("utf-8");
          text = decoder.decode(uint8Array);
        }

        const lines = text.split('\n');
        const chunks = [];
        let currentChunk = [];
        let currentSize = 0;
        const TARGET_SIZE = 3.5 * 1024 * 1024; // 3.5MB
        const textEncoder = new TextEncoder();

        for (let i = 0; i < lines.length; i++) {
          if (i % 5000 === 0) {
            await new Promise(r => setTimeout(r, 0));
          }
          const line = lines[i];
          const lineSize = textEncoder.encode(line).length + 1; // +1 for '\n'
          if (currentSize + lineSize > TARGET_SIZE && currentChunk.length > 0) {
            chunks.push(new Blob(currentChunk, { type: "text/plain" }));
            currentChunk = [];
            currentSize = 0;
          }
          currentChunk.push(line + '\n');
          currentSize += lineSize;
        }
        if (currentChunk.length > 0) {
          chunks.push(new Blob(currentChunk, { type: "text/plain" }));
        }

        const zip = new JSZip();
        for (let i = 0; i < chunks.length; i++) {
          setBatchProgress({ current: i + 1, total: chunks.length });
          const formData = new FormData();
          const chunkFile = new File([chunks[i]], `${file.name.replace(/\.txt$/i, "")}_part${i + 1}.txt`, { type: "text/plain" });
          formData.append("file", chunkFile);
          formData.append("format", outputFormat);
          if (generatedCoverBase64) {
            formData.append("coverImage", generatedCoverBase64);
          }

          const response = await fetch("/api/convert", {
            method: "POST",
            body: formData,
          });

          if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`${lang === "zh" ? "第" : "Part"} ${i + 1} ${t.partFailed}`);
          }
          const blob = await response.blob();
          zip.file(`${file.name.replace(/\.txt$/i, "")}_part${i + 1}.${outputFormat}`, blob);
        }

        const zipBlob = await zip.generateAsync({ type: "blob" });
        const url = window.URL.createObjectURL(zipBlob);
        setDownloadUrl(url);
        setStatus("success");
        setBatchProgress({ current: 0, total: 0 });
        return;
      } catch (err) {
        console.error(err);
        setError(err instanceof Error ? err.message : t.batchError);
        setStatus("error");
        setBatchProgress({ current: 0, total: 0 });
        return;
      }
    }

    setStatus("converting");
    const formData = new FormData();
    formData.append("file", file);
    formData.append("format", outputFormat);
    if (generatedCoverBase64) {
      formData.append("coverImage", generatedCoverBase64);
    }

    try {
      const response = await fetch("/api/convert", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        // 先尝试获取文本，防止 response.json() 报错
        const errorText = await response.text();
        let errorMessage = lang === "zh" ? "转换失败" : "Conversion failed";
        
        try {
          // 如果是 JSON 格式的错误，解析它
          const errorData = JSON.parse(errorText);
          errorMessage = errorData.error || errorMessage;
        } catch (e) {
          // 如果不是 JSON，说明可能是服务器层面的报错（如 413）
          if (response.status === 413) {
            errorMessage = t.serverError;
          } else {
            errorMessage = `${lang === "zh" ? "服务器异常" : "Server error"} (${response.status}): ${errorText.substring(0, 50)}...`;
          }
        }
        throw new Error(errorMessage);
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      setDownloadUrl(url);
      setStatus("success");
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : (lang === "zh" ? "转换过程中发生故障" : "An error occurred during conversion"));
      setStatus("error");
    }
  };

  const reset = () => {
    setFile(null);
    setStatus("idle");
    setError(null);
    setDownloadUrl(null);
    setBatchProgress({ current: 0, total: 0 });
    if (fileInputRef.current) fileInputRef.current.value = "";
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
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" 
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
                <button onClick={onClose} className="text-slate-400 hover:text-slate-900 transition-colors cursor-pointer">
                  <AlertCircle className="rotate-45" size={24} />
                </button>
              </div>
              <div className="max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
                {children}
              </div>
              <button 
                onClick={onClose}
                className="w-full mt-8 py-3 bg-slate-900 text-white rounded-xl font-medium hover:bg-slate-800 transition-colors"
              >
                {t.modalClose}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );

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
        <div className="max-w-4xl mx-auto px-6 h-16 flex items-center justify-between">
          <button 
            onClick={() => setShowAbout(true)} 
            className="flex items-center gap-2 hover:opacity-70 transition-opacity cursor-pointer group"
          >
            <div className="bg-slate-900 text-white p-1.5 rounded-lg group-hover:scale-110 transition-transform">
              <BookOpen size={20} />
            </div>
            <span className="font-semibold text-lg tracking-tight">KindleTxt</span>
          </button>
          <nav className="flex items-center gap-6 text-sm font-medium text-slate-500">
            <button onClick={() => setShowGuide(true)} className="hover:text-slate-900 transition-colors cursor-pointer">{t.guide}</button>
            <button onClick={() => setShowFAQ(true)} className="hover:text-slate-900 transition-colors cursor-pointer">{t.faq}</button>
            <button 
              onClick={() => setLang(lang === "zh" ? "en" : "zh")} 
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 transition-all text-slate-700 font-semibold cursor-pointer ml-2"
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
            {t.aboutAuthor}
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
        </div>
      </Modal>

      <main className="max-w-4xl mx-auto px-6 py-12 md:py-20">
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
        <section className="max-w-2xl mx-auto">
          <motion.div 
            layout
            className="bg-white border border-slate-200 rounded-3xl shadow-sm overflow-hidden"
          >
            <div className="p-8 md:p-12">
              <AnimatePresence mode="wait">
                {status === "idle" && (
                  <motion.div
                    key="idle"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="flex flex-col items-center"
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
                          accept=".txt"
                          className="hidden" 
                        />
                      </div>
                    ) : (
                      <div className="w-full">
                        <div className={`flex items-center gap-4 p-6 rounded-2xl border mb-6 transition-colors ${
                          error ? "bg-red-50 border-red-100" : "bg-slate-50 border-slate-100"
                        }`}>
                          <div className={`w-12 h-12 rounded-xl shadow-sm flex items-center justify-center transition-colors ${
                            error ? "bg-white text-red-500" : "bg-white text-slate-400"
                          }`}>
                            {error ? <AlertCircle size={20} /> : <FileText size={20} />}
                          </div>
                          <div className="flex-1 min-w-0 text-left">
                            <h3 className={`font-medium truncate ${error ? "text-red-900" : "text-slate-900"}`}>{file.name}</h3>
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

                        {error && status === "idle" && (
                          <div className="mb-6 p-4 bg-red-50/50 rounded-2xl border border-red-100/50 flex gap-3 text-red-800 text-sm text-left">
                            <AlertCircle size={18} className="shrink-0 mt-0.5" />
                            <p>{error}</p>
                          </div>
                        )}

                        {file.size > 4.5 * 1024 * 1024 && !error && status === "idle" && (
                          <div className="mb-6 p-4 bg-blue-50/50 rounded-2xl border border-blue-100/50 flex gap-3 text-blue-800 text-sm text-left">
                            <Info size={18} className="shrink-0 mt-0.5" />
                            <p>{t.batchInfo}</p>
                          </div>
                        )}
                        
                        <div className="flex flex-col gap-3 mb-6">
                          <label className="text-sm font-semibold text-slate-700 block text-left">{t.outputFormat}</label>
                          <div className="flex bg-slate-100 p-1 rounded-xl">
                            <button
                              onClick={() => setOutputFormat("epub")}
                              className={`flex-1 py-2.5 px-4 text-sm font-medium rounded-lg transition-all ${
                                outputFormat === "epub" 
                                  ? "bg-white text-slate-900 shadow-sm" 
                                  : "text-slate-500 hover:text-slate-700"
                              }`}
                            >
                              EPUB ({lang === "zh" ? "推荐" : "Recommended"})
                            </button>
                            <button
                              onClick={() => setOutputFormat("azw3")}
                              className={`flex-1 py-2.5 px-4 text-sm font-medium rounded-lg transition-all ${
                                outputFormat === "azw3" 
                                  ? "bg-white text-slate-900 shadow-sm" 
                                  : "text-slate-500 hover:text-slate-700"
                              }`}
                            >
                              AZW3 ({lang === "zh" ? "老款" : "Legacy"})
                            </button>
                          </div>
                        </div>

                        <label className="flex items-center justify-center gap-2 mb-6 cursor-pointer group">
                          <input 
                            type="checkbox" 
                            checked={useAICover} 
                            onChange={(e) => setUseAICover(e.target.checked)}
                            className="w-4 h-4 text-orange-500 rounded border-slate-300 focus:ring-orange-500"
                          />
                          <span className="text-sm font-medium text-slate-600 group-hover:text-slate-900 transition-colors flex items-center gap-1.5">
                            <ImageIcon size={16} className={useAICover ? "text-orange-500" : "text-slate-400"} />
                            {t.aiCover}
                          </span>
                        </label>

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
                    )}
                  </motion.div>
                )}

                {(status === "converting" || status === "uploading" || status === "generating_cover") && (
                  <motion.div
                    key="processing"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="flex flex-col items-center py-12"
                  >
                    <div className="relative mb-8">
                      <div className="w-24 h-24 rounded-full border-4 border-slate-100 animate-pulse" />
                      {status === "generating_cover" ? (
                        <Sparkles className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-orange-500 animate-pulse" size={40} />
                      ) : (
                        <Loader2 className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-slate-900 animate-spin" size={40} />
                      )}
                    </div>
                    <h3 className="text-xl font-semibold mb-2">
                        {status === "generating_cover" ? t.drawingCover : 
                         (batchProgress.total > 0 ? (lang === "zh" ? `正在转换 (分卷 ${batchProgress.current}/${batchProgress.total})...` : `Converting (Volume ${batchProgress.current}/${batchProgress.total})...`) : 
                          batchProgress.total === -1 ? t.preparing : t.btnConverting)}
                    </h3>
                    <p className="text-slate-500 text-center max-w-xs">
                      {status === "generating_cover" 
                        ? t.preparingCover
                        : (batchProgress.total > 0 ? t.convertingVolume : 
                           batchProgress.total === -1 ? t.parsingLarge : t.convertingStandard)}
                    </p>
                  </motion.div>
                )}

                {status === "success" && (
                  <motion.div
                    key="success"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0 }}
                    className="flex flex-col items-center"
                  >
                    <div className="w-20 h-20 bg-green-50 text-green-600 rounded-full flex items-center justify-center mb-6">
                      <CheckCircle size={36} />
                    </div>
                    <h3 className="text-2xl font-semibold mb-2">{t.successTitle}</h3>
                    <p className="text-slate-500 mb-8">{t.successSub}</p>
                    
                    <div className="flex flex-col gap-3 w-full">
                      <a 
                        href={downloadUrl!} 
                        download={file && file.size > 4.5 * 1024 * 1024 ? `${file?.name.replace(".txt", "")}_converted.zip` : `${file?.name.replace(".txt", "")}.${outputFormat}`}
                        className="w-full bg-green-600 text-white py-4 rounded-xl font-semibold hover:bg-green-700 transition-colors flex items-center justify-center gap-2 shadow-lg shadow-green-100"
                      >
                        {file && file.size > 4.5 * 1024 * 1024 ? t.downloadZip : `${t.downloadLabel} ${outputFormat.toUpperCase()}`}
                        <Download size={18} />
                      </a>
                      <button 
                        onClick={reset}
                        className="w-full py-4 rounded-xl font-medium text-slate-500 hover:text-slate-900 transition-colors"
                      >
                        {t.convertAnother}
                      </button>
                    </div>

                    <div className="mt-8 p-4 bg-amber-50 rounded-2xl border border-amber-100/50 flex gap-3 text-amber-900 text-sm italic">
                      <AlertCircle size={18} className="shrink-0" />
                      <p>
                        {t.kindleTip}
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

      <footer className="max-w-4xl mx-auto px-6 py-12 border-t border-slate-200 mt-20 text-center">
        <p className="text-sm text-slate-400">
          {t.footer}
        </p>
      </footer>
    </div>
  );
}
