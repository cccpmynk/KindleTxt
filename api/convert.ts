import express from "express";
import multer from "multer";
import cors from "cors";
import epubGenerator from "epub-gen-memory";

const app = express();
app.use(cors());
app.use(express.json());

const storage = multer.memoryStorage();
const upload = multer({ 
  storage: storage,
  // 提醒：Vercel 免费版 Body Size 限制为 4.5MB
  limits: { fileSize: 10 * 1024 * 1024 } 
});

// 处理 Vercel 路由：匹配 /api/convert
app.post("/api/convert", upload.single("file"), async (req: any, res: any) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "没有上传文件" });
    }

    // 默认使用 utf-8，如果需要处理 GBK 可以在这里扩展
    const fileContent = req.file.buffer.toString("utf-8");
    const fileName = req.file.originalname.replace(".txt", "");
    
    // 增强版章节识别正则
    const chapterRegex = /\n\s*(第[一二三四五六七八九十百千万\d]+[章节回]|[Cc]hapter\s+\d+).*/g;
    
    let chapters: { title: string; content: string }[] = [];
    const splitContent = fileContent.split(chapterRegex);
    const matches = fileContent.match(chapterRegex);

    if (!matches || matches.length === 0) {
      chapters = [{
        title: "正文",
        content: fileContent.split("\n").map(line => `<p>${line.trim()}</p>`).join("")
      }];
    } else {
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
    // 对文件名进行二次编码确保下载时不乱码
    const safeFileName = encodeURIComponent(fileName) + ".epub";
    res.setHeader("Content-Disposition", `attachment; filename="${safeFileName}"; filename*=UTF-8''${safeFileName}`);
    res.send(epubBuffer);
  } catch (error) {
    console.error("Vercel API Error:", error);
    res.status(500).json({ error: "转换失败，Vercel 免费版限制上传可能不能超过 4.5MB。" });
  }
});

export default app;
