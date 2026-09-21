import { loader } from "@monaco-editor/react"
import * as monaco from "monaco-editor"
import cssWorker from "@monaco-vs/language/css/css.worker.js?worker"
import htmlWorker from "@monaco-vs/language/html/html.worker.js?worker"
import jsonWorker from "@monaco-vs/language/json/json.worker.js?worker"
import tsWorker from "@monaco-vs/language/typescript/ts.worker.js?worker"
import editorWorker from "@monaco-vs/editor/editor.worker.js?worker"

type MonacoWorkerFactory = {
  getWorker: (_workerId: string, label: string) => Worker
}

const monacoEnvironment: MonacoWorkerFactory = {
  getWorker(_workerId, label) {
    if (label === "json") return new jsonWorker()
    if (label === "css" || label === "scss" || label === "less") return new cssWorker()
    if (label === "html" || label === "handlebars" || label === "razor") return new htmlWorker()
    if (label === "typescript" || label === "javascript") return new tsWorker()
    return new editorWorker()
  },
}

loader.config({ monaco })

if (typeof self !== "undefined") {
  ;(self as typeof self & { MonacoEnvironment?: MonacoWorkerFactory }).MonacoEnvironment = monacoEnvironment
}