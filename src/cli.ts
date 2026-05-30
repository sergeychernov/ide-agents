#!/usr/bin/env node
import { spawn } from "node:child_process";
import net from "node:net";
import path from "node:path";
import { readConfig } from "./config.js";
import { checkNpmUpdate, formatCliUpdateMessage } from "./npmUpdate.js";
import { startServer } from "./server.js";

interface CliOptions {
  port?: number;
  noOpen?: boolean;
  noUpdateCheck?: boolean;
}

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {};

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--no-open") {
      options.noOpen = true;
    } else if (arg === "--no-update-check") {
      options.noUpdateCheck = true;
    } else if (arg === "--port" && argv[i + 1]) {
      options.port = Number.parseInt(argv[i + 1]!, 10);
      i++;
    } else if (arg === "ui") {
      // default command
    }
  }

  return options;
}

async function isPortAvailable(port: number, host: string): Promise<boolean> {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once("error", () => resolve(false));
    server.once("listening", () => {
      server.close(() => resolve(true));
    });
    server.listen(port, host);
  });
}

async function findAvailablePort(
  startPort: number,
  host: string,
  maxAttempts = 10,
): Promise<number> {
  for (let offset = 0; offset < maxAttempts; offset++) {
    const port = startPort + offset;
    if (await isPortAvailable(port, host)) {
      return port;
    }
  }
  throw new Error(
    `Ports ${startPort}-${startPort + maxAttempts - 1} are busy on ${host}`,
  );
}

function openBrowser(url: string): void {
  const platform = process.platform;
  if (platform === "darwin") {
    spawn("open", [url], { detached: true, stdio: "ignore" }).unref();
  } else if (platform === "linux") {
    spawn("xdg-open", [url], { detached: true, stdio: "ignore" }).unref();
  } else {
    console.log(`Open ${url} in your browser`);
  }
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const config = await readConfig();
  const host = "127.0.0.1";
  const requestedPort = options.port ?? config.server.port;
  const port = await findAvailablePort(requestedPort, host);
  const url = `http://${host}:${port}`;

  if (!options.noUpdateCheck) {
    const updateMessage = formatCliUpdateMessage(await checkNpmUpdate());
    if (updateMessage) {
      console.log(updateMessage);
    }
  }

  const app = await startServer({
    port,
    host,
    launchCwd: path.resolve(process.cwd()),
  });

  console.log(`ide-agents running at ${url}`);

  if (!options.noOpen) {
    openBrowser(url);
  }

  const shutdown = async () => {
    console.log("\nShutting down...");
    await app.close();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
