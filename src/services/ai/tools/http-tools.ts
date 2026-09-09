import { tool } from "ai"
import { z } from "zod"

import { executeIntegration } from "@/data/repositories/integration-execution-repository"
import { createDefaultHttpIntegrationConfig } from "@/data/domain/integrations"

function createHttpToolConfig(input: { method: string; url: string; headersJson: string; queryJson: string; bodyJson: string; description: string }) {
  return { ...createDefaultHttpIntegrationConfig(), method: input.method, url: input.url, description: input.description, headersJson: input.headersJson, queryJson: input.queryJson, bodyJson: input.bodyJson }
}

export function createHttpTools() {
  return {
    httpRequest: tool({
      description: "Make an HTTP request through the desktop runtime.",
      inputSchema: z.object({ method: z.string().default("GET"), url: z.string().url(), headersJson: z.string().default("{}"), queryJson: z.string().default("{}"), bodyJson: z.string().default("{}") }),
      execute: async ({ method, url, headersJson, queryJson, bodyJson }) => executeIntegration(createHttpToolConfig({ method, url, headersJson, queryJson, bodyJson, description: "chat http tool" }), bodyJson),
    }),
  }
}

export function executeHttpTool(input: Record<string, unknown>, description = "chat http tool retry") {
  if (typeof input.url !== "string") throw new Error("Tool input is missing the URL.")
  return executeIntegration(createHttpToolConfig({ method: typeof input.method === "string" ? input.method : "GET", url: input.url, headersJson: typeof input.headersJson === "string" ? input.headersJson : "{}", queryJson: typeof input.queryJson === "string" ? input.queryJson : "{}", bodyJson: typeof input.bodyJson === "string" ? input.bodyJson : "{}", description }), typeof input.bodyJson === "string" ? input.bodyJson : "{}")
}
