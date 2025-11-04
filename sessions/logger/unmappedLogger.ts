import fs from "fs";

export function logUnmappedMessage(message: unknown, sessionName: string): void {
  try {
    console.log("🔴 Unmapped message");
    console.log(JSON.stringify(message));

    const logPath = "./unmapped_messages.json";
    let logs: unknown[] = [];

    if (fs.existsSync(logPath)) {
      try {
        const fileContent = fs.readFileSync(logPath, "utf8");
        logs = JSON.parse(fileContent);
      } catch {
        logs = [];
      }
    }

    (logs as any[]).push({
      date: new Date().toISOString(),
      session: sessionName,
      user: (message as any)?.key?.remoteJid,
      name: (message as any)?.pushName,
      payload: message,
    });

    fs.writeFileSync(logPath, JSON.stringify(logs, null, 2));
  } catch {
    console.log("Check log write!");
  }
}
