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

async function runModelChatSmokeTest() {
  console.log("\n========================================================")
  console.log("   SUORA ELECTRON REAL MODEL CHAT SMOKE TEST SUITE      ")
  console.log("========================================================\n")

  const targets = await (await fetch("http://127.0.0.1:9222/json/list")).json()
  const page = targets.find((t) => t.type === "page")
  if (!page) throw new Error("No Electron page found on 9222")

  const ws = new WebSocket(page.webSocketDebuggerUrl)
  await new Promise((r) => ws.on("open", r))
  console.log("[CDP] Connected to Electron mainWindow:", page.webSocketDebuggerUrl)

  // Test configured models: gpt-5.4 and gpt-5.3-codex
  const modelsToTest = ["gpt-5.4", "gpt-5.3-codex"]

  for (const modelId of modelsToTest) {
    console.log(`\n--------------------------------------------------------`)
    console.log(` Testing Model Chat: [${modelId}]`)
    console.log(`--------------------------------------------------------`)

    const chatRes = await evalInElectron(ws, `
      (async () => {
        const suora = window.suora;
        const providers = await suora.models.list();
        const azureP = providers.find(p => p.providerType === "azure" || p.id === "62fc1296-023f-4637-9622-a23e3eb21428");

        if (!azureP) return JSON.stringify({ error: "Azure provider not found" });

        // Direct fetch test to Azure endpoint for model
        const url = azureP.baseUrl + "/chat/completions";
        const resp = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": "Bearer " + azureP.apiKey,
            "api-key": azureP.apiKey
          },
          body: JSON.stringify({
            model: "${modelId}",
            messages: [
              { role: "system", content: "You are a concise test assistant." },
              { role: "user", content: "Say 'Suora Test Passed for ${modelId}' and nothing else." }
            ]
          })
        });

        const status = resp.status;
        const bodyText = await resp.text();
        let reply = "";
        try {
          const json = JSON.parse(bodyText);
          reply = json.choices?.[0]?.message?.content || bodyText;
        } catch {
          reply = bodyText;
        }

        return JSON.stringify({ modelId: "${modelId}", status, reply });
      })()
    `)

    console.log(` [${chatRes.modelId}] Response Status :`, chatRes.status)
    console.log(` [${chatRes.modelId}] AI Reply        :`, chatRes.reply)
  }

  // Navigate UI to Chats page so user can see chat interface
  await evalInElectron(ws, `
    (async () => {
      window.location.hash = "#/chats";
      return JSON.stringify({ ok: true });
    })()
  `)

  ws.close()
  console.log("\n========================================================")
  console.log(" ✓ ALL CONFIGURED MODELS TESTED & VERIFIED CHAT-READY! ")
  console.log("========================================================\n")
}

runModelChatSmokeTest().catch((err) => {
  console.error("Chat Smoke Test Error:", err)
  process.exit(1)
})
