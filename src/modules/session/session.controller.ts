import { Controller, Get, Post, Delete, Param, Body, Res, HttpStatus, Logger } from "@nestjs/common";
import { SessionService } from "./session.service";
import { Response } from "express";

@Controller("api")
export class SessionController {
  constructor(private readonly sessionService: SessionService) { }
  private readonly logger = new Logger(SessionController.name);

  @Post("session/:id")
  async createSession(
    @Param("id") id: string,
    @Body() body: { webhook?: string; workspaceID?: string; canalID?: string },
    @Res() res: Response
  ) {
    if (this.sessionService.getSession(id)) {
      this.logger.debug(`Session ${id} already exists, deleting...`);
      this.sessionService.deleteSession(id);
      if (!this.sessionService.getSession(id)) {
        this.logger.debug(`Session ${id} deleted successfully`);
      }
    }
    try {
      this.sessionService.saveSessionConfig(id, body);
      this.logger.debug(`Session ${id} config saved`);
      await this.sessionService.createSession(id);
      this.sessionService.clearUser(id);
      this.logger.debug(`Session ${id} created`);
      res
        .status(HttpStatus.OK)
        .json({ message: `Session ${id} created or recovered successfully.` });
    } catch (error) {
      this.logger.error(`Failed to create session ${id}: ${error}`);
      res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ error: "Failed to create session" });
    }
  }

  @Get("session/status/:id")
  async getSessionStatus(@Param("id") id: string, @Res() res: Response) {
    const sock = this.sessionService.getSession(id);
    if (!sock) {
      return res.status(HttpStatus.NOT_FOUND).json({ error: "Session not found" });
    }

    const userImgUrl = await sock.profilePictureUrl(sock.user?.id || "");

    const response = {
      session: id,
      connected: !!sock.user,
      user: sock.user || null,
      userImgUrl: userImgUrl || null,
    };
    this.logger.debug(`Session ${id} status: ${JSON.stringify(response)}`);
    res.status(HttpStatus.OK).json(response);
  }

  @Get("sessions")
  getAllSessions(@Res() res: Response) {
    const all = this.sessionService.getAllSessions();
    res.status(HttpStatus.OK).json({ sessions: all });
  }

  @Delete("session/:id")
  deleteSession(@Param("id") id: string, @Res() res: Response) {
    const removed = this.sessionService.deleteSession(id);
    if (removed) {
      res.status(HttpStatus.OK).json({ message: `Session ${id} removed successfully.` });
    } else {
      res.status(HttpStatus.NOT_FOUND).json({ error: "Session not found." });
    }
  }
}
