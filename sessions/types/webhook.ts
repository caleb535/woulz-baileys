export interface WebhookMessageText {
  type: "text";
  text: { body: string };
  from: string;
  id: string;
  timestamp: string;
  fromMe: boolean;
}

export interface WebhookMessageImage {
  type: "image";
  image: { mime_type: string; sha256?: string; base64: string; caption?: string };
  from: string;
  id: string;
  timestamp: string;
  fromMe: boolean;
}

export interface WebhookMessageVideo {
  type: "video";
  video: { mime_type: string; sha256?: string; base64: string; caption?: string };
  from: string;
  id: string;
  timestamp: string;
  fromMe: boolean;
}

export interface WebhookMessageDocument {
  type: "document";
  document: { mime_type: string; sha256?: string; base64: string; file_name?: string };
  from: string;
  id: string;
  timestamp: string;
  fromMe: boolean;
}

export interface WebhookMessageAudio {
  type: "audio";
  audio: { mime_type: string; sha256?: string; base64: string; voice: boolean; duration: string };
  from: string;
  id: string;
  timestamp: string;
  fromMe: boolean;
}

export type WebhookMessage =
  | WebhookMessageText & { context: { id: string } }
  | WebhookMessageImage & { context: { id: string } }
  | WebhookMessageVideo & { context: { id: string } }
  | WebhookMessageDocument & { context: { id: string } }
  | WebhookMessageAudio & { context: { id: string } };

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
  messages: [WebhookMessage];
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
