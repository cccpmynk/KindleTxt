import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import multer from "multer";
import cors from "cors";
import epubGenerator from "epub-gen-memory";
import { fileURLToPath } from "url";
import iconv from "iconv-lite";
import jschardet from "jschardet";
import { createClient } from "@libsql/client";
import dotenv from "dotenv";

dotenv.config();

// Turso client initialization
const turso = createClient({
  url: process.env.TURSO_DB_URL || "file:local.db",
  authToken: process.env.TURSO_DB_AUTH_TOKEN,
});

// Initialize database
async function initDb() {
  try {
    await turso.execute(`
      CREATE TABLE IF NOT EXISTS feedback (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        content TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log("Database initialized (feedback table ready)");
  } catch (err) {
    console.error("Database initialization failed:", err);
  }
}

initDb();

// Fix for epub-gen-memory in ESM
const generateEpub = (options: any, chapters: any) => {
  if (typeof epubGenerator === "function") {
    return epubGenerator(options, chapters);
  } else if (epubGenerator && typeof (epubGenerator as any).default === "function") {
    return (epubGenerator as any).default(options, chapters);
  }
  throw new Error("Could not find epub-gen-memory generator function");
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 辅助函数：将纯文本安全转为 HTML 段落
function formatToHtml(text: string) {
  return text
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(line => line.length > 0)
    .map(line => `<p>${line}</p>`)
    .join("");
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cors());
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ limit: '10mb', extended: true }));

  // Configure multer for file uploads
  const storage = multer.memoryStorage();
  const upload = multer({ 
    storage: storage,
    limits: { fileSize: 50 * 1024 * 1024 } // 50MB limit
  });

  // API Route: Conversion
  app.post("/api/convert", upload.single("file"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "没有上传文件" });
      }

      // Detection of encoding
      const buffer = req.file.buffer;
      const detected = jschardet.detect(buffer);
      let encoding = detected.encoding || "utf-8";
      
      // Some simple normalization
      if (encoding.toLowerCase() === "ascii") encoding = "utf-8";
      
      let fileContent = "";
      try {
        fileContent = iconv.decode(buffer, encoding);
      } catch (e) {
        console.warn("Iconv decode failed, falling back to utf-8");
        fileContent = buffer.toString("utf-8");
      }

      // 修复 multer 中文文件名乱码问题：将 latin1 转换为 utf8
      const originalName = Buffer.from(req.file.originalname, 'latin1').toString('utf8');
      const fileName = originalName.replace(/\.txt$/i, "");
      
      // The user requested AZW3, but we can only generate EPUB natively here.
      // Instead of throwing an error, we will just proceed with EPUB generation
      // but the filename will remain .epub so "Send to Kindle" accepts it.
      let isAzw3Requested = req.body.format === "azw3";
      let outputFileName = isAzw3Requested ? `${fileName}_需要使用SendToKindle发送` : fileName;

      // 使用捕获组，这样 split 后的数组会包含匹配到的章节名
      // 增强正则：支持换行符、行首、以及更宽泛的章节标识
      const chapterRegex = /((?:^|\n)\s*(?:第[一二三四五六七八九十百千万\d]+[章节回]|[Cc]hapter\s+\d+).*)/g;
      
      const parts = fileContent.split(chapterRegex);
      let chapters: { title: string; content: string }[] = [];

      // parts[0] 是第一个章节匹配项之前的文字（前言）
      if (parts[0] && parts[0].trim()) {
        chapters.push({
          title: "前言",
          content: formatToHtml(parts[0])
        });
      }

      // 之后每两个元素为一组：[章节名, 该章内容]
      for (let i = 1; i < parts.length; i += 2) {
        const title = parts[i].trim();
        const content = parts[i + 1] || "";
        
        chapters.push({
          title: title,
          content: formatToHtml(content) || "<p>本章无内容</p>"
        });
      }

      // 如果完全没匹配到章节，整篇作为一章
      if (chapters.length === 0) {
        chapters.push({
          title: "开始阅读",
          content: formatToHtml(fileContent)
        });
      }

      const formDataCover = req.body.coverImage;
      const option = {
        title: outputFileName,
        author: "KindleTxt Converter",
        publisher: "KindleTxt",
        cover: formDataCover || `https://placehold.co/600x800/1e293b/FFFFFF.png?text=${encodeURIComponent(fileName)}`
      };

      const epubChapters = chapters.map(ch => ({
        title: ch.title,
        content: ch.content
      }));

      try {
        const epubBuffer = await generateEpub(option, epubChapters);
        
        res.setHeader("Content-Type", "application/epub+zip");
        const safeName = encodeURIComponent(outputFileName);
        res.setHeader("Content-Disposition", `attachment; filename="${safeName}.epub"; filename*=UTF-8''${safeName}.epub`);
        res.send(epubBuffer);
      } catch (epubErr) {
        console.error("EPUB Generation failed:", epubErr);
        throw new Error("电子书引擎转换失败: " + (epubErr instanceof Error ? epubErr.message : String(epubErr)));
      }
    } catch (error) {
      console.error("Conversion execution error:", error);
      res.status(500).json({ 
        error: error instanceof Error ? error.message : "转换失败，请确保文件格式正确且未加密。" 
      });
    }
  });

  // API Route: Feedback
  app.post("/api/feedback", async (req, res) => {
    try {
      const { content } = req.body;
      if (!content || typeof content !== "string") {
        return res.status(400).json({ error: "留言内容不能为空" });
      }
      
      if (content.length > 300) {
        return res.status(400).json({ error: "留言字数不能超过300字" });
      }

      await turso.execute({
        sql: "INSERT INTO feedback (content) VALUES (?)",
        args: [content]
      });

      res.json({ success: true });
    } catch (error) {
      console.error("Feedback submission error:", error);
      res.status(500).json({ error: "提交留言失败，请稍后重试" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
