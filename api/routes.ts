import type { AnyMediaMessageContent, WASocket } from "@whiskeysockets/baileys";
import type { Request, Response } from "express";
import express from "express";
import QRCode from "qrcode";
import {
  saveSessionConfig,
  updateLastSentMessageTimestamp,
} from "../sessions/SessionConfigManager.ts";
import {
  createSession,
  deleteSession,
  getAllSessions,
  getSession,
  sessionQRCodes,
} from "../sessions/SessionManager.ts";
import { initializeRecentlyActiveSessions } from "../sessions/utils/sessionFileUtils.ts";
const router = express.Router();

initializeRecentlyActiveSessions();

router.post("/session/:id", async (req: Request, res: Response) => {
  const id = req.params.id;
  const { webhook, workspaceID, canalID } = req.body as {
    webhook?: string;
    workspaceID?: string;
    canalID?: string;
  };
  try {
    saveSessionConfig(id, { webhook, workspaceID, canalID });
    await createSession(id);
    res.json({ message: `Session ${id} created or recovered successfully.` });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to create session" });
  }
});

router.get("/session/status/:id", (req: Request, res: Response) => {
  const id = req.params.id;
  const sock: WASocket | undefined = getSession(id);
  if (!sock) return res.status(404).json({ error: "Session not found" });

  res.json({
    session: id,
    connected: !!sock.user,
    user: sock.user || null,
  });
});

router.post("/session/:id/send", async (req: Request, res: Response) => {
  const id = req.params.id;
  const { fields } = req.body;
  console.log(fields);

  if (!fields.to) {
    return res.status(400).json({ error: 'Parameters "to" and "message" are required' });
  }

  const sock: WASocket | undefined = getSession(id);
  if (!sock) {
    return res.status(404).json({ error: "Session not found" });
  }

  let sentMessage = undefined;

  try {
    console.log(await sock.onWhatsApp(fields.to))
    if (fields.type !== "text") {
      //@ts-ignore
      sentMessage = await sock.sendMessage(fields.to, {
        [fields.type]: { url: fields[fields.type].link },
        caption: fields[fields.type].caption ? fields[fields.type].caption : null,
        ptt: true,
      } as AnyMediaMessageContent);
      updateLastSentMessageTimestamp(id, Date.now() / 1000);
      res.json({ messages: [{ id: sentMessage?.key.id }] });
      return;
    }

    sentMessage = await sock.sendMessage(fields.to, {
      text: fields.text.body,
    });
    updateLastSentMessageTimestamp(id, Date.now() / 1000);

    res.json({ messages: [{ id: sentMessage?.key.id }] });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to send message" });
  }
});

router.get("/session/:id/qr", (req: Request, res: Response) => {
  const id = req.params.id;
  const qr = sessionQRCodes.get(id);
  if (qr) {
    res.json({ qr });
  } else {
    res.status(404).json({ error: "QR code not found or already scanned" });
  }
});

router.get("/session/:id/qr-image", async (req: Request, res: Response) => {
  const id = req.params.id;
  const qr = sessionQRCodes.get(id);
  if (!qr) {
    return res.status(404).json({ error: "QR code not found or already scanned" });
  }
  try {
    const svg = await QRCode.toString(qr, { type: "svg" });
    res.json({ qr, svg });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to generate QR code image", details: err.message });
  }
});

router.get("/session/:id/qr-view", (req: Request, res: Response) => {
  const sessionId = req.params.id;
  res.render("qr-view", { sessionId });
});

router.get("/sessions", (_req: Request, res: Response) => {
  const all = getAllSessions();
  res.json({ sessions: all });
});

router.delete("/session/:id", (req: Request, res: Response) => {
  const id = req.params.id;
  const removed = deleteSession(id);
  if (removed) {
    res.json({ message: `Session ${id} removed successfully.` });
  } else {
    res.status(404).json({ error: "Session not found." });
  }
});

export default router;
