import { Injectable, BadRequestException, NotFoundException } from "@nestjs/common";
import { SessionService } from "../session/session.service";

@Injectable()
export class WhatsappService {
  constructor(private readonly sessionService: SessionService) {}

  async sendMessage(id: string, fields: any) {
    if (!fields.to) {
      throw new BadRequestException('Parameters "to" and "message" are required');
    }

    const sock = this.sessionService.getSession(id);
    if (!sock) {
      throw new NotFoundException("Session not found");
    }

    let sentMessage;

    try {
      // Check if number is on WhatsApp
      const onWa = await sock.onWhatsApp(fields.to);
      console.log(onWa);

      if (fields.type !== "text") {
        sentMessage = await sock.sendMessage(fields.to, {
          [fields.type]: { url: fields[fields.type].link },
          caption: fields[fields.type].caption ? fields[fields.type].caption : null,
          ptt: true,
        } as any);

        this.sessionService.updateLastSentMessageTimestamp(id, Date.now() / 1000);
        return { messages: [{ id: sentMessage?.key.id }] };
      }

      sentMessage = await sock.sendMessage(fields.to, {
        text: fields.text.body,
      });
      this.sessionService.updateLastSentMessageTimestamp(id, Date.now() / 1000);

      return { messages: [{ id: sentMessage?.key.id }] };
    } catch (error: any) {
      console.error(error);
      throw new Error(`Failed to send message: ${error.message}`);
    }
  }
}
