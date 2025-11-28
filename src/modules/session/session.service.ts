import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  Browsers,
  DisconnectReason,
  makeWASocket,
  proto,
  useMultiFileAuthState,
  WASocket
} from "@whiskeysockets/baileys";
import axios, { AxiosError } from "axios";
import * as fs from "fs";
import * as path from "path";
import P, { version } from "pino";
import { handleMediaMessage } from "./handlers/mediaHandler";
import { extractMessageText } from "./handlers/textHandler";
import { createBasePayload } from "./utils/payloadUtils";

// Types
export type SessionConfig = {
  webhook?: string;
  workspaceID?: string;
  canalID?: string;
  lastSentMessageTimestamp?: number;
};

@Injectable()
export class SessionService implements OnModuleInit {
  private readonly logger = new Logger(SessionService.name);
  private sessions: Map<string, WASocket> = new Map();
  public sessionQRCodes: Map<string, string> = new Map();
  private sessionsToBeDeleted: Set<string> = new Set();
  private readonly configDir = "./sessions_config";
  private readonly sessionsDir = "./sessions_data";

  constructor(private configService: ConfigService) {
    if (!fs.existsSync(this.configDir)) {
      fs.mkdirSync(this.configDir, { recursive: true });
    }
  }

  async onModuleInit() {
    this.initializeRecentlyActiveSessions();
  }

  private initializeRecentlyActiveSessions() {
    if (!fs.existsSync(this.configDir)) return;

    fs.readdirSync(this.configDir).forEach(async (filename) => {
      if (!filename.endsWith(".json")) return;
      const sessionName = filename.replace(".json", "");
      try {
        const config = this.getSessionConfig(sessionName);
        if (!config) return;

        // 1296000 seconds = 15 days
        if (
          config.lastSentMessageTimestamp &&
          Date.now() / 1000 - config.lastSentMessageTimestamp > 1296000
        ) {
          this.logger.log(
            `Deleting session ${sessionName}, as it has been inactive for over 15 days.`
          );
          this.deleteSession(sessionName);
          return;
        }
        await this.createSession(sessionName);
      } catch (error) {
        this.logger.error(`Could not start session ${sessionName}: ${error}`);
      }
    });
  }

  async createSession(name: string): Promise<WASocket> {
    if (this.sessions.has(name)) {
      return this.sessions.get(name)!;
    }

    const config = this.getSessionConfig(name);
    const callbackUrl = this.configService.get<string>("callbackUrl") || "";
    const baseURL = `${callbackUrl}/whatsapp/webhook`;
    let crmEndpoint = baseURL;
    if (config) {
      if (config.workspaceID && config.canalID) {
        crmEndpoint = `${baseURL}/${config.workspaceID}/${config.canalID}`;
      } else if (config.webhook) {
        crmEndpoint = config.webhook;
      }
    }

    const { state, saveCreds } = await useMultiFileAuthState(path.join(this.sessionsDir, name));
    console.log(version);

    const sock = makeWASocket({
      auth: state,
      browser: Browsers.windows("Google Chrome"),
      logger: P({ level: "silent" }) as any,
      getMessage: async () => undefined,
    });

    sock.ev.on("creds.update", saveCreds);

    sock.ev.on("connection.update", async ({ connection, lastDisconnect, qr }) => {
      if (qr) {
        this.sessionQRCodes.set(name, qr);
      }
      if (connection === "open") {
        this.sessionQRCodes.delete(name);
      }
      if (connection === "close") {
        this.sessions.delete(name);
        const shouldRestart =
          (lastDisconnect?.error as any)?.output?.statusCode !== DisconnectReason.loggedOut;

        if (shouldRestart && !this.sessionsToBeDeleted.has(name)) {
          setTimeout(() => void this.createSession(name), 2000);
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
        if (!statusResolved) return;

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
          .catch((e: AxiosError) =>
            this.logger.error(
              `Could not send ${key?.id} status update to CRM Endpoint: ${e.message}`
            )
          );
      });
    });

    sock.ev.on("messages.upsert", async ({ type, messages }) => {
      if (type !== "notify") {
        if (messages.length > 0) this.logger.log(`🟢 Mensagem(s) Já Lida(s)!`);
        return;
      }

      for (const message of messages as proto.IWebMessageInfo[]) {
        let ppUrl: string | undefined = undefined;
        // @ts-ignore
        if (message.messageStubParameters && message.messageStubParameters[0] === "Bad MAC") {
          this.logger.warn("BAD MAC error, rejecting message");
          return;
        }
        try {
          if (!message.key?.remoteJid) throw new Error();
          ppUrl = (await sock.profilePictureUrl(message.key.remoteJid)) || undefined;
        } catch {}

        const text = extractMessageText(message as any);
        if (
          message.key?.remoteJid?.includes("@g.us") &&
          !message.key.remoteJid.includes("newsletter")
        ) {
          this.logger.debug(`${name} ignoring group message`);
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
        ];

        let mediaHandled = false;
        for (const handler of mediaHandlers) {
          // @ts-ignore
          if ((message as any).message && (message as any).message[handler.mediaKey]) {
            const h = { ...handler };
            if (h.mediaType === "document") {
              // @ts-ignore
              const doc = (message as any).message.documentMessage;
              const allowedMimeTypes = [
                "application/pdf",
                "application/vnd.ms-excel",
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                "text/csv",
                "text/plain",
              ];
              if (!allowedMimeTypes.includes(doc.mimetype)) continue;
              h.extension = doc.fileName ? path.extname(doc.fileName).substring(1) : "pdf";
            }

            if (h.mediaType === "audio") {
              // @ts-ignore
              const audio = (message as any).message.audioMessage;
              h.extension = audio.mimetype.includes("ogg") ? "ogg" : "mp3";
            }

            mediaHandled = await handleMediaMessage(
              message as any,
              sock as any,
              name,
              crmEndpoint,
              h as any,
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
            const waId =
              "primary=" +
              (message as any).key.remoteJid +
              "&secondary=" +
              (message as any).key?.remoteJidAlt +
              "&addressingMode=" +
              (message as any).key.addressingMode;
            const cleanWaId = waId.replace(/:[^@]*@/g, "@");
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
              !!message.key?.fromMe,
              ppUrl,
              senderPn?.slice(0, senderPn.indexOf("@")) ?? null,
              message.message?.extendedTextMessage?.contextInfo?.stanzaId ?? undefined
            );

            // Modify payload for text message
            (payload as any).entry[0].changes[0].value.messages[0].type = "text";
            (payload as any).entry[0].changes[0].value.messages[0].text = { body: text };
            (payload as any).entry[0].changes[0].value.messages[0].context = {
              id: message.message?.extendedTextMessage?.contextInfo?.stanzaId ?? undefined,
            };

            axios.post(crmEndpoint, payload).catch((err) => {
              if (err.response) {
                this.logger.error(err.response)
              } else {
                this.logger.error(err)
              }
            });
          } catch (err) {
            this.logger.error(`Could not create or send payload: ${err}`);
          }
        } else if ((message as any).key.fromMe === true) {
          this.logger.log(
            `Sent:\n📩 Mensagem para sessão : ${name} \nMensagem Filtrada: \n Usuario: ${message.key?.remoteJid} \n Nome: ${message.pushName} \n Mensagem: ${text}`
          );
        } else if (!mediaHandled) {
          return;
        }
      }
    });

    this.sessions.set(name, sock);
    return sock;
  }

  getSession(name: string): WASocket | undefined {
    return this.sessions.get(name);
  }

  getAllSessions(): string[] {
    return Array.from(this.sessions.keys());
  }

  deleteSession(name: string): boolean {
    let removed = false;
    this.sessionsToBeDeleted.add(name);
    const sock = this.sessions.get(name) as any;
    if (sock && sock.ws && typeof sock.ws.close === "function") {
      try {
        sock.ws.close();
      } catch (e: any) {
        this.logger.error(`Erro ao encerrar conexão da sessão: ${e.message}`);
      }
    }
    if (this.sessions.has(name)) {
      this.sessions.delete(name);
      removed = true;
    }
    if (this.sessionQRCodes.has(name)) {
      this.sessionQRCodes.delete(name);
    }
    const authDir = path.join(this.sessionsDir, name);
    if (fs.existsSync(authDir)) {
      fs.rmSync(authDir, { recursive: true, force: true });
      removed = true;
    }
    const configPath = path.join(this.configDir, `${name}.json`);
    if (fs.existsSync(configPath)) {
      fs.unlinkSync(configPath);
      removed = true;
    }
    setTimeout(() => this.sessionsToBeDeleted.delete(name), 5000);
    return removed;
  }

  // Config methods
  saveSessionConfig(sessionName: string, config: SessionConfig): void {
    const filePath = path.join(this.configDir, `${sessionName}.json`);
    const current = fs.existsSync(filePath) ? fs.readFileSync(filePath, "utf8") : "{}";
    fs.writeFileSync(filePath, JSON.stringify({ ...JSON.parse(current), ...config }));
  }

  getSessionConfig(sessionName: string): SessionConfig | null {
    const filePath = path.join(this.configDir, `${sessionName}.json`);
    if (!fs.existsSync(filePath)) return null;
    return JSON.parse(fs.readFileSync(filePath, "utf8")) as SessionConfig;
  }

  updateLastSentMessageTimestamp(sessionName: string, lastSentMessageTimestamp: number) {
    const filePath = path.join(this.configDir, `${sessionName}.json`);
    if (fs.existsSync(filePath)) {
      const current = fs.readFileSync(filePath, "utf8");
      fs.writeFileSync(
        filePath,
        JSON.stringify({ ...JSON.parse(current), lastSentMessageTimestamp })
      );
    }
  }
}
