import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import * as geminiServer from "./services/geminiServer";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: "10mb" }));

  // API routes FIRST
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  app.post("/api/gemini/execute", async (req, res) => {
    const { functionName, args } = req.body;
    try {
      if (typeof (geminiServer as any)[functionName] !== "function") {
        return res.status(400).json({ error: `Function ${functionName} not found` });
      }

      const result = await (geminiServer as any)[functionName](...args);

      if (functionName === "generateGeminiSpeech") {
        const base64 = Buffer.from(result).toString("base64");
        return res.json({ result: base64, isBinary: true });
      }

      res.json({ result });
    } catch (error: any) {
      console.error(`Error executing Gemini function ${functionName}:`, error);
      res.status(500).json({ error: error.message || "Internal server error" });
    }
  });

  const server = app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: { server } },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    // Express v5
    app.get('*all', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }
}

startServer();
