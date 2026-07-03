import Fastify from "fastify";
import fastifyStatic from "@fastify/static";
import { v4 as uuidv4 } from "uuid";
import {
  addRecentProject,
  readConfig,
  writeConfig,
} from "./config.js";
import {
  cloneRepo,
  fetchRepo,
  getGitStatusWithoutFetch,
  pullRepo,
} from "./git.js";
import { bootstrapEmptyRepo } from "./template.js";
import {
  applyInstallations,
  findRemovedInstallations,
  removeInstallationSymlinks,
} from "./apply.js";
import { scanRepo, scanRepoArtifacts } from "./scan.js";
import { getArtifactTargets } from "./targets.js";
import {
  expandUserPath,
  getIdeAgentsHome,
  getRepoPath,
  getWebDistDir,
  slugFromUrl,
} from "./paths.js";
import type { IdesConfig, Installation, RepoWithStatus } from "./types.js";
import { defaultAdapterFromIdes, getDefaultIdes } from "./ides.js";
import { checkNpmUpdate } from "./npmUpdate.js";
import { PACKAGE_VERSION as VERSION } from "./version.js";

export interface ServerOptions {
  port: number;
  host?: string;
  launchCwd?: string;
}

export async function createServer(options: ServerOptions) {
  const app = Fastify({ logger: false });

  app.setErrorHandler((error, _request, reply) => {
    reply.status(500).send({
      error: error instanceof Error ? error.message : String(error),
    });
  });

  app.get("/api/status", async () => {
    const config = await readConfig();
    const npmUpdate = await checkNpmUpdate();
    return {
      home: getIdeAgentsHome(),
      port: options.port,
      version: VERSION,
      npmUpdate,
      defaultProjectPath: options.launchCwd ?? null,
      ides: config.ides,
    };
  });

  app.get("/api/settings", async () => {
    const config = await readConfig();
    const npmUpdate = await checkNpmUpdate();
    return {
      ides: config.ides,
      defaults: getDefaultIdes(),
      home: getIdeAgentsHome(),
      version: VERSION,
      npmUpdate,
    };
  });

  app.put<{ Body: { ides?: IdesConfig } }>("/api/settings", async (request, reply) => {
    const { ides } = request.body ?? {};
    if (!ides) {
      return reply.status(400).send({ error: "ides is required" });
    }

    for (const key of ["cursor", "claude", "codex", "opencode"] as const) {
      const entry = ides[key];
      if (!entry || typeof entry.configPath !== "string" || !entry.configPath.trim()) {
        return reply.status(400).send({ error: `Invalid config for ${key}` });
      }
    }

    const normalized = {
      cursor: {
        enabled: Boolean(ides.cursor.enabled),
        configPath: expandUserPath(ides.cursor.configPath),
      },
      claude: {
        enabled: Boolean(ides.claude.enabled),
        configPath: expandUserPath(ides.claude.configPath),
      },
      codex: {
        enabled: Boolean(ides.codex.enabled),
        configPath: expandUserPath(ides.codex.configPath),
      },
      opencode: {
        enabled: Boolean(ides.opencode.enabled),
        configPath: expandUserPath(ides.opencode.configPath),
      },
    };

    if (
      !normalized.cursor.enabled &&
      !normalized.claude.enabled &&
      !normalized.codex.enabled &&
      !normalized.opencode.enabled
    ) {
      return reply.status(400).send({ error: "At least one IDE must be enabled" });
    }

    const config = await readConfig();
    config.ides = normalized;
    config.adapter = defaultAdapterFromIdes(config.ides);
    await writeConfig(config);
    return { ides: config.ides };
  });

  app.get("/api/repos", async () => {
    const config = await readConfig();
    const repos: RepoWithStatus[] = [];

    for (const repo of config.repos) {
      const git = await getGitStatusWithoutFetch(repo.slug, repo.ref);
      const repoPath = getRepoPath(repo.slug);
      const { artifacts, skillLayout } = await scanRepo(repoPath);
      repos.push({
        ...repo,
        localPath: repoPath,
        git,
        skillCount: artifacts.filter((a) => a.kind === "skill").length,
        agentCount: artifacts.filter((a) => a.kind === "agent").length,
        skillLayout,
      });
    }

    return { repos };
  });

  app.post<{ Body: { url?: string; ref?: string; id?: string } }>(
    "/api/repos",
    async (request, reply) => {
      const { url, ref = "main", id } = request.body ?? {};
      if (!url?.trim()) {
        return reply.status(400).send({ error: "url is required" });
      }

      const config = await readConfig();
      const slug = slugFromUrl(url.trim());
      const repoId = id?.trim() || slug;

      if (config.repos.some((r) => r.id === repoId)) {
        return reply.status(409).send({ error: `Repository id already exists: ${repoId}` });
      }

      let repoPath: string;
      try {
        repoPath = await cloneRepo(url.trim(), slug, ref);
      } catch (err) {
        return reply.status(400).send({
          error: err instanceof Error ? err.message : String(err),
        });
      }

      const bootstrap = await bootstrapEmptyRepo(repoPath, ref);

      const repo = { id: repoId, url: url.trim(), ref, slug };
      config.repos.push(repo);
      await writeConfig(config);

      const git = await getGitStatusWithoutFetch(slug, ref);
      return {
        repo: {
          ...repo,
          localPath: getRepoPath(slug),
          git,
          skillCount: bootstrap.skillCount,
          agentCount: bootstrap.agentCount,
          skillLayout: bootstrap.skillLayout,
        },
        bootstrap,
      };
    },
  );

  app.delete<{ Params: { id: string } }>(
    "/api/repos/:id",
    async (request, reply) => {
      const config = await readConfig();
      const index = config.repos.findIndex((r) => r.id === request.params.id);
      if (index === -1) {
        return reply.status(404).send({ error: "Repository not found" });
      }

      config.repos.splice(index, 1);
      config.installations = config.installations.filter(
        (i) => i.repoId !== request.params.id,
      );
      await writeConfig(config);
      return { ok: true };
    },
  );

  app.post<{ Params: { id: string } }>(
    "/api/repos/:id/bootstrap",
    async (request, reply) => {
      const config = await readConfig();
      const repo = config.repos.find((r) => r.id === request.params.id);
      if (!repo) {
        return reply.status(404).send({ error: "Repository not found" });
      }

      const repoPath = getRepoPath(repo.slug);
      try {
        const bootstrap = await bootstrapEmptyRepo(repoPath, repo.ref);
        if (!bootstrap.applied) {
          return reply.status(409).send({
            error: "Repository is not empty — bootstrap skipped",
          });
        }

        const git = await getGitStatusWithoutFetch(repo.slug, repo.ref);
        return {
          repo: {
            ...repo,
            localPath: repoPath,
            git,
            skillCount: bootstrap.skillCount,
            agentCount: bootstrap.agentCount,
            skillLayout: bootstrap.skillLayout,
          },
          bootstrap,
        };
      } catch (err) {
        return reply.status(400).send({
          error: err instanceof Error ? err.message : String(err),
        });
      }
    },
  );

  app.post<{ Params: { id: string } }>(
    "/api/repos/:id/fetch",
    async (request, reply) => {
      const config = await readConfig();
      const repo = config.repos.find((r) => r.id === request.params.id);
      if (!repo) {
        return reply.status(404).send({ error: "Repository not found" });
      }

      try {
        await fetchRepo(repo.slug);
      } catch (err) {
        return reply.status(400).send({
          error: err instanceof Error ? err.message : String(err),
        });
      }

      const git = await getGitStatusWithoutFetch(repo.slug, repo.ref);
      return { git };
    },
  );

  app.post<{ Params: { id: string } }>(
    "/api/repos/:id/check-updates",
    async (request, reply) => {
      const config = await readConfig();
      const repo = config.repos.find((r) => r.id === request.params.id);
      if (!repo) {
        return reply.status(404).send({ error: "Repository not found" });
      }

      try {
        await fetchRepo(repo.slug);
      } catch (err) {
        return reply.status(400).send({
          error: err instanceof Error ? err.message : String(err),
        });
      }

      const git = await getGitStatusWithoutFetch(repo.slug, repo.ref);
      return { git };
    },
  );

  app.post<{ Params: { id: string } }>(
    "/api/repos/:id/pull",
    async (request, reply) => {
      const config = await readConfig();
      const repo = config.repos.find((r) => r.id === request.params.id);
      if (!repo) {
        return reply.status(404).send({ error: "Repository not found" });
      }

      try {
        await pullRepo(repo.slug);
      } catch (err) {
        return reply.status(400).send({
          error: err instanceof Error ? err.message : String(err),
        });
      }

      const git = await getGitStatusWithoutFetch(repo.slug, repo.ref);
      return { git };
    },
  );

  app.get<{ Params: { id: string }; Querystring: { projectPath?: string } }>(
    "/api/repos/:id/artifacts",
    async (request, reply) => {
      const config = await readConfig();
      const repo = config.repos.find((r) => r.id === request.params.id);
      if (!repo) {
        return reply.status(404).send({ error: "Repository not found" });
      }

      const projectPath = request.query.projectPath?.trim() || null;
      const scanned = await scanRepoArtifacts(getRepoPath(repo.slug));
      const artifacts = await Promise.all(
        scanned.map(async (artifact) => ({
          ...artifact,
          targets: await getArtifactTargets(artifact, projectPath, config),
        })),
      );
      return { artifacts };
    },
  );

  app.get("/api/installations", async () => {
    const config = await readConfig();
    return {
      installations: config.installations,
      recentProjects: config.recentProjects,
    };
  });

  app.put<{ Body: { installations?: Installation[] } }>(
    "/api/installations",
    async (request, reply) => {
      const { installations } = request.body ?? {};
      if (!Array.isArray(installations)) {
        return reply.status(400).send({ error: "installations array is required" });
      }

      const config = await readConfig();
      const previousInstallations = config.installations;

      const usedIds = new Set<string>();
      const normalized = installations.map((installation) => {
        let id = installation.id?.trim() || "";
        if (!id || usedIds.has(id)) {
          id = uuidv4();
        }
        usedIds.add(id);
        return { ...installation, id };
      });

      for (const removed of findRemovedInstallations(
        previousInstallations,
        normalized,
      )) {
        await removeInstallationSymlinks(removed, config);
      }

      for (const installation of normalized) {
        if (installation.project && installation.projectPath) {
          const updated = await addRecentProject(config, installation.projectPath);
          config.recentProjects = updated.recentProjects;
        }
      }

      config.installations = normalized;
      await writeConfig(config);
      return { installations: config.installations };
    },
  );

  app.post("/api/apply", async (_request, reply) => {
    const config = await readConfig();
    try {
      const result = await applyInstallations(config);
      return result;
    } catch (err) {
      return reply.status(400).send({
        error: err instanceof Error ? err.message : String(err),
      });
    }
  });

  app.post<{ Body: { url?: string } }>("/api/open", async (request, reply) => {
    const { url } = request.body ?? {};
    if (!url?.trim()) {
      return reply.status(400).send({ error: "url is required" });
    }
    return { url: url.trim() };
  });

  const webDist = getWebDistDir();
  await app.register(fastifyStatic, {
    root: webDist,
    prefix: "/",
    wildcard: false,
  });

  app.setNotFoundHandler((request, reply) => {
    if (request.url.startsWith("/api/")) {
      return reply.status(404).send({ error: "Not found" });
    }
    return reply.sendFile("index.html", webDist);
  });

  return app;
}

export async function startServer(options: ServerOptions) {
  const app = await createServer(options);
  await app.listen({ port: options.port, host: options.host ?? "127.0.0.1" });
  return app;
}
