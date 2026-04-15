import fs from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"

export async function getOwnPackageName(moduleUrl: string): Promise<string> {
  const modulePath = fileURLToPath(moduleUrl)
  const packageJsonPath = path.resolve(path.dirname(modulePath), "..", "..", "package.json")
  const packageJson = JSON.parse(await fs.readFile(packageJsonPath, "utf8")) as { name?: string }

  if (!packageJson.name) {
    throw new Error(`package.json at ${packageJsonPath} is missing a name field`)
  }

  return packageJson.name
}
