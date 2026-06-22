#!/usr/bin/env node
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createCliProgram } from "./cli";

export function isCliEntrypoint(
  metaUrl = import.meta.url,
  argv1 = process.argv[1],
) {
  if (!argv1) {
    return false;
  }

  return fileURLToPath(metaUrl) === resolve(argv1);
}

if (isCliEntrypoint()) {
  createCliProgram().parse();
}
