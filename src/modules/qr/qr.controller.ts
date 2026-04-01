import {
  Controller,
  Get,
  Param,
  Res,
  HttpStatus,
  Render,
  HttpException,
} from "@nestjs/common";
import { QrService } from "./qr.service";
import { Response } from "express";

@Controller("api")
export class QrController {
  constructor(private readonly qrService: QrService) {}

  @Get("session/:id/qr")
  async getQr(@Param("id") id: string, @Res() res: Response) {
    try {
      const result = await this.qrService.getQr(id);
      res.status(HttpStatus.OK).json(result);
    } catch (error: unknown) {
      if (error instanceof HttpException) {
        const body = error.getResponse();
        const msg =
          typeof body === "string"
            ? body
            : Array.isArray((body as { message?: unknown }).message)
              ? (body as { message: string[] }).message.join(", ")
              : String((body as { message?: unknown }).message ?? error.message);
        res.status(error.getStatus()).json({ error: msg });
        return;
      }
      res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        error: error instanceof Error ? error.message : "Internal server error",
      });
    }
  }

  @Get("session/:id/qr-image")
  async getQrImage(@Param("id") id: string, @Res() res: Response) {
    try {
      const result = await this.qrService.getQrImage(id);
      res.status(HttpStatus.OK).json(result);
    } catch (error: any) {
      res.status(error.status || HttpStatus.INTERNAL_SERVER_ERROR).json({ error: error.message });
    }
  }

  @Get("session/:id/qr-view")
  @Render("qr-view")
  getQrView(@Param("id") id: string) {
    return { sessionId: id };
  }
}
