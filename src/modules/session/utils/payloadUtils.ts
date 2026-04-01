import type {
  WebhookMessageAudio,
  WebhookMessageDocument,
  WebhookMessageImage,
  WebhookMessageReaction,
  WebhookMessageSticker,
  WebhookMessageText,
  WebhookMessageVideo,
  WebhookPayload,
} from "../types/webhook";

/**
 * Normalizes Baileys / WhatsApp message time to Unix **seconds** (integer).
 * Raw values ≥ 1e12 are treated as milliseconds; smaller values as Unix seconds (WhatsApp default).
 */
export function normalizeMessageTimestampToUnixSeconds(messageTimestamp: unknown): number {
  if (messageTimestamp == null) return 0;
  let n: number;
  if (typeof messageTimestamp === "number") {
    n = messageTimestamp;
  } else if (
    typeof messageTimestamp === "object" &&
    messageTimestamp !== null &&
    "toNumber" in messageTimestamp &&
    typeof (messageTimestamp as { toNumber: () => number }).toNumber === "function"
  ) {
    try {
      n = (messageTimestamp as { toNumber: () => number }).toNumber();
    } catch {
      n = NaN;
    }
  } else {
    n = Number(messageTimestamp);
  }
  if (!Number.isFinite(n) || n < 0) return 0;
  return n >= 1e12 ? Math.floor(n / 1000) : Math.floor(n);
}

/** `timestamp` is Unix epoch seconds (integer). */
export function createBasePayload(
  sessionName: string,
  waId: string,
  messageId: string,
  timestamp: number | undefined,
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
                  timestamp: timestamp ?? 0,
                  type: "text",
                  text: { body: "" },
                  fromMe,
                  context: {
                    id: stanzaId || "",
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

/**
 * Meta-format reaction payload (WhatsApp Cloud API messages webhook).
 * Emoji is omitted when the user removes a reaction, matching Meta behavior.
 */
export function createReactionPayload(
  sessionName: string,
  cleanWaId: string,
  reactionMessageId: string,
  targetMessageId: string,
  timestampUnixSeconds: number,
  fromMe: boolean,
  emoji: string | undefined,
  pushName: string | undefined,
  senderPn: string | null
): WebhookPayload {
  const reactionMsg: WebhookMessageReaction = {
    type: "reaction",
    from: cleanWaId,
    id: reactionMessageId,
    timestamp: timestampUnixSeconds,
    fromMe,
    reaction: {
      message_id: targetMessageId,
      ...(emoji ? { emoji } : {}),
    },
  };

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
                    name: pushName ?? "",
                  },
                  wa_id: cleanWaId,
                  pn: senderPn,
                },
              ],
              messages: [reactionMsg],
            },
            field: "messages",
          },
        ],
      },
    ],
  };
}

export function buildTextMessage(
  body: string,
  from: string,
  id: string,
  timestamp: number,
  fromMe: boolean,
  stanzaId: string | undefined
): WebhookMessageText & { context: { id: string } } {
  return {
    type: "text",
    text: { body },
    from,
    fromMe,
    id,
    timestamp,
    context: { id: stanzaId || "" },
  };
}

export function buildImageMessage(
  mimeType: string,
  base64: string,
  sha256: string | undefined,
  caption: string | undefined,
  from: string,
  id: string,
  timestamp: number,
  fromMe: boolean,
  stanzaId: string | undefined
): WebhookMessageImage & { context: { id: string } } {
  return {
    type: "image",
    image: { mime_type: mimeType, base64, sha256, caption },
    from,
    id,
    timestamp,
    fromMe,
    context: { id: stanzaId || "" },
  };
}

export function buildVideoMessage(
  mimeType: string,
  base64: string,
  sha256: string | undefined,
  caption: string | undefined,
  from: string,
  id: string,
  timestamp: number,
  fromMe: boolean,
  stanzaId: string | undefined
): WebhookMessageVideo & { context: { id: string } } {
  return {
    type: "video",
    video: { mime_type: mimeType, base64, sha256, caption },
    from,
    id,
    timestamp,
    fromMe,
    context: { id: stanzaId || "" },
  };
}

export function buildDocumentMessage(
  mimeType: string,
  base64: string,
  sha256: string | undefined,
  fileName: string | undefined,
  from: string,
  id: string,
  timestamp: number,
  fromMe: boolean,
  stanzaId: string | undefined
): WebhookMessageDocument & { context: { id: string } } {
  return {
    type: "document",
    document: { mime_type: mimeType, base64, sha256, file_name: fileName },
    from,
    id,
    timestamp,
    fromMe,
    context: { id: stanzaId || "" },
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
  timestamp: number,
  fromMe: boolean,
  stanzaId: string | undefined
): WebhookMessageAudio & { context: { id: string } } {
  return {
    type: "audio",
    audio: { mime_type: mimeType, base64, sha256, voice, duration },
    from,
    id,
    timestamp,
    fromMe,
    context: { id: stanzaId || "" },
  };
}

export function buildStickerMessage(
  mimeType: string,
  base64: string,
  sha256: string | undefined,
  from: string,
  id: string,
  timestamp: number,
  fromMe: boolean,
  stanzaId: string | undefined
): WebhookMessageSticker & { context: { id: string } } {
  return {
    type: "sticker",
    sticker: { mime_type: mimeType, base64, sha256 },
    from,
    id,
    timestamp,
    fromMe,
    context: { id: stanzaId || "" },
  };
}
