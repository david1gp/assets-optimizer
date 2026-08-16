import { buildApplication, buildRouteMap } from "@stricli/core"
import { optimizeCommand } from "./optimizeCommand.js"

const assetsOptimizerRoutes = buildRouteMap({
  routes: {
    optimize: optimizeCommand,
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
})
