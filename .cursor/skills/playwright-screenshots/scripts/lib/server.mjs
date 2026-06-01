import { spawn } from 'node:child_process';
import { isAbsolute, join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

/**
 * @param {{ command: string, cwd?: string, env?: Record<string, string>, readyUrl?: string, readyTimeoutMs?: number }} server
 * @param {string} repoRoot
 */
export async function startDevServer(server, repoRoot) {
  const cwd = server.cwd
    ? (isAbsolute(server.cwd) ? server.cwd : join(repoRoot, server.cwd))
    : repoRoot;
  const readyUrl = server.readyUrl ?? server.readyPath;
  const timeoutMs = server.readyTimeoutMs ?? 120_000;

  const child = spawn(server.command, {
    cwd,
    shell: true,
    env: { ...process.env, ...server.env },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  let stderr = '';
  child.stderr?.on('data', (chunk) => {
    stderr += chunk.toString();
  });

  const kill = () => {
    if (!child.killed) {
      child.kill('SIGTERM');
    }
  };

  try {
    if (readyUrl) {
      await waitForHttp(readyUrl, timeoutMs);
    } else {
      await delay(3000);
    }
    return { child, kill };
  } catch (err) {
    kill();
    const tail = stderr.slice(-2000);
    throw new Error(
      `${err.message}${tail ? `\n\nServer stderr (tail):\n${tail}` : ''}`,
    );
  }
}

async function waitForHttp(url, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  let lastError = 'timeout';
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(3000) });
      if (res.ok || res.status < 500) {
        return;
      }
      lastError = `HTTP ${res.status}`;
    } catch (err) {
      lastError = err.message;
    }
    await delay(500);
  }
  throw new Error(`Dev server not ready at ${url} within ${timeoutMs}ms (${lastError})`);
}
