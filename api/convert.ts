import express from "express";
import multer from "multer";
import cors from "cors";
import epubGenerator from "epub-gen-memory";
import iconv from "iconv-lite";
import jschardet from "jschardet";

// Fix for epub-gen-memory in ESM
const generateEpub = (options: any, chapters: any) => {
  if (typeof epubGenerator === "function") {
    return epubGenerator(options, chapters);
  } else if (epubGenerator && typeof (epubGenerator as any).default === "function") {
    return (epubGenerator as any).default(options, chapters);
  }
  throw new Error("Could not find epub-gen-memory generator function");
};

const app = express();
app.use(cors());
app.use(express.json());

const storage = multer.memoryStorage();
const upload = multer({ 
  storage: storage,
  // Note: Vercel free tier body limit is around 4.5MB
  limits: { fileSize: 10 * 1024 * 1024 } 
});

app.post("/api/convert", upload.single("file"), async (req: any, res: any) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "没有上传文件" });
    }

    // Detection of encoding
    const buffer = req.file.buffer;
    const detected = jschardet.detect(buffer);
    let encoding = detected.encoding || "utf-8";
    if (encoding.toLowerCase() === "ascii") encoding = "utf-8";
    
    let fileContent = "";
    try {
      fileContent = iconv.decode(buffer, encoding);
    } catch (e) {
      fileContent = buffer.toString("utf-8");
    }

    const fileName = req.file.originalname.replace(/\.txt$/i, "");
    
    // Better chapter detection logic using capturing groups
    const chapterRegex = /((?:^|\n)\s*(?:第[一二三四五六七八九十百千万\d]+[章节回]|[Cc]hapter\s+\d+).*)/g;
    
    const parts = fileContent.split(chapterRegex);
    let chapters: { title: string; content: string }[] = [];

    const formatToHtml = (text: string) => {
      if (!text) return "";
      return text.split(/\r?\n/)
        .map(line => line.trim())
        .map(line => line ? `<p>${line}</p>` : "<p><br/></p>")
        .join("");
    };

    if (parts[0] && parts[0].trim()) {
      chapters.push({
        title: "前言",
        content: formatToHtml(parts[0])
      });
    }

    for (let i = 1; i < parts.length; i += 2) {
      const title = parts[i].trim();
      const content = parts[i + 1] || "";
      chapters.push({
        title,
        content: formatToHtml(content) || "<p>本章无内容</p>"
      });
    }

    if (chapters.length === 0) {
      chapters.push({ title: "正文", content: formatToHtml(fileContent) });
    }

    const option = {
      title: fileName,
      author: "KindleTxt Converter",
      publisher: "KindleTxt"
    };

    const epubChapters = chapters.map(ch => ({
      title: ch.title,
      content: ch.content
    }));

    const epubBuffer = await generateEpub(option, epubChapters);
    
    res.setHeader("Content-Type", "application/epub+zip");
    const safeName = encodeURIComponent(fileName) + ".epub";
    res.setHeader("Content-Disposition", `attachment; filename="${safeName}"; filename*=UTF-8''${safeName}`);
    res.send(epubBuffer);
  } catch (error) {
    console.error("Vercel API Error:", error);
    res.status(500).json({ error: "转换失败，Vercel 可能由于文件过大或超时而中断。" });
  }
});

export default app;
