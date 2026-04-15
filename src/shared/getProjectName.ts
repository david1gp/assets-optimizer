import fs from "node:fs/promises"
import path from "node:path"

export async function getProjectName(cwd: string): Promise<string> {
  const packageJsonPath = path.join(cwd, "package.json")
  const packageJson = JSON.parse(await fs.readFile(packageJsonPath, "utf8")) as { name?: string }
  if (!packageJson.name) {
    throw new Error(`package.json at ${packageJsonPath} is missing a name field`)
  }

  return packageJson.name
}
