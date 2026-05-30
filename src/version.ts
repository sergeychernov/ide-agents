import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);

const { version } = require(
  path.join(fileURLToPath(new URL(".", import.meta.url)), "../package.json"),
) as { version: string };

export const PACKAGE_VERSION = version;
