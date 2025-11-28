import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import configuration from "./config/configuration";
import { WhatsappModule } from "./modules/whatsapp/whatsapp.module";
import { SessionModule } from "./modules/session/session.module";
import { QrModule } from "./modules/qr/qr.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
    }),
    WhatsappModule,
    SessionModule,
    QrModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
