import { Command } from "commander";
import { chatCommand } from "./commands/chat";
import { configCommand } from "./commands/config";
import { runCommand } from "./commands/run";
import { skillCommand } from "./commands/skill";

export function createCliProgram() {
  const program = new Command();

  program.name("forgeagent").description("ForgeAgent OS CLI").version("0.1.0");

  program
    .command("chat")
    .description("Start an interactive chat session")
    .argument("[prompt]", "Initial prompt")
    .option("-w, --workspace <path>", "Workspace directory", process.cwd())
    .option("-m, --model <name>", "Model to use", "openai/gpt-4.1")
    .action(chatCommand);

  program
    .command("run")
    .description("Run a single task")
    .argument("<task>", "Task description")
    .option("-w, --workspace <path>", "Workspace directory", process.cwd())
    .option("-m, --model <name>", "Model to use", "openai/gpt-4.1")
    .action(runCommand);

  program
    .command("skill")
    .description("Manage skills")
    .addCommand(skillCommand);

  program
    .command("config")
    .description("Manage configuration")
    .addCommand(configCommand);

  return program;
}
