#!/usr/bin/env bun

import type { ApplicationContext } from "@stricli/core"
import { run } from "@stricli/core"
import { assetsOptimizerApplication } from "./assetsOptimizerApplication.js"

const stdoutChunks: string[] = []
const stderrChunks: string[] = []
const cliProcess: ApplicationContext["process"] = {
  env: {
    STRICLI_NO_COLOR: "1",
  },
  stdout: {
    write(value) {
      stdoutChunks.push(value)
    },
  },
  stderr: {
    write(value) {
      stderrChunks.push(value)
    },
  },
}

let runError: unknown
try {
  await run(assetsOptimizerApplication, process.argv.slice(2), {
    process: cliProcess,
    locale: "en",
  })
} catch (error) {
  runError = error
  cliProcess.exitCode = 1
}

const commandOutput = stdoutChunks.join("")
const parsedOutput = parseEnvelope(commandOutput)
if (parsedOutput !== undefined) {
  process.stdout.write(commandOutput.endsWith("\n") ? commandOutput : `${commandOutput}\n`)
} else if (cliProcess.exitCode === 0) {
  process.stdout.write(
    `${JSON.stringify({
      success: true,
      data: { help: commandOutput.trimEnd() },
    })}\n`,
  )
} else {
  process.stdout.write(
    `${JSON.stringify({
      success: false,
      error: {
        type: runError === undefined ? "command" : "runtime",
        message: getErrorMessage(runError ?? (stderrChunks.join("\n") || "The command did not produce a JSON result")),
      },
    })}\n`,
  )
}

process.exitCode = cliProcess.exitCode === 0 ? 0 : 1

function parseEnvelope(value: string): Record<string, unknown> | undefined {
  if (value.trim() === "") {
    return undefined
  }

  try {
    const parsed = JSON.parse(value) as unknown
    if (!isRecord(parsed) || typeof parsed.success !== "boolean") {
      return undefined
    }

    return parsed
  } catch {
    return undefined
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
