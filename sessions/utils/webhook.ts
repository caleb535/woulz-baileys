import axios from "axios";

export async function sendWebhookPayload(endpoint: string, payload: unknown): Promise<void> {
  try {
    await axios.post(endpoint, payload);
  } catch (err: any) {
    console.log("Error sending payload to API:", err.message);
  }
}
