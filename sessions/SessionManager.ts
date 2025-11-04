import type { WASocket } from "@whiskeysockets/baileys";
import {
  Browsers,
  fetchLatestWaWebVersion,
  makeWASocket,
  proto,
  useMultiFileAuthState,
} from "@whiskeysockets/baileys";
import axios, { AxiosError } from "axios";
import fs from "fs";
import path from "path";
import P from "pino";
import { getSessionConfig } from "./SessionConfigManager.ts";
import { handleMediaMessage } from "./handlers/mediaHandler.ts";
import { extractMessageText } from "./handlers/textHandler.ts";
import { logUnmappedMessage } from "./logger/unmappedLogger.ts";
import { createBasePayload } from "./utils/payloadUtils.ts";

const sessions: Map<string, WASocket> = new Map();
const sessionQRCodes: Map<string, string> = new Map();
const sessionsToBeDeleted: Set<string> = new Set();

export async function createSession(name: string): Promise<WASocket> {
  if (sessions.has(name)) {
    return sessions.get(name)!;
  }

  const config = getSessionConfig(name);
  const baseURL = "http://kvoip.localhost:3000/whatsapp/webhook";
  let crmEndpoint = baseURL;
  if (config) {
    if (config.workspaceID && config.canalID) {
      crmEndpoint = `${baseURL}/${config.workspaceID}/${config.canalID}`;
    } else if (config.webhook) {
      crmEndpoint = config.webhook;
    }
  }

  const { state, saveCreds } = await useMultiFileAuthState(`./sessions_data/${name}`);
  const { version } = await fetchLatestWaWebVersion({});
  const sock = makeWASocket({
    auth: state,
    version,
    browser: Browsers.windows("Google Chrome"),
    logger: P({ level: "silent" }),
    getMessage: async (_key) => undefined,
  });

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", async ({ connection, lastDisconnect, qr }) => {
    if (qr) {
      sessionQRCodes.set(name, qr);
      if (!sessionsToBeDeleted.has(name)) {
      }
    }
    if (connection === "open") {
      sessionQRCodes.delete(name);
    }
    if (connection === "close") {
      sessions.delete(name);
      const shouldRestart =
        // @ts-ignore optional chaining on unknown error shape
        lastDisconnect?.error?.output?.statusCode !== 401 ||
        (lastDisconnect?.error?.message &&
          // @ts-ignore string check on unknown error shape
          lastDisconnect.error.message.includes("restart required"));

      if (shouldRestart && !sessionsToBeDeleted.has(name)) {
        setTimeout(() => void createSession(name), 2000);
      }
    }
  });

  sock.ev.on("messages.update", async (events) => {
    events.forEach((event) => {
      const update = event.update;
      const key = event.key;
      let statusResolved = "";
      switch (update.status) {
        case 3:
          statusResolved = "delivered";
          break;
        case 4:
          statusResolved = "read";
          break;
        case 5:
          statusResolved = "played";
          break;
      }
      axios
        .post(crmEndpoint, {
          entry: [
            {
              changes: [
                {
                  statuses: [
                    {
                      id: key?.id,
                      status: statusResolved,
                      baileysRecipientId: key?.remoteJid,
                    },
                  ],
                },
              ],
            },
          ],
        })
        .then()
        .catch((e: AxiosError) =>
          console.log(`could not send ${key?.id} status update to CRM Endpoint:`, e.message)
        );
    });
  });

  sock.ev.on("messages.upsert", async ({ type, messages }) => {
    messages.forEach((message) => {
    });
    if (type == "notify") {
      for (const message of messages as proto.IWebMessageInfo[]) {
        let ppUrl = undefined;
        if (message.messageStubParameters && message.messageStubParameters[0] === "Bad MAC") {
          console.log("BAD MAC error, rejecting message");
          return;
        }
        try {
          if (!message.key.remoteJid) throw new Error();
          ppUrl = await sock.profilePictureUrl(message.key?.remoteJid);
        } catch (error) {
        }
        const text = extractMessageText(message as any);
        if (
          message.key?.remoteJid?.includes("@g.us") &&
          !message.key.remoteJid.includes("newsletter")
        ) {
          console.log(name, "ignoring group message");
        }

        const mediaHandlers = [
          { mediaType: "image", mediaKey: "imageMessage", extension: "jpg", captionKey: "caption" },
          { mediaType: "video", mediaKey: "videoMessage", extension: "mp4", captionKey: "caption" },
          {
            mediaType: "document",
            mediaKey: "documentMessage",
            extension: "pdf",
            captionKey: null,
          },
          { mediaType: "audio", mediaKey: "audioMessage", extension: "mp3", captionKey: null },
        ] as Array<{
          mediaType: string;
          mediaKey: string;
          extension: string;
          captionKey: string | null;
        }>;

        let mediaHandled = false;
        for (const handler of mediaHandlers) {
          // @ts-ignore index access into message.message dynamic shape
          if ((message as any).message && (message as any).message[handler.mediaKey]) {
            if (handler.mediaType === "document") {
              const doc = (message as any).message.documentMessage;
              const allowedMimeTypes = [
                "application/pdf",
                "application/vnd.ms-excel",
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                "text/csv",
                "text/plain",
              ];
              if (!allowedMimeTypes.includes(doc.mimetype)) continue;
              const extension = doc.fileName ? path.extname(doc.fileName).substring(1) : "pdf";
              handler.extension = extension;
            }

            if (handler.mediaType === "audio") {
              const audio = (message as any).message.audioMessage;
              handler.extension = audio.mimetype.includes("ogg") ? "ogg" : "mp3";
            }

            mediaHandled = await handleMediaMessage(
              message as any,
              sock as any,
              name,
              crmEndpoint,
              handler as any,
              ppUrl,
              (message as any).key.addressingMode === "pn"
                ? (message as any).key.remoteJid
                : ((message as any).key?.remoteJidAlt ?? null)
            );
            if (mediaHandled) break;
          }
        }

        if ((text as any) && !mediaHandled) {
          if (message.key?.remoteJid?.includes("status")) {
            return;
          }

          try {
            const waId = 'primary=' + (message as any).key.remoteJid + '&secondary=' + (message as any).key?.remoteJidAlt + '&addressingMode=' + (message as any).key.addressingMode;
            const cleanWaId = waId.replace(/:[^@]*@/g, '@');
            const senderPn =
              (message as any).key.addressingMode === "pn"
                ? (message as any).key.remoteJid
                : ((message as any).key?.remoteJidAlt ?? null);
            const payload = createBasePayload(
              name,
              cleanWaId,
              (message as any).key.id,
              (message as any).messageTimestamp?.toString(),
              message.pushName as any,
              !!message.key.fromMe,
              ppUrl,
              senderPn?.slice(0, senderPn.indexOf("@")) ?? null
            );

            (payload as any).entry[0].changes[0].value.messages[0].type = "text";
            (payload as any).entry[0].changes[0].value.messages[0].text = { body: text };

            axios
              .post(crmEndpoint, payload)
              .then(
              )
              .catch((err) => {
                if ((err as any).response) {
                  console.log(err.status, err.statusText);
                } else {
                  console.log("API Response", err.status, err.statusText);
                }
              });
          } catch (err) {
            console.log("Could not create or send payload:", err);
          }
        } else if ((message as any).key.fromMe === true) {
          console.log(
            `Sent:\n📩 Mensagem para sessão : ${name} \nMensagem Filtrada: \n Usuario: ${message.key?.remoteJid} \n Nome: ${message.pushName} \n Mensagem: ${text}`
          );
        } else if (!mediaHandled) {
          logUnmappedMessage(message as any, name);
        }
      }
    } else {
      console.log(messages);
      console.log(`🟢Mensagem(s) Já Lida(s)!`);
    }
  });

  sessions.set(name, sock);
  return sock;
}

export function getSession(name: string): WASocket | undefined {
  return sessions.get(name);
}

export function getAllSessions(): string[] {
  return Array.from(sessions.keys());
}

export { sessionQRCodes };

export function deleteSession(name: string): boolean {
  let removed = false;
  sessionsToBeDeleted.add(name);
  const sock = sessions.get(name) as any;
  if (sock && sock.ws && typeof sock.ws.close === "function") {
    try {
      sock.ws.close();
    } catch (e: any) {
      console.log("Erro ao encerrar conexão da sessão:", e.message);
    }
  }
  if (sessions.has(name)) {
    sessions.delete(name);
    removed = true;
  }
  if (sessionQRCodes.has(name)) {
    sessionQRCodes.delete(name);
  }
  const authDir = `./sessions_data/${name}`;
  if (fs.existsSync(authDir)) {
    fs.rmSync(authDir, { recursive: true, force: true });
    removed = true;
  }
  const configPath = path.join("./sessions_config", `${name}.json`);
  if (fs.existsSync(configPath)) {
    fs.unlinkSync(configPath);
    removed = true;
  }
  setTimeout(() => sessionsToBeDeleted.delete(name), 5000);
  return removed;
}
