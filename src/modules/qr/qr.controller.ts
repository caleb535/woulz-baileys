import { Controller, Get, Param, Res, HttpStatus, Render } from "@nestjs/common";
import { QrService } from "./qr.service";
import { Response } from "express";

@Controller("api")
export class QrController {
  constructor(private readonly qrService: QrService) {}

  @Get("session/:id/qr")
  getQr(@Param("id") id: string, @Res() res: Response) {
    try {
      const result = this.qrService.getQr(id);
      res.status(HttpStatus.OK).json(result);
    } catch (error: any) {
      res.status(error.status || HttpStatus.NOT_FOUND).json({ error: error.message });
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
