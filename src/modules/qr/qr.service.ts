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

  /** PNG / JPEG bytes from a base64 string (with optional data URL prefix). */
  private tryDecodeImageBuffer(raw: string): Buffer | null {
    const trimmed = raw.trim();
    const base64 = trimmed.replace(/^data:image\/\w+;base64,/, "").replace(/\s/g, "");
    if (!/^[A-Za-z0-9+/]+={0,2}$/.test(base64)) {
      return null;
    }
    const buf = Buffer.from(base64, "base64");
    if (buf.length < 24) {
      return null;
    }
    const isPng = buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47;
    const isJpeg = buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
    if (!isPng && !isJpeg) {
      return null;
    }
    return buf;
  }

  /** Decode base64 QR image (Jimp → jsQR), else treat value as raw payload and print both via qrcode-terminal. */
  private async printQrToTerminal(qr: string): Promise<void> {
    const imageBuf = this.tryDecodeImageBuffer(qr);
    if (imageBuf) {
      try {
        const image = await Jimp.read(imageBuf);
        const { data, width, height } = image.bitmap;
        const rgba =
          data instanceof Uint8ClampedArray
            ? data
            : new Uint8ClampedArray(data.buffer, data.byteOffset, data.length);
        const decoded = jsQR(rgba, width, height);
        if (decoded?.data) {
          this.logger.log(`QR (session image decoded):\n`);
          qrcodeTerminal.generate(decoded.data, { small: true });
          return;
        }
        this.logger.warn("Could not read QR modules from image; printing raw base64 payload as terminal QR.");
      } catch (e) {
        this.logger.warn(
          `Failed to decode QR image (${e instanceof Error ? e.message : String(e)}); printing raw value.`,
        );
      }
    }
    this.logger.log(`QR (raw payload):\n`);
    qrcodeTerminal.generate(qr, { small: true });
  }

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
