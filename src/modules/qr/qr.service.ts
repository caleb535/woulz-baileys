import { Injectable, InternalServerErrorException, NotFoundException } from "@nestjs/common";
import { SessionService } from "../session/session.service";
import * as QRCode from "qrcode";

@Injectable()
export class QrService {
  constructor(private readonly sessionService: SessionService) {}

  getQr(id: string) {
    const qr = this.sessionService.sessionQRCodes.get(id);
    if (!qr) {
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
