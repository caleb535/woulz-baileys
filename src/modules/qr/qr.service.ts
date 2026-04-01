import { Injectable, InternalServerErrorException, Logger } from "@nestjs/common";
import { SessionService } from "../session/session.service";
import { Jimp } from "jimp";
import jsQR from "jsqr";
import * as QRCode from "qrcode";
import * as qrcodeTerminal from "qrcode-terminal";

@Injectable()
export class QrService {
  constructor(private readonly sessionService: SessionService) {}
  private readonly logger = new Logger(QrService.name);

  async getQr(id: string) {
    this.logger.debug(`Getting QR code for session ${id}`);
    const qr = this.sessionService.sessionQRCodes.get(id);
    if (!qr) {
      this.logger.error(`QR code not found for session ${id}`);
      throw new InternalServerErrorException("Failed to get QR code");
    }
    return { qr };
  }

  async getQrImage(id: string) {
    const qr = this.sessionService.sessionQRCodes.get(id);
    if (!qr) {
      throw new InternalServerErrorException("Failed to get QR code");
    }
    try {
      const svg = await QRCode.toString(qr, { type: "svg" });
      return { qr, svg };
    } catch (err: any) {
      throw new InternalServerErrorException(`Failed to generate QR code image: ${err.message}`);
    }
  }
}
