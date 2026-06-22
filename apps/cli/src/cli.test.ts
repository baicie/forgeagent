import { pathToFileURL } from "node:url";
import { createCliProgram } from "./cli";
import { isCliEntrypoint } from "./index";

describe("ForgeAgent CLI", () => {
  it("uses forgeagent as the CLI name", () => {
    const program = createCliProgram();

    expect(program.name()).toBe("forgeagent");
    expect(program.description()).toBe("ForgeAgent OS CLI");
    expect(program.version()).toBe("0.1.0");
  });

  it("keeps the template commands available during Phase 0", () => {
    const program = createCliProgram();

    expect(program.commands.map((command) => command.name())).toEqual([
      "chat",
      "run",
      "skill",
      "config",
    ]);
  });

  it("renders help with ForgeAgent branding", () => {
    const help = createCliProgram().helpInformation();

    expect(help).toContain("Usage: forgeagent");
    expect(help).toContain("ForgeAgent OS CLI");
    expect(help).toContain("chat");
    expect(help).toContain("run");
    expect(help).not.toContain("Universal Agent CLI");
  });

  it("detects the direct CLI entrypoint", () => {
    const entry = "/tmp/forgeagent/apps/cli/src/index.ts";
    const metaUrl = pathToFileURL(entry).href;

    expect(isCliEntrypoint(metaUrl, entry)).toBe(true);
    expect(isCliEntrypoint(metaUrl, "/tmp/other.ts")).toBe(false);
    expect(isCliEntrypoint(metaUrl, undefined)).toBe(false);
  });
});
