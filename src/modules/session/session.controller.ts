import { Controller, Get, Post, Delete, Param, Body, Res, HttpStatus } from "@nestjs/common";
import { SessionService } from "./session.service";
import { Response } from "express";

@Controller("api")
export class SessionController {
  constructor(private readonly sessionService: SessionService) {}

  @Post("session/:id")
  async createSession(
    @Param("id") id: string,
    @Body() body: { webhook?: string; workspaceID?: string; canalID?: string },
    @Res() res: Response
  ) {
    try {
      this.sessionService.saveSessionConfig(id, body);
      await this.sessionService.createSession(id);
      res
        .status(HttpStatus.OK)
        .json({ message: `Session ${id} created or recovered successfully.` });
    } catch (error) {
      console.error(error);
      res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ error: "Failed to create session" });
    }
  }

  @Get("session/status/:id")
  getSessionStatus(@Param("id") id: string, @Res() res: Response) {
    const sock = this.sessionService.getSession(id);
    if (!sock) {
      return res.status(HttpStatus.NOT_FOUND).json({ error: "Session not found" });
    }

    res.status(HttpStatus.OK).json({
      session: id,
      connected: !!sock.user,
      user: sock.user || null,
    });
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
