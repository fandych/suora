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
  const raw = result.result?.value
  return typeof raw === "string" ? JSON.parse(raw) : raw
}

async function testFullChainSetup() {
  const targets = await (await fetch("http://127.0.0.1:9222/json/list")).json()
  const page = targets.find((t) => t.type === "page")
  if (!page) throw new Error("No Electron page found on 9222")

  const ws = new WebSocket(page.webSocketDebuggerUrl)
  await new Promise((r) => ws.on("open", r))
  console.log("[CDP] Connected to Electron mainWindow:", page.webSocketDebuggerUrl)

  const testScript = `
    (async () => {
      const suora = window.suora;

      // 1. Get Azure model provider configured by user
      const providers = await suora.models.list();
      const azureP = providers.find(p => p.providerType === "azure" || p.id === "62fc1296-023f-4637-9622-a23e3eb21428");
      if (!azureP) return JSON.stringify({ error: "Azure provider not found" });

      // 2. Test creating Skill
      const skillCreated = await suora.skills.create();
      await suora.skills.save({
        id: skillCreated.skill.id,
        title: "Test Skill Retail",
        source: "custom",
        summary: "Retail refund guidelines",
        filesJson: JSON.stringify([{ path: "SKILL.md", content: "# Retail Skill Guidelines\\nFollow strict refund rules.", kind: "file", executable: false, language: "markdown" }])
      });

      // 3. Test creating Document
      const docCreated = await suora.documents.create();
      await suora.documents.save({
        id: docCreated.document.id,
        title: "Retail Policy Manual",
        summary: "Refund policy document",
        structureJson: JSON.stringify({ pages: [{ id: "p1", title: "Refund Policy", content: "Orders within 30 days are eligible for instant refund." }] }),
        graphJson: JSON.stringify({ edges: [] }),
        settingsJson: JSON.stringify({ isPublic: false, includeInLlmsTxt: true })
      });

      // 4. Test creating Integration
      const intCreated = await suora.integrations.create();
      await suora.integrations.save({
        id: intCreated.integration.id,
        title: "Retail Refund API",
        kind: "http",
        endpoint: "GET https://jsonplaceholder.typicode.com/todos/1",
        configJson: JSON.stringify({
          kind: "http",
          baseUrl: "https://jsonplaceholder.typicode.com",
          method: "GET",
          url: "https://jsonplaceholder.typicode.com/todos/1",
          description: "Fetch order refund status",
          selectedEndpointId: "ep1",
          endpoints: [{ id: "ep1", name: "Check Order", method: "GET", path: "/todos/1", bodyMode: "json", headersJson: "{}", queryJson: "{}", bodyJson: "{}", parameterSchemaJson: "{}", parameters: [] }],
          headersJson: "{}",
          queryJson: "{}",
          bodyJson: "{}",
          authType: "none",
          authConfigJson: "{}",
          parameterSchemaJson: "{}"
        })
      });

      // 5. Test creating Workflow
      const wfCreated = await suora.workflows.create();
      await suora.workflows.save({
        id: wfCreated.workflow.id,
        title: "Retail Order Flow",
        summary: "Process retail order refund flow",
        definitionJson: JSON.stringify({
          viewport: { x: 0, y: 0, zoom: 1 },
          nodes: [
            { id: "s1", position: { x: 50, y: 100 }, data: { kind: "start", label: "Start" } },
            { id: "e1", position: { x: 300, y: 100 }, data: { kind: "end", label: "End" } }
          ],
          edges: [{ id: "edge1", source: "s1", target: "e1" }],
          dryRunInputJson: "{}",
          variables: [],
          budget: { maxSteps: 10, maxDurationMs: 60000 }
        })
      });

      // 6. Test creating Agent linking all above
      const agentCreated = await suora.agents.create();
      await suora.agents.save({
        id: agentCreated.agent.id,
        title: "Retail Refund Agent",
        kind: "custom",
        summary: "Handles retail refunds using policy document and API",
        configJson: JSON.stringify({
          instructions: "You are a Retail Refund Agent. Check policy documents and API tools to answer customer refund questions.",
          providerId: azureP.id,
          modelId: "gpt-5.4",
          maxSteps: 20,
          workflowIds: [wfCreated.workflow.id],
          skillIds: [skillCreated.skill.id],
          toolsetIds: [intCreated.integration.id],
          documentIds: [docCreated.document.id]
        })
      });

      // 7. Test creating Chat linking Agent
      const chatCreated = await suora.chats.create();
      await suora.chats.ensure({
        chatId: chatCreated.chat.id,
        title: "Retail Refund Inquiry",
        chatbotId: agentCreated.agent.id,
        summary: "Customer refund question"
      });

      await suora.chats.appendUser({
        chatId: chatCreated.chat.id,
        content: "What is the refund policy for retail orders within 30 days?"
      });

      return JSON.stringify({
        agentId: agentCreated.agent.id,
        chatId: chatCreated.chat.id,
        skillId: skillCreated.skill.id,
        docId: docCreated.document.id,
        intId: intCreated.integration.id,
        wfId: wfCreated.workflow.id
      });
    })()
  `;

  const res = await evalInElectron(ws, testScript);
  console.log("=== FULL CHAIN SINGLE TEST RESULT ===");
  console.log(res);
  ws.close();
}

testFullChainSetup().catch((err) => {
  console.error("Setup Error:", err)
  process.exit(1)
})
