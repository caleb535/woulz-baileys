import { Controller, Post, Param, Body, Res, HttpStatus } from "@nestjs/common";
import { WhatsappService } from "./whatsapp.service";
import { Response } from "express";

@Controller("api")
export class WhatsappController {
  constructor(private readonly whatsappService: WhatsappService) {}

  @Post("session/:id/send")
  async sendMessage(@Param("id") id: string, @Body() body: any, @Res() res: Response) {
    try {
      const result = await this.whatsappService.sendMessage(id, body.fields);
      res.status(HttpStatus.OK).json(result);
    } catch (error: any) {
      res.status(error.status || HttpStatus.INTERNAL_SERVER_ERROR).json({ error: error.message });
    }
  }
}
