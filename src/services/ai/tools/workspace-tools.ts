import { tool } from "ai"
import { z } from "zod"

import { projectIpc } from "@/lib/ipc"

export function createWorkspaceTools() {
  return {
    listWorkspaceFiles: tool({
      description: "List files and folders from the local workspace.",
      inputSchema: z.object({ relativePath: z.string().optional() }),
      execute: async ({ relativePath }) => projectIpc.tools.listFiles(relativePath),
    }),
    readWorkspaceFile: tool({
      description: "Read a text file from the local workspace.",
      inputSchema: z.object({ path: z.string() }),
      execute: async ({ path }) => projectIpc.tools.readFile(path),
    }),
    writeWorkspaceFile: tool({
      description: "Write text content to a file inside the local workspace.",
      inputSchema: z.object({ path: z.string(), content: z.string() }),
      execute: async ({ path, content }) => projectIpc.tools.writeFile({ path, content }),
    }),
    runWorkspaceCommand: tool({
      description: "Run a shell command inside the local workspace and capture stdout/stderr.",
      inputSchema: z.object({ command: z.string(), cwd: z.string().optional(), timeoutMs: z.number().optional() }),
      execute: async ({ command, cwd, timeoutMs }) => projectIpc.tools.runCommand({ command, cwd, timeoutMs }),
    }),
    openExternalUrl: tool({
      description: "Open a URL in the system browser.",
      inputSchema: z.object({ url: z.string().url() }),
      execute: async ({ url }) => projectIpc.tools.openExternal(url),
    }),
  }
}
