import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import multer from "multer";
import cors from "cors";
import epubGenerator from "epub-gen-memory";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cors());
  app.use(express.json());

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

      const fileContent = req.file.buffer.toString("utf-8");
      const fileName = req.file.originalname.replace(".txt", "");
      
      // Basic chapter detection logic
      // Matches "第x章", "第x节", "第x回", "Chapter x"
      const chapterRegex = /\n\s*(第[一二三四五六七八九十百千万\d]+[章节回]|[Cc]hapter\s+\d+).*/g;
      
      let chapters: { title: string; content: string }[] = [];
      const splitContent = fileContent.split(chapterRegex);
      const matches = fileContent.match(chapterRegex);

      if (!matches || matches.length === 0) {
        // No chapters detected, treat as one big chapter
        chapters = [{
          title: "正文",
          content: fileContent.split("\n").map(line => `<p>${line.trim()}</p>`).join("")
        }];
      } else {
        // The first element might be an intro before the first chapter
        if (splitContent[0].trim()) {
          chapters.push({
            title: "前言",
            content: splitContent[0].split("\n").map(line => `<p>${line.trim()}</p>`).join("")
          });
        }

        for (let i = 0; i < matches.length; i++) {
          const title = matches[i].trim();
          const content = splitContent[i + 1] || "";
          chapters.push({
            title,
            content: content.split("\n").map(line => `<p>${line.trim()}</p>`).join("")
          });
        }
      }

      const option = {
        title: fileName,
        author: "KindleTxt Converter",
        publisher: "KindleTxt",
        content: chapters.map(ch => ({
          title: ch.title,
          data: ch.content
        }))
      };

      const epubBuffer = await epubGenerator(option, []);
      
      res.setHeader("Content-Type", "application/epub+zip");
      res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(fileName)}.epub"`);
      res.send(epubBuffer);
    } catch (error) {
      console.error("Conversion error:", error);
      res.status(500).json({ error: "转换失败，请重试。" });
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
