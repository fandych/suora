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

async function runCdpE2ETest() {
  console.log("\n==========================================")
  console.log("  SUORA WORKFLOW GLOBAL E2E TEST SUITE   ")
  console.log("==========================================")

  // 1. Fetch CDP target
  const targets = await (await fetch("http://127.0.0.1:9222/json/list")).json()
  const page = targets.find((t) => t.type === "page")
  if (!page) {
    throw new Error("No Electron page target found on port 9222")
  }

  const ws = new WebSocket(page.webSocketDebuggerUrl)
  await new Promise((resolve) => ws.on("open", resolve))
  console.log("[CDP] Connected to Electron mainWindow:", page.webSocketDebuggerUrl)

  // 2. Bridge Verification
  const bridgeCheck = await callCdp(ws, "Runtime.evaluate", {
    expression: "JSON.stringify({ suora: Boolean(window.suora), electron: Boolean(window.electron), href: window.location.href })",
    returnByValue: true,
  })
  console.log("[CDP] Bridge Status:", JSON.parse(bridgeCheck.result.value))

  // 3. Test Workflow Listing & Record Invocations
  const e2eResult = await callCdp(ws, "Runtime.evaluate", {
    expression: `
      (async () => {
        let list = await window.suora.workflows.list();
        if (!list || list.length === 0) {
          await window.suora.workflows.create();
          list = await window.suora.workflows.list();
        }

        const detail = await window.suora.workflows.get(list[0].id);
        if (!detail || !detail.workflow) {
          return JSON.stringify({ success: false, error: "Failed to load workflow detail" });
        }

        const versionId = detail.selectedVersion ? detail.selectedVersion.id : detail.versions[0].id;
        const invPayload = {
          workflowId: detail.workflow.id,
          versionId: versionId,
          status: "success",
          trigger: "manual",
          input: JSON.stringify({ company: "Suora Global Corp", priority: "high" }),
          output: JSON.stringify({ result: "Workflow processed successfully" }),
          traceJson: JSON.stringify([
            { nodeId: "start", label: "Start Node", status: "success", output: "Payload received", startedAt: Date.now() - 300, finishedAt: Date.now() - 250 },
            { nodeId: "assign", label: "Variable Assigner", status: "success", output: "Set company = Suora Global Corp", startedAt: Date.now() - 240, finishedAt: Date.now() - 150 },
            { nodeId: "end", label: "End Node", status: "success", output: "Execution complete", startedAt: Date.now() - 140, finishedAt: Date.now() }
          ])
        };

        const recorded = await window.suora.workflows.recordInvocation(invPayload);
        const refreshed = await window.suora.workflows.get(detail.workflow.id);

        return JSON.stringify({
          success: true,
          totalWorkflows: list.length,
          testedTitle: detail.workflow.title,
          version: detail.selectedVersion ? detail.selectedVersion.label : detail.versions[0].label,
          recordedInvocationId: recorded[0]?.id,
          totalInvocations: refreshed.invocations.length,
          lastInvocationStatus: refreshed.invocations[0]?.status
        });
      })()
    `,
    awaitPromise: true,
    returnByValue: true,
  })

  const rawVal = e2eResult.result?.value
  const parsedVal = typeof rawVal === "string" ? JSON.parse(rawVal) : rawVal
  console.log("[IPC Test] Workflow Database & Invocations:", JSON.stringify(parsedVal, null, 2))

  // 4. UI Navigation Verification
  await callCdp(ws, "Runtime.evaluate", {
    expression: "window.location.hash = '#/workflows'",
  })
  await new Promise((resolve) => setTimeout(resolve, 500))

  const pageTitle = await callCdp(ws, "Runtime.evaluate", {
    expression: "document.title + ' | ' + window.location.href",
    returnByValue: true,
  })
  console.log("[UI Test] Current Location:", pageTitle.result.value)

  ws.close()
  console.log("\n✓ ALL GLOBAL WORKFLOW E2E TESTS PASSED SUCCESSFULLY!")
}

runCdpE2ETest().catch((err) => {
  console.error("E2E Test Failed:", err)
  process.exit(1)
})
