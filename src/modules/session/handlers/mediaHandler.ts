import P from "pino";
import path from "path";
import type { WASocket, WAMessage, proto } from "@whiskeysockets/baileys";
import { downloadMediaMessage } from "@whiskeysockets/baileys";
import { ensureDirectoryExists, writeFileBuffer } from "../utils/fsUtils";
import { bufferToBase64 } from "../utils/bufferUtils";
import {
  createBasePayload,
  buildImageMessage,
  buildVideoMessage,
  buildDocumentMessage,
  buildAudioMessage,
} from "../utils/payloadUtils";
import { sendWebhookPayload } from "../utils/webhook";

export type MediaConfig = {
  mediaType: "image" | "video" | "document" | "audio";
  mediaKey: keyof proto.IMessage;
  extension: string;
  captionKey: "caption" | null;
};

export function getFolderAndFileName(
  message: WAMessage,
  extension: string,
  sessionName: string
): { folder: string; fileName: string; fullPath: string } {
  const remote = message.key?.remoteJid ?? "";
  const isStatus = remote.includes("status");
  const baseFolder = "./received_files";
  const folder = isStatus ? path.join(baseFolder, "status") : baseFolder;

  let fileNameBase = message.key?.id ?? Date.now().toString();
  if (isStatus) {
    const pushName = message.pushName || "no_name";
    fileNameBase = `${sessionName}_${pushName}_${message.key?.id ?? ""}`;
  }

  return {
    folder,
    fileName: `${fileNameBase}.${extension}`,
    fullPath: path.join(folder, `${fileNameBase}.${extension}`),
  };
}

export async function downloadAndSaveMedia(
  message: WAMessage,
  sock: WASocket,
  filePath: string
): Promise<Buffer | null> {
  try {
    const buffer = (await downloadMediaMessage(
      message,
      "buffer",
      {},
      {
        logger: P({ level: "silent" }),
        reuploadRequest: sock.updateMediaMessage,
      }
    )) as Buffer;
    writeFileBuffer(filePath, buffer);
    console.log(`Arquivo salvo em: ${filePath}`);
    return buffer;
  } catch (err: any) {
    console.log("Erro ao baixar/salvar arquivo:", err.message);
    return null;
  }
}

export async function handleMediaMessage(
  message: WAMessage,
  sock: WASocket,
  sessionName: string,
  endpoint: string,
  mediaConfig: MediaConfig,
  ppUrl: string | undefined,
  senderPn: string | null
): Promise<boolean> {
  const { mediaType, mediaKey } = mediaConfig;
  const content = message.message;
  const remote =
    message.key?.addressingMode === "lid"
      ? message.key?.remoteJid
      : (message.key?.remoteJidAlt ?? "");

  if (!remote) {
    return false;
  }

  if (!content || !(mediaKey in content) || remote.includes("newsletter")) {
    return false;
  }

  // Resolve the specific media content
  const media = (content as any)[mediaKey] as
    | proto.Message["imageMessage"]
    | proto.Message["videoMessage"]
    | proto.Message["documentMessage"]
    | proto.Message["audioMessage"];

  const { folder, fullPath } = getFolderAndFileName(message, mediaConfig.extension, sessionName);

  // Adjust extension for document/audio based on metadata
  const updatedConfig: MediaConfig = { ...mediaConfig };
  if (mediaType === "document") {
    const doc = media as proto.Message["documentMessage"];
    const allowedMimeTypes = [
      "application/pdf",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "text/csv",
      "text/plain",
    ];
    if (!doc?.mimetype || !allowedMimeTypes.includes(doc.mimetype)) {
      return false;
    }
    const extension = doc.fileName ? path.extname(doc.fileName).substring(1) : "pdf";
    updatedConfig.extension = extension;
  }
  if (mediaType === "audio") {
    const audio = media as proto.Message["audioMessage"];
    updatedConfig.extension = audio?.mimetype?.includes("ogg") ? "ogg" : "mp3";
  }

  ensureDirectoryExists(folder);
  const buffer = await downloadAndSaveMedia(message, sock, fullPath);
  const base64String = bufferToBase64(buffer, (media as any)?.mimetype ?? "");

  const waId =
    "primary=" +
    (message as any).key.remoteJid +
    "&secondary=" +
    (message as any).key?.remoteJidAlt +
    "&addressingMode=" +
    (message as any).key.addressingMode;
  const cleanWaId = waId.replace(/:[^@]*@/g, "@");
  const stanzaId = message.message?.extendedTextMessage?.contextInfo?.stanzaId ?? undefined;

  const payload = createBasePayload(
    sessionName,
    cleanWaId,
    message.key?.id ?? "",
    message.messageTimestamp?.toString(),
    message.pushName ?? "",
    !!message.key?.fromMe,
    ppUrl,
    senderPn,
    stanzaId
  );

  const common = {
    from: waId,
    id: message.key?.id ?? "",
    timestamp: message.messageTimestamp?.toString() || "",
  };

  const mimetype = (media as any)?.mimetype || "";
  const sha256 = (media as any)?.fileSha256 as string | undefined;

  if (mediaType === "image") {
    const caption = (media as any)?.caption as string | undefined;
    payload.entry[0].changes[0].value.messages[0] = buildImageMessage(
      mimetype,
      base64String,
      sha256,
      caption,
      common.from,
      common.id,
      common.timestamp,
      !!message.key?.fromMe,
      stanzaId
    );
  } else if (mediaType === "video") {
    const caption = (media as any)?.caption as string | undefined;
    payload.entry[0].changes[0].value.messages[0] = buildVideoMessage(
      mimetype,
      base64String,
      sha256,
      caption,
      common.from,
      common.id,
      common.timestamp,
      !!message.key?.fromMe,
      stanzaId
    );
  } else if (mediaType === "document") {
    const fileName = (media as any)?.fileName as string | undefined;
    payload.entry[0].changes[0].value.messages[0] = buildDocumentMessage(
      mimetype,
      base64String,
      sha256,
      fileName,
      common.from,
      common.id,
      common.timestamp,
      !!message.key?.fromMe,
      stanzaId
    );
  } else if (mediaType === "audio") {
    const voice = (media as any)?.ptt || false;
    const duration = ((media as any)?.seconds ?? 0).toString();
    payload.entry[0].changes[0].value.messages[0] = buildAudioMessage(
      mimetype,
      base64String,
      sha256,
      voice,
      duration,
      common.from,
      common.id,
      common.timestamp,
      !!message.key?.fromMe,
      stanzaId
    );
  }

  await sendWebhookPayload(endpoint, payload);
  return true;
}
