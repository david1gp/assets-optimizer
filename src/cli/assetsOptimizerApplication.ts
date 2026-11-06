import { buildApplication, buildRouteMap } from "@stricli/core"
import { packageVersion } from "../packageVersion.js"
import { optimizeCommand } from "./optimizeCommand.js"
import { resolveCommand } from "./resolveCommand.js"
import { statusCommand } from "./statusCommand.js"
import { syncCommand } from "./syncCommand.js"
import { versionCommand } from "./versionCommand.js"

const assetsOptimizerRoutes = buildRouteMap({
  routes: {
    optimize: optimizeCommand,
    resolve: resolveCommand,
    status: statusCommand,
    sync: syncCommand,
    version: versionCommand,
  },
  docs: {
    brief: "Process project assets",
  },
})

export const assetsOptimizerApplication = buildApplication(assetsOptimizerRoutes, {
  name: "assets-optimizer",
  scanner: {
    caseStyle: "allow-kebab-for-camel",
  },
  documentation: {
    caseStyle: "convert-camel-to-kebab",
  },
  versionInfo: {
    currentVersion: packageVersion,
  },
})
