import fs from "fs";
import path from "path";

export type SessionConfig = {
  webhook?: string;
  workspaceID?: string;
  canalID?: string;
  lastSentMessageTimestamp?: number;
};

const configDir = "./sessions_config";

if (!fs.existsSync(configDir)) {
  fs.mkdirSync(configDir, { recursive: true });
}

export function updateLastSentMessageTimestamp(
  sessionName: string,
  lastSentMessageTimestamp: number
) {
  const filePath = path.join(configDir, `${sessionName}.json`);

  if (fs.existsSync(filePath)) {
    let current = fs.readFileSync(filePath, "utf8");
    fs.writeFileSync(
      filePath,
      JSON.stringify({ ...JSON.parse(current), lastSentMessageTimestamp })
    );
  }
}

export function saveSessionConfig(sessionName: string, config: SessionConfig): void {
  const filePath = path.join(configDir, `${sessionName}.json`);

  const current = fs.existsSync(filePath) ? fs.readFileSync(filePath, "utf8") : "{}";
  fs.writeFileSync(filePath, JSON.stringify({ ...JSON.parse(current), ...config }));
}

export function getSessionConfig(sessionName: string): SessionConfig | null {
  const filePath = path.join(configDir, `${sessionName}.json`);
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, "utf8")) as SessionConfig;
}
