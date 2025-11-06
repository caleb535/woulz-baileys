import type {
  WebhookMessageAudio,
  WebhookMessageDocument,
  WebhookMessageImage,
  WebhookMessageText,
  WebhookMessageVideo,
  WebhookPayload,
} from "../types/webhook.ts";

export function createBasePayload(
  sessionName: string,
  waId: string,
  messageId: string,
  timestamp: string | undefined,
  pushName: string | undefined,
  fromMe: boolean,
  ppUrl: string | undefined,
  senderPn: string | null,
  stanzaId: string | undefined
): WebhookPayload {
  return {
    object: "whatsapp_business_account",
    entry: [
      {
        id: sessionName,
        changes: [
          {
            value: {
              messaging_product: "whatsapp",
              metadata: {
                display_phone_number: sessionName,
                phone_number_id: sessionName,
              },
              contacts: [
                {
                  profile: {
                    name: pushName,
                    ppUrl,
                  },
                  wa_id: waId,
                  pn: senderPn,
                },
              ],
              messages: [
                {
                  from: waId,
                  id: messageId,
                  timestamp: timestamp || "",
                  type: "text",
                  text: { body: "" },
                  fromMe,
                  context: {
                    id: stanzaId,
                  },
                },
              ],
            },
            field: "messages",
          },
        ],
      },
    ],
  } as WebhookPayload;
}

export function buildTextMessage(
  body: string,
  from: string,
  id: string,
  timestamp: string,
  fromMe: boolean
): WebhookMessageText {
  return { type: "text", text: { body }, from, fromMe, id, timestamp };
}

export function buildImageMessage(
  mimeType: string,
  base64: string,
  sha256: string | undefined,
  caption: string | undefined,
  from: string,
  id: string,
  timestamp: string,
  fromMe: boolean
): WebhookMessageImage {
  return {
    type: "image",
    image: { mime_type: mimeType, base64, sha256, caption },
    from,
    id,
    timestamp,
    fromMe,
  };
}

export function buildVideoMessage(
  mimeType: string,
  base64: string,
  sha256: string | undefined,
  caption: string | undefined,
  from: string,
  id: string,
  timestamp: string,
  fromMe: boolean
): WebhookMessageVideo {
  return {
    type: "video",
    video: { mime_type: mimeType, base64, sha256, caption },
    from,
    id,
    timestamp,
    fromMe,
  };
}

export function buildDocumentMessage(
  mimeType: string,
  base64: string,
  sha256: string | undefined,
  fileName: string | undefined,
  from: string,
  id: string,
  timestamp: string,
  fromMe: boolean
): WebhookMessageDocument {
  return {
    type: "document",
    document: { mime_type: mimeType, base64, sha256, file_name: fileName },
    from,
    id,
    timestamp,
    fromMe,
  };
}

export function buildAudioMessage(
  mimeType: string,
  base64: string,
  sha256: string | undefined,
  voice: boolean,
  duration: string,
  from: string,
  id: string,
  timestamp: string,
  fromMe: boolean
): WebhookMessageAudio {
  return {
    type: "audio",
    audio: { mime_type: mimeType, base64, sha256, voice, duration },
    from,
    id,
    timestamp,
    fromMe,
  };
}
