import cors from "cors";
import type { Express } from "express";
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import routes from "./api/routes.ts";
import "dotenv/config";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app: Express = express();

app.use(
  cors({
    origin: [
      "http://localhost:3000",
      "http://localhost:3001",
      "http://localhost:3002",
      "http://127.0.0.1:3000",
      "http://127.0.0.1:3001",
      "http://127.0.0.1:3002",
    ],
    credentials: true,
  })
);

app.set("views", path.join(__dirname, "views"));
app.set("view engine", "ejs");
app.use(express.json());
app.use("/api", routes);

app.listen(3002, () =>
  console.log("API listening on port 3002 and callback url is", process.env.CALLBACK_URL)
);
