import { Injectable, BadRequestException, NotFoundException } from "@nestjs/common";
import { SessionService } from "../session/session.service";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { execFile } from "child_process";
import { promisify } from "util";
import axios from "axios";

const execFileAsync = promisify(execFile);

@Injectable()
export class WhatsappService {
  constructor(private readonly sessionService: SessionService) {}

  private async getAudioDuration(audioPath: string): Promise<number> {
    const { stdout } = await execFileAsync("ffprobe", [
      "-v",
      "error",
      "-show_entries",
      "format=duration",
      "-of",
      "default=noprint_wrappers=1:nokey=1",
      audioPath,
    ]);
    const duration = parseFloat(stdout.trim()) || 0;
    return Math.ceil(duration);
  }

  private async convertAudioToMp3(inputPath: string, outputPath: string): Promise<void> {
    await execFileAsync("ffmpeg", [
      "-i",
      inputPath,
      "-vn",
      "-ab",
      "128k",
      "-ar",
      "44100",
      "-f",
      "ipod",
      "-y",
      outputPath,
    ]);
  }

  private async downloadFile(url: string, outputPath: string): Promise<void> {
    const response = await axios({
      url,
      method: "GET",
      responseType: "stream",
    });

    const writer = fs.createWriteStream(outputPath);
    response.data.pipe(writer);

    return new Promise((resolve, reject) => {
      writer.on("finish", resolve);
      writer.on("error", reject);
    });
  }

  private async processAudio(audioUrl: string): Promise<{
    duration: number;
    convertedPath: string;
  }> {
    const tempDir = os.tmpdir();
    const tempInputPath = path.join(tempDir, `audio_input_${Date.now()}.tmp`);
    const tempOutputPath = path.join(tempDir, `audio_output_${Date.now()}.mp3`);

    try {
      await this.downloadFile(audioUrl, tempInputPath);

      const duration = await this.getAudioDuration(tempInputPath);

      await this.convertAudioToMp3(tempInputPath, tempOutputPath);

      if (fs.existsSync(tempInputPath)) {
        fs.unlinkSync(tempInputPath);
      }

      return { duration, convertedPath: tempOutputPath };
    } catch (error) {
      if (fs.existsSync(tempInputPath)) {
        fs.unlinkSync(tempInputPath);
      }
      if (fs.existsSync(tempOutputPath)) {
        fs.unlinkSync(tempOutputPath);
      }
      throw error;
    }
  }

  async sendTypingStatus(id: string, to: string) {
    const sock = this.sessionService.getSession(id);
    if (!sock) {
      throw new NotFoundException("Session not found");
    }
    sock?.sendPresenceUpdate("available", to);
    sock?.presenceSubscribe(to);
    sock?.sendPresenceUpdate("composing", to);
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
          const audioUrl = fields.audio.link;
          const { duration, convertedPath } = await this.processAudio(audioUrl);

          const audioBuffer = fs.readFileSync(convertedPath);

          const messageBody = {
            audio: audioBuffer,
            mimetype: "audio/mp4",
            ptt: true,
            seconds: duration,
          };

          if (fs.existsSync(convertedPath)) {
            fs.unlinkSync(convertedPath);
          }

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

      sentMessage = await sock.sendMessage(
        fields.to,
        {
          text: fields.text.body,
        },
        fields
      );
      this.sessionService.updateLastSentMessageTimestamp(id, Date.now() / 1000);

      return { messages: [{ id: sentMessage?.key.id }] };
    } catch (error: any) {
      console.error(error);
      throw new Error(`Failed to send message: ${error.message}`);
    }
  }
}
