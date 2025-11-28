import fs from "fs";
import type { WAMessage } from "@whiskeysockets/baileys";
import { ensureDirectoryExists } from "../utils/fsUtils";
import { createBasePayload, buildTextMessage } from "../utils/payloadUtils";

export function extractMessageText(message: WAMessage): string | null {
  const isGroup = message.key?.remoteJid?.includes("@g.us");
  if (!message.message || isGroup) return null;

  if (message.message.conversation) {
    return message.message.conversation;
  } else if (message.message.extendedTextMessage?.text) {
    return message.message.extendedTextMessage.text;
  } else if (message.message.imageMessage?.caption) {
    return message.message.imageMessage.caption;
  } else if (message.message.videoMessage?.caption) {
    return message.message.videoMessage.caption;
  }

  return null;
}

export function saveStatusText(
  getFolderAndFileName: (
    message: WAMessage,
    ext: string,
    sessionName: string
  ) => { folder: string; fullPath: string },
  message: WAMessage,
  text: string,
  sessionName: string
): string {
  const { folder, fullPath } = getFolderAndFileName(message, "txt", sessionName);
  ensureDirectoryExists(folder);
  fs.writeFileSync(fullPath, text);
  return fullPath;
}

export function buildTextPayload(sessionName: string, message: WAMessage, text: string) {
  const wa_id = (message as any).key.senderPn.split("@")[0];
  const stanzaId = message.message?.extendedTextMessage?.contextInfo?.stanzaId ?? undefined;
  const payload = createBasePayload(
    sessionName,
    wa_id,
    message.key?.id ?? "",
    message.messageTimestamp?.toString(),
    message.pushName ?? "",
    !!message.key.fromMe,
    undefined, // ppUrl
    null, // senderPn
    stanzaId
  );

  payload.entry[0].changes[0].value.messages[0] = buildTextMessage(
    text,
    wa_id,
    message.key?.id ?? "",
    message.messageTimestamp?.toString() || "",
    !!message.key.fromMe,
    stanzaId
  );
  return payload;
}
