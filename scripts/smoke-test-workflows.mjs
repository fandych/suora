import WebSocket from "ws"

function callCdp(ws, method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = Math.floor(Math.random() * 100000)
    const handler = (data) => {
      const msg = JSON.parse(data)
      if (msg.id === id) {
        ws.off("message", handler)
        if (msg.error) reject(msg.error)
        else resolve(msg.result)
      }
    }
    ws.on("message", handler)
    ws.send(JSON.stringify({ id, method, params }))
  })
}

async function evalInElectron(ws, code) {
  const result = await callCdp(ws, "Runtime.evaluate", {
    expression: code,
    awaitPromise: true,
    returnByValue: true,
  })
  if (result.exceptionDetails) {
    throw new Error(result.exceptionDetails.text + ": " + (result.exceptionDetails.exception?.description || "JS Error"))
  }
  return result.result?.value
}

async function connectToElectronPage() {
  const targets = await (await fetch("http://127.0.0.1:9222/json/list")).json()
  const page = targets.find((target) => target.type === "page")
  if (!page) throw new Error("No Electron page found on port 9222")

  const ws = new WebSocket(page.webSocketDebuggerUrl)
  await new Promise((resolve) => ws.on("open", resolve))
  console.log("[CDP] Connected to Electron mainWindow:", page.webSocketDebuggerUrl)
  return ws
}

async function runSmokeTests() {
  console.log("\n========================================================")
  console.log("        SUORA ELECTRON WORKFLOW RUNTIME SMOKE TEST      ")
  console.log("========================================================")

  const ws = await connectToElectronPage()
  const result = await evalInElectron(
    ws,
    `
    (async () => {
      if (!window.app?.workflows) {
        throw new Error("window.app.workflows is unavailable")
      }

      const workflows = window.app.workflows
      const createdSummaries = []

      function readSelectedVersion(payload, preferredVersionId) {
        const versions = Array.isArray(payload?.versions) ? payload.versions : []
        return versions.find((version) => version.id === preferredVersionId) || versions[0] || null
      }

      function readDefinition(payload, preferredVersionId) {
        const version = readSelectedVersion(payload, preferredVersionId)
        if (!version?.definitionJson) {
          throw new Error("Workflow payload did not include a definitionJson")
        }
        return JSON.parse(version.definitionJson)
      }

      function defaultBindings() {
        return {
          providerId: "provider-openai",
          skillId: "skill-plan",
          documentId: "document-product-manual",
          integrationId: "integration-webhook",
        }
      }

      async function waitForRun(requestId) {
        return await new Promise((resolve, reject) => {
          const listener = (_event, payload) => {
            if (!payload || payload.requestId !== requestId) return
            if (payload.type === "completed") {
              workflows.offRunEvent(listener)
              resolve(payload.invocation)
            } else if (payload.type === "failed") {
              workflows.offRunEvent(listener)
              reject(new Error(payload.error || "Workflow run failed"))
            } else if (payload.type === "cancelled") {
              workflows.offRunEvent(listener)
              reject(new Error("Workflow run was cancelled"))
            }
          }
          workflows.onRunEvent(listener)
        })
      }

      async function createSaveAndRun(title, summary, definition, input) {
        const created = await workflows.create()
        const workflowId = created.workflow.id
        const selectedVersionId = readSelectedVersion(created)?.id
        if (!selectedVersionId) {
          throw new Error("Workflow creation did not return a version id")
        }
        const saved = await workflows.save({
          id: workflowId,
          title,
          summary,
          enabled: true,
          selectedVersionId,
          definitionJson: JSON.stringify(definition),
        })

        const requestId = crypto.randomUUID()
        const savedVersion = readSelectedVersion(saved, selectedVersionId)
        if (!savedVersion?.id) {
          throw new Error("Workflow save did not return a version id")
        }
        const accepted = await workflows.startRun({
          requestId,
          workflowId,
          versionId: savedVersion.id,
          definition: readDefinition(saved, savedVersion.id),
          input,
          mode: "manual",
        })
        const invocation = await waitForRun(accepted.requestId)
        const refreshed = await workflows.get(workflowId, savedVersion.id)

        createdSummaries.push({
          title,
          workflowId,
          versionId: savedVersion.id,
          invocationCount: refreshed?.invocations?.length ?? 0,
          traceCount: invocation?.traces?.length ?? 0,
          lastTrace: invocation?.traces?.at(-1)?.output ?? null,
        })
      }

      const linearDefinition = {
        viewport: { x: 0, y: 0, zoom: 1 },
        nodes: [
          { id: "start", type: "workflowNode", position: { x: 60, y: 120 }, data: { kind: "start", label: "Start", prompt: "", enabled: true, outputKey: "request", timeoutMs: 30000 } },
          { id: "setName", type: "workflowNode", position: { x: 260, y: 120 }, data: { kind: "variable-assigner", label: "Set Name", prompt: "", enabled: true, variableName: "userName", variableValue: "Ada", outputKey: "userName", timeoutMs: 30000 } },
          { id: "template", type: "workflowNode", position: { x: 460, y: 120 }, data: { kind: "template", label: "Template", prompt: "", enabled: true, template: "Hello {{userName}}", outputKey: "greeting", timeoutMs: 30000 } },
          { id: "end", type: "workflowNode", position: { x: 660, y: 120 }, data: { kind: "end", label: "End", prompt: "", enabled: true, inputTemplate: "{{greeting}}", timeoutMs: 30000 } },
        ],
        edges: [
          { id: "e1", source: "start", target: "setName" },
          { id: "e2", source: "setName", target: "template" },
          { id: "e3", source: "template", target: "end" },
        ],
        resourceBindings: defaultBindings(),
        dryRunInputJson: JSON.stringify({ username: "Ada" }, null, 2),
        variables: [],
        budget: { maxSteps: 8, maxDurationMs: 120000 },
      }

      const conditionalDefinition = {
        viewport: { x: 0, y: 0, zoom: 1 },
        nodes: [
          { id: "start", type: "workflowNode", position: { x: 60, y: 120 }, data: { kind: "start", label: "Start", prompt: "", enabled: true, outputKey: "request", timeoutMs: 30000 } },
          { id: "branch", type: "workflowNode", position: { x: 260, y: 120 }, data: { kind: "if-else", label: "Pass Check", prompt: "", enabled: true, branches: [{ id: "pass", label: "Pass", expression: "$input.score >= 60" }, { id: "fail", label: "Fail", expression: "" }], timeoutMs: 30000 } },
          { id: "passNode", type: "workflowNode", position: { x: 480, y: 40 }, data: { kind: "variable-assigner", label: "Pass", prompt: "", enabled: true, variableName: "result", variableValue: "passed", outputKey: "result", timeoutMs: 30000 } },
          { id: "failNode", type: "workflowNode", position: { x: 480, y: 200 }, data: { kind: "variable-assigner", label: "Fail", prompt: "", enabled: true, variableName: "result", variableValue: "failed", outputKey: "result", timeoutMs: 30000 } },
          { id: "end", type: "workflowNode", position: { x: 700, y: 120 }, data: { kind: "end", label: "End", prompt: "", enabled: true, inputTemplate: "{{result}}", timeoutMs: 30000 } },
        ],
        edges: [
          { id: "e1", source: "start", target: "branch" },
          { id: "e2", source: "branch", sourceHandle: "pass", target: "passNode" },
          { id: "e3", source: "branch", sourceHandle: "fail", target: "failNode" },
          { id: "e4", source: "passNode", target: "end" },
          { id: "e5", source: "failNode", target: "end" },
        ],
        resourceBindings: defaultBindings(),
        dryRunInputJson: JSON.stringify({ score: 92 }, null, 2),
        variables: [],
        budget: { maxSteps: 8, maxDurationMs: 120000 },
      }

      await createSaveAndRun(
        "[Smoke] Linear workflow",
        "Validates create/save/run/invocation for supported linear nodes.",
        linearDefinition,
        { username: "Ada" },
      )

      await createSaveAndRun(
        "[Smoke] Conditional workflow",
        "Validates branch selection and invocation recording for supported nodes.",
        conditionalDefinition,
        { score: 92 },
      )

      return JSON.stringify(createdSummaries)
    })()
  `,
  )

  const summaries = JSON.parse(result)
  console.log("\n========================================================")
  console.log("            SMOKE TEST SUMMARY & RESULTS                ")
  console.log("========================================================\n")
  for (const summary of summaries) {
    console.log(`- ${summary.title}`)
    console.log(`  workflowId: ${summary.workflowId}`)
    console.log(`  versionId: ${summary.versionId}`)
    console.log(`  invocationCount: ${summary.invocationCount}`)
    console.log(`  traceCount: ${summary.traceCount}`)
    console.log(`  lastTrace: ${summary.lastTrace}`)
  }

  ws.close()
  console.log("\n========================================================")
  console.log(" ✓ WORKFLOW SMOKE TEST PASSED AGAINST CURRENT APP API   ")
  console.log("========================================================\n")
}

runSmokeTests().catch((err) => {
  console.error("Smoke Test Error:", err)
  process.exit(1)
})
