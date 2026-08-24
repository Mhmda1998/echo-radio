import "dotenv/config";
import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import {
  createInteraction,
  streamInteraction,
} from "./server/lib/agentClient.ts";
import { extractJsonBlocks } from "./server/lib/jsonExtractor.ts";
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import { Storage } from "@google-cloud/storage";
import JSZip from "jszip";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Firebase Admin if not already initialized
if (getApps().length === 0) {
  try {
    const configPath = path.resolve(process.cwd(), "firebase-applet-config.json");
    if (fs.existsSync(configPath)) {
      const config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
      initializeApp({
        projectId: config.projectId,
      });
      console.log(`[Firebase Admin] Initialized with project ID: ${config.projectId}`);
    } else {
      initializeApp();
      console.log("[Firebase Admin] Initialized with default credentials");
    }
  } catch (err) {
    console.error("[Firebase Admin] Initialization failed:", err);
  }
}

let db: FirebaseFirestore.Firestore | null = null;
try {
  const configPath = path.resolve(process.cwd(), "firebase-applet-config.json");
  if (fs.existsSync(configPath)) {
    const config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
    if (config.firestoreDatabaseId) {
      db = getFirestore(config.firestoreDatabaseId);
    } else {
      db = getFirestore();
    }
  } else {
    db = getFirestore();
  }
} catch (e) {
  console.error("[Firestore] Database instantiation error:", e);
}

// Google Cloud Storage Setup
let storage: Storage | null = null;
const GCS_BUCKET_NAME = process.env.GCS_BUCKET_NAME || "";

try {
  if (GCS_BUCKET_NAME) {
    storage = new Storage();
    console.log(`[Storage] GCS initialized for bucket: ${GCS_BUCKET_NAME}`);
  }
} catch (e) {
  console.warn("[Storage] Cloud Storage not configured or failed to init:", e);
}

const DAILY_LIMIT = parseInt(process.env.DAILY_QUOTA_LIMIT || "3", 10);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: "50mb" }));

  // Helper to extract authenticated user from Firebase Auth ID token
  async function getAuthenticatedUser(req: express.Request) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return null;
    }
    const token = authHeader.split("Bearer ")[1];
    try {
      const decoded = await getAuth().verifyIdToken(token);
      return decoded;
    } catch (err) {
      return null;
    }
  }

  // Quota status check
  app.get("/api/quota", async (req, res) => {
    const user = await getAuthenticatedUser(req);
    if (!user || !user.uid) {
      return res.status(401).json({ error: "Authentication required" });
    }

    if (!db) {
      return res.json({ allowed: true, remaining: DAILY_LIMIT, used: 0, limit: DAILY_LIMIT });
    }

    try {
      const today = new Date().toISOString().split("T")[0];
      const quotaDocRef = db.collection("users").doc(user.uid).collection("usage").doc(today);
      const docSnap = await quotaDocRef.get();

      const used = docSnap.exists ? (docSnap.data()?.count || 0) : 0;
      const remaining = Math.max(0, DAILY_LIMIT - used);
      const allowed = used < DAILY_LIMIT;

      return res.json({
        allowed,
        limit: DAILY_LIMIT,
        remaining,
        used,
      });
    } catch (err: any) {
      console.error("Error checking quota:", err);
      return res.status(500).json({ error: "Failed to check quota" });
    }
  });

  // Generate show stream API
  app.post("/api/generate", async (req, res) => {
    const user = await getAuthenticatedUser(req);
    if (!user || !user.uid) {
      return res.status(401).json({ error: "Authentication required" });
    }

    if (db) {
      try {
        const today = new Date().toISOString().split("T")[0];
        const quotaDocRef = db.collection("users").doc(user.uid).collection("usage").doc(today);
        const docSnap = await quotaDocRef.get();
        const used = docSnap.exists ? (docSnap.data()?.count || 0) : 0;

        if (used >= DAILY_LIMIT) {
          return res.status(429).json({
            error: "Daily generation quota exceeded. Please try again tomorrow.",
            limit: DAILY_LIMIT,
          });
        }

        await quotaDocRef.set(
          {
            count: FieldValue.increment(1),
            lastUpdated: FieldValue.serverTimestamp(),
          },
          { merge: true }
        );
      } catch (err: any) {
        console.error("Quota enforcement error:", err);
      }
    }

    const { prompt, targetDuration, targetMood } = req.body;
    if (!prompt) {
      return res.status(400).json({ error: "Prompt is required" });
    }

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    const sendEvent = (event: string, data: any) => {
      res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    };

    try {
      const systemPrompt = `You are an AI Radio Show Producer agent. 
Create an engaging radio show on: "${prompt}".
Target duration: approx ${targetDuration || 3} minutes.
Tone/Mood: ${targetMood || "Informative and lively"}.

Produce complete JSON metadata containing show_title, show_duration, two_sentence_summary, date_of_generation, and timecoded_transcript.`;

      const response = await createInteraction({
        prompt: systemPrompt,
      });

      for await (const event of streamInteraction(response)) {
        if (event.type === "thinking") {
          sendEvent("log", { type: "thinking", content: event.text });
        } else if (event.type === "tool_call") {
          sendEvent("log", { type: "tool_call", name: event.name, args: event.arguments });
        } else if (event.type === "tool_result") {
          sendEvent("log", { type: "tool_result", name: event.name, result: event.result });
        } else if (event.type === "text") {
          sendEvent("log", { type: "text", content: event.text });
        } else if (event.type === "complete") {
          sendEvent("complete", event.interaction);
        }
      }

      res.write("event: end\ndata: {}\n\n");
      res.end();
    } catch (err: any) {
      console.error("Agent interaction failed:", err);
      sendEvent("error", { message: err.message || "Generation failed" });
      res.end();
    }
  });

  // Sharing API: Get shared show
  app.get("/api/share/:shareId", async (req, res) => {
    const { shareId } = req.params;
    if (!db) {
      return res.status(503).json({ error: "Database not available" });
    }

    try {
      const doc = await db.collection("shared_shows").doc(shareId).get();
      if (!doc.exists) {
        return res.status(404).json({ error: "Shared show not found" });
      }
      return res.json(doc.data());
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  // Sharing API: Create shared show
  app.post("/api/share", async (req, res) => {
    const user = await getAuthenticatedUser(req);
    if (!user || !user.uid) {
      return res.status(401).json({ error: "Authentication required" });
    }

    if (!db) {
      return res.status(503).json({ error: "Database not available" });
    }

    try {
      const showData = req.body;
      const shareRef = db.collection("shared_shows").doc();
      const shareId = shareRef.id;

      await shareRef.set({
        ...showData,
        shareId,
        createdBy: user.uid,
        createdAt: FieldValue.serverTimestamp(),
      });

      return res.json({ shareId });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
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
    console.log(`Radio server running on http://localhost:${PORT}`);
  });
}

startServer();
