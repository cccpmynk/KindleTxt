import express from "express";
import cors from "cors";
import { createClient } from "@libsql/client";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// Turso client initialization
const turso = createClient({
  url: process.env.TURSO_DB_URL || "file:local.db",
  authToken: process.env.TURSO_DB_AUTH_TOKEN,
});

app.post("/api/feedback", async (req, res) => {
  try {
    const { content } = req.body;
    if (!content || typeof content !== "string") {
      return res.status(400).json({ error: "留言内容不能为空" });
    }
    
    if (content.length > 300) {
      return res.status(400).json({ error: "留言字数不能超过300字" });
    }

    // Initialize database in serverless context if needed
    // (In Vercel, we can't easily run a one-time init script reliably outside the handler logic if it's purely serverless)
    // Actually, SQL CREATE TABLE IF NOT EXISTS is safe to run inside or handled via migrations.
    // For simplicity in this context, we check/init if it's the first run or just rely on it existing.
    
    await turso.execute(`
      CREATE TABLE IF NOT EXISTS feedback (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        content TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

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

export default app;
