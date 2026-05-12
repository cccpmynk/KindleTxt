import React, { useState, useRef, useEffect } from "react";
import { Upload, FileText, Download, CheckCircle, AlertCircle, Loader2, BookOpen, Smartphone, Sparkles, Image as ImageIcon } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

/**
 * KindleTxt - Kindle Ebook Converter
 * A minimal, elegant tool to convert TXT files to Kindle-compatible EPUB format.
 */

type ConversionStatus = "idle" | "uploading" | "generating_cover" | "converting" | "success" | "error";

export default function App() {
  const [status, setStatus] = useState<ConversionStatus>("idle");
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
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
      setError("目前仅支持 TXT 格式文件。");
      setFile(null);
      return;
    }
    
    setFile(selectedFile);
    if (selectedFile.size > 4.5 * 1024 * 1024) {
      setError("文件太大（超过 4.5MB）。为了保证转换速度和服务器稳定性，建议拆分后上传。");
    }
    
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
      setError("文件太大（超过 4.5MB）。为了保证转换速度和服务器稳定性，建议拆分后上传。");
      return;
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
        let errorMessage = "转换失败";
        
        try {
          // 如果是 JSON 格式的错误，解析它
          const errorData = JSON.parse(errorText);
          errorMessage = errorData.error || errorMessage;
        } catch (e) {
          // 如果不是 JSON，说明可能是服务器层面的报错（如 413）
          if (response.status === 413) {
            errorMessage = "文件太大，超出了服务器处理上限 (4.5MB)";
          } else {
            errorMessage = `服务器异常 (${response.status}): ${errorText.substring(0, 50)}...`;
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
      setError(err instanceof Error ? err.message : "转换过程中发生故障");
      setStatus("error");
    }
  };

  const reset = () => {
    setFile(null);
    setStatus("idle");
    setError(null);
    setDownloadUrl(null);
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
                我知道了
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
            <button onClick={() => setShowGuide(true)} className="hover:text-slate-900 transition-colors cursor-pointer">使用指南</button>
            <button onClick={() => setShowFAQ(true)} className="hover:text-slate-900 transition-colors cursor-pointer">常见问题</button>
          </nav>
        </div>
      </header>

      {/* About Modal */}
      <Modal title="👋 关于开发" isOpen={showAbout} onClose={() => setShowAbout(false)}>
        <div className="text-center py-4">
          <p className="text-slate-600 text-lg leading-relaxed">
            本应用由 <a 
              href="https://me.onapp.xyz" 
              target="_blank" 
              rel="noopener noreferrer" 
              className="text-slate-900 font-bold underline underline-offset-4 hover:text-orange-600 transition-colors"
            >Alex孟博士</a> 开发
          </p>
          <p className="text-slate-400 mt-4 italic">
            祝您阅读愉快 ：）
          </p>
        </div>
      </Modal>

      {/* Guide Modal */}
      <Modal title="📖 使用指南" isOpen={showGuide} onClose={() => setShowGuide(false)}>
        <div className="space-y-6 text-slate-600 leading-relaxed">
          <div className="flex gap-4">
            <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center shrink-0 font-bold text-slate-900">1</div>
            <p>准备好您的 <span className="font-semibold text-slate-900">TXT</span> 文档。建议确保文件编码为 <span className="font-semibold">UTF-8</span>，以避免转换后出现乱码。</p>
          </div>
          <div className="flex gap-4">
            <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center shrink-0 font-bold text-slate-900">2</div>
            <p>在首页点击上传区域，或者直接将文件拖拽进来。</p>
          </div>
          <div className="flex gap-4">
            <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center shrink-0 font-bold text-slate-900">3</div>
            <p>点击“开始转换”。我们会自动为您识别章节（如：第一章、Chapter 1等）并生成电子书目录。</p>
          </div>
          <div className="flex gap-4">
            <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center shrink-0 font-bold text-slate-900">4</div>
            <p>下载生成的 <span className="font-semibold text-slate-900">EPUB</span> 文件。您可以通过电缆复制到 Kindle，或使用亚马逊官方的 <a href="https://www.amazon.com/sendtokindle" target="_blank" rel="noopener noreferrer" className="text-orange-600 hover:underline italic font-medium">Send to Kindle</a> 服务发送。</p>
          </div>
        </div>
      </Modal>

      {/* FAQ Modal */}
      <Modal title="❓ 常见问题" isOpen={showFAQ} onClose={() => setShowFAQ(false)}>
        <div className="space-y-8 text-slate-600 leading-relaxed">
          <div>
            <h4 className="font-bold text-slate-900 mb-2">Q: 为什么转换后是 EPUB 而不是 AZW3？</h4>
            <p>A: 亚马逊官方自2022年起已经全面支持 EPUB 格式，并且现在的 Kindle 已经停止支持通过邮件发送 MOBI。EPUB 具有更好的兼容性和排版效果，是目前最推荐的格式。</p>
          </div>
          <div>
            <h4 className="font-bold text-slate-900 mb-2">Q: Send to Kindle 如何使用？</h4>
            <p>A: 转换完成后下载 EPUB 文件，您可以通过浏览器访问亚马逊官方的 <a href="https://www.amazon.com/sendtokindle" target="_blank" rel="noopener noreferrer" className="text-orange-600 hover:underline">Send to Kindle 网页端</a>，把文件拖入即可无线推送到您的 Kindle。您也可以将文件作为附件发邮件至您的专属 Kindle 邮箱。</p>
          </div>
          <div>
            <h4 className="font-bold text-slate-900 mb-2">Q: 发现文件转换后有乱码怎么办？</h4>
            <p>A: 这是由于 TXT 文件编码不是 UTF-8 导致的。请尝试在电脑上用记事本打开 TXT，选择“另存为”，在编码处选择 <span className="font-semibold text-slate-900">UTF-8</span>，然后重新上传转换。</p>
          </div>
          <div>
            <h4 className="font-bold text-slate-900 mb-2">Q: 我的隐私安全吗？</h4>
            <p>A: 绝对安全。本工具在服务器内存中完成转换，所有数据在转换完成后立即从内存中销毁，我们不会在任何地方存储您的书稿。</p>
          </div>
          <div>
            <h4 className="font-bold text-slate-900 mb-2">Q: 章节识别不准确是怎么回事？</h4>
            <p>A: 我们通过正则匹配常见的章节标识。如果您的文档章节格式非常特殊，可能无法识别。建议确保章节名单独占一行。</p>
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
              让阅读回归纯粹
            </h1>
            <p className="text-lg text-slate-500 max-w-xl mx-auto leading-relaxed">
              将您的本地 TXT 文档轻松转换为 Kindle 支持的最佳格式 (EPUB)，
              自动章节识别，极致排版体验。
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
                        <p className="font-medium text-slate-700 mb-1">点击或拖拽 TXT 文件到此处</p>
                        <p className="text-sm text-slate-400">支持最大 4.5MB 的纯文本文件</p>
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
                              {error && <span className="ml-2 font-semibold">（超出限制）</span>}
                            </p>
                          </div>
                          <button 
                            onClick={reset}
                            className="text-sm text-slate-400 hover:text-red-500 underline underline-offset-4"
                          >
                            移除
                          </button>
                        </div>

                        {error && status === "idle" && (
                          <div className="mb-6 p-4 bg-red-50/50 rounded-2xl border border-red-100/50 flex gap-3 text-red-800 text-sm text-left">
                            <AlertCircle size={18} className="shrink-0 mt-0.5" />
                            <p>{error}</p>
                          </div>
                        )}
                        
                        <div className="flex flex-col gap-3 mb-6">
                          <label className="text-sm font-semibold text-slate-700 block text-left">选择输出格式：</label>
                          <div className="flex bg-slate-100 p-1 rounded-xl">
                            <button
                              onClick={() => setOutputFormat("epub")}
                              className={`flex-1 py-2.5 px-4 text-sm font-medium rounded-lg transition-all ${
                                outputFormat === "epub" 
                                  ? "bg-white text-slate-900 shadow-sm" 
                                  : "text-slate-500 hover:text-slate-700"
                              }`}
                            >
                              EPUB (推荐)
                            </button>
                            <button
                              onClick={() => setOutputFormat("azw3")}
                              className={`flex-1 py-2.5 px-4 text-sm font-medium rounded-lg transition-all ${
                                outputFormat === "azw3" 
                                  ? "bg-white text-slate-900 shadow-sm" 
                                  : "text-slate-500 hover:text-slate-700"
                              }`}
                            >
                              AZW3 (老款)
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
                            使用 AI 自动生成专属封面
                          </span>
                        </label>

                        <button 
                          onClick={handleUpload}
                          disabled={!!error}
                          className={`w-full py-4 rounded-xl font-semibold flex items-center justify-center gap-2 group shadow-lg transition-all ${
                            error 
                              ? "bg-slate-200 text-slate-400 cursor-not-allowed shadow-none" 
                              : "bg-slate-900 text-white hover:bg-slate-800 shadow-slate-200"
                          }`}
                        >
                          {error ? "文件超过限制" : "开始转换"}
                          {!error && <Download size={18} className="group-hover:translate-y-0.5 transition-transform" />}
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
                      {status === "generating_cover" ? "正在绘制封面..." : "正在转换..."}
                    </h3>
                    <p className="text-slate-500 text-center max-w-xs">
                      {status === "generating_cover" 
                        ? "AI 正在根据书名为您生成精美的封面配图，请稍候。" 
                        : "正在为您识别章节并重新排版，这可能需要几秒钟时间。"}
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
                    <h3 className="text-2xl font-semibold mb-2">转换完成！</h3>
                    <p className="text-slate-500 mb-8">您的电子书已准备就绪。</p>
                    
                    <div className="flex flex-col gap-3 w-full">
                      <a 
                        href={downloadUrl!} 
                        download={`${file?.name.replace(".txt", "")}.epub`}
                        className="w-full bg-green-600 text-white py-4 rounded-xl font-semibold hover:bg-green-700 transition-colors flex items-center justify-center gap-2 shadow-lg shadow-green-100"
                      >
                        立即下载 EPUB
                        <Download size={18} />
                      </a>
                      <button 
                        onClick={reset}
                        className="w-full py-4 rounded-xl font-medium text-slate-500 hover:text-slate-900 transition-colors"
                      >
                        转换另一个文件
                      </button>
                    </div>

                    <div className="mt-8 p-4 bg-amber-50 rounded-2xl border border-amber-100/50 flex gap-3 text-amber-900 text-sm italic">
                      <AlertCircle size={18} className="shrink-0" />
                      <p>
                        <strong>Kindle 提示：</strong> 使用官方的 <a href="https://www.amazon.com/sendtokindle" target="_blank" rel="noopener noreferrer" className="underline font-medium hover:text-amber-700">Send to Kindle 网页端</a>，或发送邮件到设备专属邮箱即可推送至设备，效果极佳。
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
                    <h3 className="text-xl font-semibold mb-2">出错了</h3>
                    <p className="text-red-500 mb-8">{error}</p>
                    <button 
                      onClick={reset}
                      className="bg-slate-900 text-white px-8 py-3 rounded-xl font-medium hover:bg-slate-800 transition-colors"
                    >
                      返回重试
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
              <h4 className="font-semibold mb-2">多设备适配</h4>
              <p className="text-sm text-slate-500 leading-relaxed italic">
                生成的 EPUB 完美适配 Kindle、掌阅 iReader 以及各品牌电纸书。
              </p>
            </div>
            <div className="p-6 rounded-2xl bg-white border border-slate-100 shadow-sm">
              <CheckCircle className="text-indigo-500 mb-3" size={24} />
              <h4 className="font-semibold mb-2">自动章节识别</h4>
              <p className="text-sm text-slate-500 leading-relaxed italic">
                智能算法自动识别文档中的章节标识，并生成目录索引。
              </p>
            </div>
          </div>
        </section>
      </main>

      <footer className="max-w-4xl mx-auto px-6 py-12 border-t border-slate-200 mt-20 text-center">
        <p className="text-sm text-slate-400">
          © 2026 KindleTxt. 隐私声明：所有转换在服务器内存中处理，转换后立即销毁，保护您的版权与隐私。
        </p>
      </footer>
    </div>
  );
}
