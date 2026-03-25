import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { Logger, ValidationPipe } from "@nestjs/common";
import { NestExpressApplication } from "@nestjs/platform-express";
import * as express from "express";
import * as path from "path";

async function bootstrap() {
  const verbose = process.env.NODE_ENV === "development";
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: verbose ? ["debug", "error", "warn", "log", "fatal"] : ["error", "warn", "log", "fatal"],
  });

  app.enableCors({
    origin: [
      "http://localhost:3000",
      "http://localhost:3001",
      "http://localhost:3002",
      "http://127.0.0.1:3000",
      "http://127.0.0.1:3001",
      "http://127.0.0.1:3002",
    ],
    credentials: true,
  });

  app.useGlobalPipes(new ValidationPipe());

  // Set view engine for EJS (legacy support for QR view)
  app.use(express.static(path.join(__dirname, "..", "public")));
  app.setBaseViewsDir(path.join(__dirname, "..", "views"));
  app.setViewEngine("ejs");

  const port = process.env.PORT || 3002;
  await app.listen(port, "0.0.0.0");
  const logger = new Logger("Bootstrap");
  logger.warn(`Application is running on: ${await app.getUrl()}`);
  logger.warn(`Callback URL is ${process.env.CALLBACK_URL ?? "(not set)"}`);
}
bootstrap();
