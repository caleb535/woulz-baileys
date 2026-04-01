/**
 * CRM webhook message shapes. `timestamp` is Unix epoch **seconds** as a JSON **number**
 * (use `new Date(ts * 1000)` when you need milliseconds for `Date`).
 */
export interface WebhookMessageText {
  type: "text";
  text: { body: string };
  from: string;
  id: string;
  timestamp: number;
  fromMe: boolean;
}

export interface WebhookMessageImage {
  type: "image";
  image: { mime_type: string; sha256?: string; base64: string; caption?: string };
  from: string;
  id: string;
  timestamp: number;
  fromMe: boolean;
}

export interface WebhookMessageVideo {
  type: "video";
  video: { mime_type: string; sha256?: string; base64: string; caption?: string };
  from: string;
  id: string;
  timestamp: number;
  fromMe: boolean;
}

export interface WebhookMessageDocument {
  type: "document";
  document: { mime_type: string; sha256?: string; base64: string; file_name?: string };
  from: string;
  id: string;
  timestamp: number;
  fromMe: boolean;
}

export interface WebhookMessageAudio {
  type: "audio";
  audio: { mime_type: string; sha256?: string; base64: string; voice: boolean; duration: string };
  from: string;
  id: string;
  timestamp: number;
  fromMe: boolean;
}

export interface WebhookMessageSticker {
  type: "sticker";
  sticker: { mime_type: string; sha256?: string; base64: string };
  from: string;
  id: string;
  timestamp: number;
  fromMe: boolean;
}

/** Meta Cloud API shape plus `fromMe` (same as other outbound message types). */
export interface WebhookMessageReaction {
  type: "reaction";
  from: string;
  id: string;
  /** Unix epoch seconds (number, consistent with other outbound message types) */
  timestamp: number;
  fromMe: boolean;
  reaction: {
    message_id: string;
    /** Omitted when the user removes their reaction */
    emoji?: string;
  };
}

export type WebhookMessage =
  | (WebhookMessageText & { context: { id: string } })
  | (WebhookMessageImage & { context: { id: string } })
  | (WebhookMessageVideo & { context: { id: string } })
  | (WebhookMessageDocument & { context: { id: string } })
  | (WebhookMessageAudio & { context: { id: string } })
  | (WebhookMessageSticker & { context: { id: string } })
  | WebhookMessageReaction;

export interface WebhookChangeValue {
  messaging_product: "whatsapp";
  metadata: {
    display_phone_number: string;
    phone_number_id: string;
  };
  contacts: Array<{
    profile: { name: string; ppUrl?: string };
    wa_id: string;
    pn: string | null;
  }>;
  messages: WebhookMessage[];
}

export interface WebhookChange {
  value: WebhookChangeValue;
  field: "messages";
}

export interface WebhookEntry {
  id: string;
  changes: [WebhookChange];
}

export interface WebhookPayload {
  object: "whatsapp_business_account";
  entry: [WebhookEntry];
}
