export const FORGEAGENT_PACKAGE_NAME = "forgeagent";
export const FORGEAGENT_PRODUCT_NAME = "ForgeAgent OS";
export const FORGEAGENT_CLI_NAME = "forgeagent";
export const FORGEAGENT_CORE_PACKAGE = "@forgeagent/core";
export const FORGEAGENT_CLI_PACKAGE = "@forgeagent/cli";

export const FORGEAGENT_LOCAL_RUNNER_HOST = "127.0.0.1";
export const FORGEAGENT_LOCAL_RUNNER_PORT = 17890;

export const FORGEAGENT_MVP_NAME =
  "Local-first Coding Agent + Web Console Lite";

export const FORGEAGENT_PRINCIPLES = [
  "Local-first",
  "Private-first",
  "Runner-based",
  "Approval-first",
  "Auditable",
  "Model-agnostic",
  "Git-native",
] as const;

export type ForgeAgentPrinciple = (typeof FORGEAGENT_PRINCIPLES)[number];
