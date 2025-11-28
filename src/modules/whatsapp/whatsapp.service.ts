import { Injectable, BadRequestException, NotFoundException } from "@nestjs/common";
import { SessionService } from "../session/session.service";
import ffmpeg from "fluent-ffmpeg";
import * as ffmpegInstaller from "@ffmpeg-installer/ffmpeg";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import axios from "axios";

@Injectable()
export class WhatsappService {
  constructor(private readonly sessionService: SessionService) {
    // Configurar o caminho do ffmpeg
    ffmpeg.setFfmpegPath(ffmpegInstaller.path);
  }

  private async getAudioDuration(audioPath: string): Promise<number> {
    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(audioPath, (err, metadata) => {
        if (err) {
          reject(err);
          return;
        }
        const duration = metadata.format.duration || 0;
        resolve(Math.ceil(duration));
      });
    });
  }

  private async convertAudioToOgg(
    inputPath: string,
    outputPath: string
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .audioCodec("libopus")
        .format("ogg")
        .on("end", () => resolve())
        .on("error", (err: Error) => reject(err))
        .save(outputPath);
    });
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
    const tempOutputPath = path.join(
      tempDir,
      `audio_output_${Date.now()}.ogg`
    );

    try {
      // Baixar o arquivo original
      await this.downloadFile(audioUrl, tempInputPath);

      // Obter a duração
      const duration = await this.getAudioDuration(tempInputPath);

      // Converter para OGG/Opus
      await this.convertAudioToOgg(tempInputPath, tempOutputPath);

      // Limpar arquivo original temporário
      if (fs.existsSync(tempInputPath)) {
        fs.unlinkSync(tempInputPath);
      }

      return { duration, convertedPath: tempOutputPath };
    } catch (error) {
      // Limpar arquivos em caso de erro
      if (fs.existsSync(tempInputPath)) {
        fs.unlinkSync(tempInputPath);
      }
      if (fs.existsSync(tempOutputPath)) {
        fs.unlinkSync(tempOutputPath);
      }
      throw error;
    }
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
          
          fields.duration = duration;
          fields.mimetype = "audio/ogg; codecs=opus";

          // Ler o arquivo convertido como buffer
          const audioBuffer = fs.readFileSync(convertedPath);

          const messageBody = {
            audio: audioBuffer,
            mimetype: "audio/ogg; codecs=opus",
            ptt: true,
            seconds: duration,
          };

          // Limpar arquivo convertido após ler
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

      sentMessage = await sock.sendMessage(fields.to, {
        text: fields.text.body,
      });
      this.sessionService.updateLastSentMessageTimestamp(id, Date.now() / 1000);

      return { messages: [{ id: sentMessage?.key.id }] };
    } catch (error: any) {
      console.error(error);
      throw new Error(`Failed to send message: ${error.message}`);
    }
  }
}
