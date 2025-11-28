import axios from "axios";
import type { WebhookPayload } from "../types/webhook";

export async function sendWebhookPayload(endpoint: string, payload: WebhookPayload) {
  try {
    await axios.post(endpoint, payload);
  } catch (err: any) {
    if (err.response) {
      console.log(err.status, err.statusText);
    } else {
      console.log("API Response", err.status, err.statusText);
    }
  }
}
