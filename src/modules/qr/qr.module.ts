import { Module } from "@nestjs/common";
import { SessionModule } from "../session/session.module";
import { QrController } from "./qr.controller";
import { QrService } from "./qr.service";

@Module({
  imports: [SessionModule],
  controllers: [QrController],
  providers: [QrService],
})
export class QrModule {}
