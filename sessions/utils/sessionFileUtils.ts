import { readdirSync, readFileSync, unlinkSync } from "fs";
import path from "path";
import { saveSessionConfig, type SessionConfig } from "../SessionConfigManager.ts";
import { createSession } from "../SessionManager.ts";

export function initializeRecentlyActiveSessions() {
  readdirSync("./sessions_config").forEach(async (filename) => {
    const sessionName = filename.replace(".json", "")
    try {
      const filePath = path.join("./sessions_config", filename);
      const contents: SessionConfig = JSON.parse(readFileSync(filePath, "utf8"));
      // 1296000 seconds = 15 days
      if (
        contents.lastSentMessageTimestamp &&
        Date.now() / 1000 - contents.lastSentMessageTimestamp > 1296000
      ) {
        console.log(`deleting session ${sessionName}, as it has been inactive for over 15 days.`);
        deleteSession(sessionName);
        return;
      }
      saveSessionConfig(sessionName, contents);
      await createSession(sessionName);
    } catch (error) {
      console.log(`could not start session ${sessionName}: ${error}`);
    }
  });
};

export function deleteSession(sessionId: string) {
    const filePath = path.join("./sessions_config", sessionId)
    try {
        unlinkSync(filePath);
    }
    catch (error){
        console.log(`could not delete ${sessionId}:`,  error)
    }
};