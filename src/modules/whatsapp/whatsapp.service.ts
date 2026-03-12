import { Injectable, BadRequestException, NotFoundException } from "@nestjs/common";
import { SessionService } from "../session/session.service";

@Injectable()
export class WhatsappService {
  constructor(private readonly sessionService: SessionService) { }

  async sendTypingStatus(id: string, to: string) {
    const sock = this.sessionService.getSession(id);
    if (!sock) {
      throw new NotFoundException("Session not found");
    }
    sock?.sendPresenceUpdate("available", to)
    sock?.presenceSubscribe(to)
    sock?.sendPresenceUpdate("composing", to)
    return true;
  }

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
        if (fields.type === "audio") {
          const messageBody = {
            audio: { url: fields.audio.link },
            mimetype: fields.audio.mimetype || undefined,
            ptt: fields.audio.ptt ?? true,
          };

          sentMessage = await sock.sendMessage(fields.to, messageBody as any);
        } else {
          const messageBody = {
            [fields.type]: { url: fields[fields.type].link },
            caption: fields[fields.type].caption ? fields[fields.type].caption : null,
          };

          sentMessage = await sock.sendMessage(fields.to, messageBody as any);
        }

        this.sessionService.updateLastSentMessageTimestamp(id, Date.now() / 1000);
        return { messages: [{ id: sentMessage?.key.id }] };
      }

      sentMessage = await sock.sendMessage(fields.to, {
        text: fields.text.body,
      }, fields);
      this.sessionService.updateLastSentMessageTimestamp(id, Date.now() / 1000);

      return { messages: [{ id: sentMessage?.key.id }] };
    } catch (error: any) {
      console.error(error);
      throw new Error(`Failed to send message: ${error.message}`);
    }
  }
}
