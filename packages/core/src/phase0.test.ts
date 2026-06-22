import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");

async function readText(relativePath: string) {
  return readFile(resolve(repoRoot, relativePath), "utf8");
}

async function readJson<T>(relativePath: string): Promise<T> {
  return JSON.parse(await readText(relativePath)) as T;
}

describe("Phase 0 repository identity", () => {
  it("renames the root package and dev script", async () => {
    const pkg = await readJson<{
      name: string;
      scripts: Record<string, string>;
    }>("package.json");

    expect(pkg.name).toBe("forgeagent");
    expect(pkg.scripts.dev).toBe("pnpm --filter @forgeagent/cli dev");
    expect(pkg.scripts.typecheck).toBe("pnpm -r exec tsc --noEmit");
  });

  it("renames workspace package identities", async () => {
    const corePkg = await readJson<{
      name: string;
      description: string;
    }>("packages/core/package.json");

    const cliPkg = await readJson<{
      name: string;
      description: string;
      bin: Record<string, string>;
      dependencies: Record<string, string>;
    }>("apps/cli/package.json");

    expect(corePkg.name).toBe("@forgeagent/core");
    expect(corePkg.description).toContain("ForgeAgent OS");

    expect(cliPkg.name).toBe("@forgeagent/cli");
    expect(cliPkg.description).toContain("ForgeAgent");
    expect(cliPkg.bin).toEqual({ forgeagent: "./dist/index.js" });
    expect(cliPkg.dependencies["@forgeagent/core"]).toBe("workspace:*");
    expect(cliPkg.dependencies["@agent/core"]).toBeUndefined();
  });

  it("updates TypeScript path aliases", async () => {
    const tsconfig = await readJson<{
      compilerOptions: {
        paths: Record<string, string[]>;
      };
    }>("tsconfig.json");

    expect(tsconfig.compilerOptions.paths["@forgeagent/core"]).toEqual([
      "./packages/core/src/index.ts",
    ]);
    expect(tsconfig.compilerOptions.paths["@forgeagent/core/*"]).toEqual([
      "./packages/core/src/*",
    ]);
    expect(tsconfig.compilerOptions.paths["@agent/core"]).toBeUndefined();
  });

  it("updates README branding and CLI examples", async () => {
    const readme = await readText("README.md");

    expect(readme).toContain("# ForgeAgent OS");
    expect(readme).toContain("Local-first Coding Agent + Web Console Lite");
    expect(readme).toContain("pnpm --filter @forgeagent/cli dev");
    expect(readme).toContain("forgeagent chat");
    expect(readme).not.toContain("# Universal Agent\n");
    expect(readme).not.toContain("pnpm --filter @agent/cli dev");
    expect(readme).not.toContain("universal-agent/");
    expect(readme).not.toContain("Universal Agent CLI");
  });

  it("adds phase 0 documentation files", async () => {
    const docs = [
      "docs/roadmap.md",
      "docs/mvp.md",
      "docs/security.md",
      "docs/runner.md",
      "docs/agent-loop.md",
    ];

    for (const doc of docs) {
      const content = await readText(doc);
      expect(content.length).toBeGreaterThan(100);
      expect(content).toContain("ForgeAgent");
    }
  });

  it("keeps CI aligned with Phase 0 commands", async () => {
    const ci = await readText(".github/workflows/ci.yml");

    expect(ci).toContain("pnpm install --frozen-lockfile");
    expect(ci).toContain("pnpm lint");
    expect(ci).toContain("pnpm format:check");
    expect(ci).toContain("pnpm typecheck");
    expect(ci).toContain("pnpm test:run");
    expect(ci).toContain("pnpm build");
  });
});
