import fs from "node:fs"
import path from "node:path"
import { pathToFileURL } from "node:url"
import { net, protocol } from "electron"

const RENDERER_SCHEME = "app"
const RENDERER_HOST = "renderer"
const INDEX_FILE = "index.html"

export const rendererOrigin = `${RENDERER_SCHEME}://${RENDERER_HOST}`

protocol.registerSchemesAsPrivileged([
  {
    scheme: RENDERER_SCHEME,
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      stream: true,
      corsEnabled: true,
    },
  },
])

function getRendererRoot() {
  return path.resolve(__dirname, "../renderer")
}

function isInsideRendererRoot(targetPath: string, rendererRoot: string) {
  const relative = path.relative(rendererRoot, targetPath)
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative))
}

function resolveRendererPath(requestPathname: string) {
  const rendererRoot = getRendererRoot()
  const normalizedPathname = decodeURIComponent(requestPathname || "/")
  const candidatePath = normalizedPathname === "/" ? INDEX_FILE : normalizedPathname.replace(/^\/+/, "")
  const resolvedPath = path.resolve(rendererRoot, candidatePath)

  if (!isInsideRendererRoot(resolvedPath, rendererRoot)) {
    return null
  }

  if (fs.existsSync(resolvedPath) && fs.statSync(resolvedPath).isFile()) {
    return resolvedPath
  }

  if (path.extname(candidatePath)) {
    return null
  }

  return path.resolve(rendererRoot, INDEX_FILE)
}

export function registerRendererProtocol() {
  protocol.handle(RENDERER_SCHEME, (request) => {
    const url = new URL(request.url)
    if (url.host !== RENDERER_HOST) {
      return new Response("Not Found", { status: 404 })
    }

    const filePath = resolveRendererPath(url.pathname)
    if (!filePath) {
      return new Response("Not Found", { status: 404 })
    }

    return net.fetch(pathToFileURL(filePath).toString())
  })
}
