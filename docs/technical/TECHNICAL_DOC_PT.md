# Suora �?Documentação Técnica

> Uma aplicação de desktop inteligente baseada em Electron com suporte a múltiplos modelos, agentes inteligentes, sistema de habilidades, gerenciamento de memória e arquitetura de plugins.

## Sumário

1. [Visão geral da arquitetura](#1-visão-geral-da-arquitetura)
2. [Estrutura do projeto](#2-estrutura-do-projeto)
3. [Pilha tecnológica](#3-pilha-tecnológica)
4. [Sistema de build](#4-sistema-de-build)
5. [Gerenciamento de estado](#5-gerenciamento-de-estado)
6. [Camada de serviço de IA](#6-camada-de-serviço-de-ia)
7. [Sistema de habilidades / ferramentas](#7-sistema-de-habilidades--ferramentas)
8. [Sistema de internacionalização](#8-sistema-de-internacionalização)
9. [Sistema de memória](#9-sistema-de-memória)
10. [Comunicação IPC](#10-comunicação-ipc)
11. [Arquitetura de segurança](#11-arquitetura-de-segurança)
12. [Sistema de plugins](#12-sistema-de-plugins)
13. [Integração de canais](#13-integração-de-canais)
14. [Testes](#14-testes)
15. [CI/CD e publicação](#15-cicd-e-publicação)
16. [Guia de desenvolvimento](#16-guia-de-desenvolvimento)
17. [Referência da API](#17-referência-da-api)

---

## 1. Visão geral da arquitetura

```
┌───────────────────────────────────────────────────────�?
�?                  Electron Shell                      �?
�?                                                      �?
�? ┌─────────────�? IPC (68 canais)     ┌────────────�? �?
�? │Processo     │◄───────────────────►│  Renderer   �? �?
�? │principal    �? ponte preload       �?(React 19)  �? �?
�? �?(Node.js)   �?                     �?            �? �?
�? │�?Handlers   �?                     │�?Zustand 5  �? �?
�? �? IPC        �?                     │�?AI SDK 6   �? �?
�? │�?E/S arq.   �?                     │�?Ferrament. �? �?
�? │�?Exec shell �?                     │�?Router     �? �?
�? │�?Email SMTP �?                     │�?Tailwind 4 �? �?
�? │�?Logger     �?                     �?            �? �?
�? └─────────────�?                     └────────────�? �?
�?       �? contextIsolation: true            �?        �?
�?       └──────── Preload (preload.ts) ──────�?        �?
�?             window.electron.invoke/on/send            �?
└───────────────────────────────────────────────────────�?
```

- **Processo principal** (`electron/main.ts`) �?possui a `BrowserWindow`; gerencia todas as operações no nível do sistema operacional (sistema de arquivos, shell, área de transferência, SMTP, temporizadores, automação de navegador) através de handlers IPC.
- **Script de pré-carregamento** (`electron/preload.ts`) �?contexto isolado que expõe uma lista de permissões de 68 canais IPC por meio de `contextBridge.exposeInMainWorld('electron', ...)`.
- **Renderer** (`src/`) �?aplicação React 19 de página única empacotada pelo Vite 6, estado via Zustand 5, IA via Vercel AI SDK 6 e acesso ao sistema operacional pela ponte preload.

---

## 2. Estrutura do projeto

```
src/
├── App.tsx                  # React Router (8 rotas)
├── index.css                # Tokens @theme do Tailwind (escuro/claro)
├── store/appStore.ts        # Estado global Zustand (versão 12)
├── services/
�?  ├── aiService.ts         # Integração IA multi-provedor
�?  ├── tools.ts             # 18 categorias de habilidades, 42+ ferramentas
�?  ├── i18n.ts              # Tradução para 10 idiomas (~910 chaves)
�?  ├── fileStorage.ts       # Persistência JSON via IPC + cache
�?  ├── voiceInteraction.ts  # API Web Speech (STT/TTS)
�?  └── logger.ts            # Encaminhamento de logs Renderer �?main
├── hooks/
�?  ├── useI18n.ts           # Hook de tradução
�?  └── useTheme.ts          # Hook de tema/destaque/fonte
├── components/              # Componentes React organizados por funcionalidade
├── types/index.ts           # Interfaces TypeScript compartilhadas
└── test/setup.ts            # Configuração do Vitest

electron/
├── main.ts                  # Processo principal, handlers IPC, SMTP, atualizador
├── preload.ts               # Ponte isolada por contexto (68 canais)
└── logger.ts                # RotatingLogger (~/.suora/logs)
```

**Saídas de build:** `out/main/` (ESM) · `out/preload/` (CJS) · `out/renderer/` (SPA) · `dist/` (instaladores)

---

## 3. Pilha tecnológica

| Camada | Tecnologia | Versão |
|--------|-----------|--------|
| Desktop | Electron | 41.x |
| Frontend | React | 19.2 |
| Empacotador | Vite + electron-vite | 6.0 + 5.0 |
| Estilização | Tailwind CSS | 4.2 |
| Estado | Zustand | 5.0 |
| SDK de IA | Vercel AI SDK (`ai`) | 6.0 |
| Linguagem | TypeScript | 5.8+ |
| Roteador | React Router | 7.x |
| Validação | Zod | 4.x |
| E-mail | nodemailer | 8.x |
| HTTP/WS | Express 5 + ws 8 | �?|
| Empacotamento | electron-builder | 26.x |
| Testes | Vitest 4.x + Playwright 1.58 | �?|

**Pacotes de provedores de IA:** `@ai-sdk/anthropic`, `@ai-sdk/openai`, `@ai-sdk/google-vertex`, `@ai-sdk/openai-compatible` (para Ollama, DeepSeek, Groq, Together, Fireworks, Perplexity, Cohere, Zhipu, MiniMax e endpoints personalizados).

---

## 4. Sistema de build

Três alvos de build definidos em `electron.vite.config.ts`:

| Alvo | Entrada | Saída | Formato |
|------|---------|-------|---------|
| Main | `electron/main.ts` | `out/main/` | ESM |
| Preload | `electron/preload.ts` | `out/preload/` | CJS |
| Renderer | `index.html` | `out/renderer/` | SPA |

O renderer utiliza `@vitejs/plugin-react` + `@tailwindcss/vite`, com o alias de caminho `@` �?`./src`, e o servidor de desenvolvimento em `127.0.0.1:5173` (porta estrita).

| Comando | Descrição |
|---------|-----------|
| `npm run dev` | Electron + servidor de desenvolvimento Vite com substituição de módulos a quente (HMR) |
| `npm run build` | Build de produção (os três alvos) |
| `npm run package` | Build + electron-builder (NSIS/DMG/AppImage) |

**Alvos do electron-builder:** Windows (NSIS + portável), macOS (DMG + ZIP), Linux (AppImage + DEB + RPM).

---

## 5. Gerenciamento de estado

Um único store Zustand com middleware `persist` apoiado em armazenamento de arquivos via IPC.

**Nome do store:** `suora-store` · **Versão:** 12 · **Backend:** `~/.suora/data/`

### Segmentos de estado principais

| Segmento | Campos-chave |
|----------|-------------|
| Sessões | `sessions`, `activeSessionId`, `openSessionTabs` |
| Agentes | `agents`, `selectedAgent`, `agentPerformance`, `agentVersions` |
| Modelos | `providerConfigs`, `globalModels`, `modelUsageStats` |
| Habilidades | `skills`, `pluginTools`, `skillVersions` |
| Memória | `globalMemories` |
| Segurança | `toolSecurity` (diretórios permitidos, comandos bloqueados, confirmação) |
| Aparência | `theme`, `fontSize`, `codeFont`, `accentColor`, `bubbleStyle`, `locale` |
| Canais | `channelConfigs`, `channelMessages`, `channelTokens`, `channelHealth` |
| Plugins | `installedPlugins` |
| E-mail | `emailConfig` (SMTP) |

### Fluxo de persistência

```
Zustand �?adaptador fileStateStorage �?IPC (store:load/save/remove) �?~/.suora/data/*.json
```

Um cache `Map` em memória permite leituras síncronas por meio de `readCached()`/`writeCached()`. No primeiro carregamento, o adaptador verifica o armazenamento de arquivos, recorre ao `localStorage` (migração) e depois armazena em cache.

### Migrações (Versão 1 �?12)

v2: memória de agente, ferramentas de habilidades · v3: valores padrão de `toolSecurity` · v5: `workspacePath` · v7: migração de `providerConfigs` de Record para Array · v8: confirmação desabilitada por padrão · v9: `globalMemories`, preenchimento retroativo do escopo de memória · v10: canais, plugins, locale, agente, onboarding · v11: `pluginTools`, `skillVersions` · v12: `emailConfig`

---

## 6. Camada de serviço de IA

As instâncias de provedor são armazenadas em cache pela chave `${providerId}:${apiKey}:${baseUrl}`.

### Provedores suportados (13+)

Anthropic e OpenAI utilizam seus pacotes SDK nativos. Todos os outros provedores utilizam `@ai-sdk/openai-compatible` com URLs base pré-configuradas (Google �?`generativelanguage.googleapis.com`, Ollama �?`localhost:11434/v1`, DeepSeek, Groq, Together, Fireworks, Perplexity, Cohere, Zhipu, MiniMax ou personalizado).

### Funções principais

```ts
validateModelConfig(model): { valid: boolean; error?: string }
initializeProvider(providerType, apiKey, baseUrl?, providerId?): void
testConnection(providerType, apiKey, baseUrl, modelId): Promise<{ success; error?; latency? }>
generateResponse(modelId, messages, systemPrompt?): Promise<string>
streamResponseWithTools(model, messages, tools, systemPrompt?, maxSteps?): AsyncGenerator<AppStreamEvent[]>
```

### Eventos de streaming

`text-delta` · `tool-call` · `tool-result` · `tool-error` · `finish-step` · `usage` · `error`

As chamadas de ferramentas são executadas em um loop de múltiplas etapas (máximo padrão de 20 etapas, `toolChoice: 'auto'`).

---

## 7. Sistema de habilidades / ferramentas

### 18 habilidades integradas

| ID da habilidade | Ferramentas (exemplos) |
|-----------------|----------------------|
| `builtin-filesystem` | `list_dir`, `read_file`, `write_file`, `search_files`, `copy_file`, `move_file`, `stat_file` |
| `builtin-shell` | `shell` (bash no Unix, PowerShell no Windows) |
| `builtin-web` | `web_search` (DuckDuckGo), `fetch_webpage` |
| `builtin-utilities` | `get_current_time`, `parse_json`, `generate_uuid` |
| `builtin-todo` | `list_todos`, `add_todo`, `update_todo`, `delete_todo` |
| `builtin-timer` | `list_timers`, `create_timer`, `update_timer`, `delete_timer` |
| `builtin-memory` | `search_memory`, `add_memory` |
| `builtin-browser` | `browser_navigate`, `browser_screenshot`, `browser_evaluate`, `browser_click`, `browser_fill_form` |
| `builtin-agent-comm` | `send_agent_message`, `broadcast_agent_message` |
| `builtin-event-automation` | `register_event_trigger`, `trigger_event` |
| `builtin-self-evolution` | `create_agent_memory`, `update_skill_description` |
| `builtin-file-attachment` | `analyze_image_attachment`, `save_attachment` |
| `builtin-git` | `git_exec` |
| `builtin-code-analysis` | `analyze_code`, `suggest_refactoring` |
| `builtin-advanced-interaction` | `send_persistent_message`, `request_user_input` |
| `builtin-channels` | `channel_send_message`, `channel_read_message` |
| `builtin-email` | `send_email` |
| `builtin-system-management` | `get_system_info`, `read_clipboard`, `write_clipboard`, `notify`, `take_screenshot` |

### Registro de ferramentas

```ts
import { tool } from 'ai'
import { z } from 'zod'

export const builtinToolDefs: ToolSet = {
  list_dir: tool({
    description: 'Listar arquivos e diretórios',
    inputSchema: z.object({ path: z.string() }),
    execute: async ({ path }) => { /* chamada IPC */ },
  }),
}
```

Funções: `registerTools()`, `getToolsForSkills(skillIds)`, `buildToolSet()`, `getCustomToolsFromSkill()`, `getPluginTools()`.

As habilidades podem ser instaladas a partir do marketplace (registro oficial ou privado, controlado pela configuração `marketplace` do store).

---

## 8. Sistema de internacionalização

**10 idiomas:** en · zh · ja · ko · fr · de · es · pt · ru · ar (~910 chaves por idioma)

```ts
import { useI18n } from '@/hooks/useI18n'
const { t } = useI18n()
t('chat.send')  // Tradução conforme a localidade
```

**Namespaces principais:** `nav.*`, `chat.*`, `agents.*`, `skills.*`, `models.*`, `settings.*`, `channels.*`, `common.*`, `onboarding.*`

**Cadeia de fallback:** localidade atual �?inglês �?fallback fornecido �?chave bruta.

**Adicionar um idioma:** (1) adicionar o código ao tipo `AppLocale`, (2) adicionar o mapa de tradução em `i18n.ts`, (3) adicionar a opção na interface de configurações.

---

## 9. Sistema de memória

| Nível | Escopo | Limite | Persistência |
|-------|--------|--------|--------------|
| Curto prazo | Por sessão | 100 itens | Apenas durante a vida da sessão |
| Longo prazo | Global | Ilimitado | `globalMemories` no store |
| Vetorial | Global | Ilimitado | Ferramentas `search_memory`/`add_memory` |

```ts
interface AgentMemoryEntry {
  id: string; content: string; type: string;     // 'fact', 'preference', 'context'
  scope: 'session' | 'global'; createdAt: number; source?: string;
}
```

Agentes com `autoLearn: true` persistem automaticamente os fatos por meio da habilidade `builtin-self-evolution`.

---

## 10. Comunicação IPC

**67 canais invoke** (requisição-resposta) · **1 canal send** (`app:ready`) · **6 canais on** (eventos)

### Ponte preload

```ts
window.electron.invoke(channel, ...args): Promise<unknown>  // Lista de permissões; lança erro em canais desconhecidos
window.electron.on(channel, listener): void                  // Lista de permissões; ignorado silenciosamente caso contrário
window.electron.send(channel, ...args): void                 // Lista de permissões; ignorado silenciosamente caso contrário
```

### Índice de canais

| Categoria | Canais |
|-----------|--------|
| Sistema de arquivos | `fs:listDir`, `fs:readFile`, `fs:readFileRange`, `fs:writeFile`, `fs:deleteFile`, `fs:editFile`, `fs:searchFiles`, `fs:moveFile`, `fs:copyFile`, `fs:stat`, `fs:watch:start`, `fs:watch:stop` |
| Shell | `shell:exec`, `shell:openUrl` |
| Web | `web:search`, `web:fetch` |
| Navegador | `browser:navigate`, `browser:screenshot`, `browser:evaluate`, `browser:extractLinks`, `browser:extractText`, `browser:fillForm`, `browser:click` |
| Área de transferência | `clipboard:read`, `clipboard:write` |
| Temporizadores | `timer:list`, `timer:create`, `timer:update`, `timer:delete`, `timer:history` |
| Store | `store:load`, `store:save`, `store:remove` |
| Armazenamento seguro | `safe-storage:encrypt`, `safe-storage:decrypt`, `safe-storage:isAvailable` |
| Sistema | `system:getDefaultWorkspacePath`, `system:ensureDirectory`, `system:info`, `system:notify`, `system:screenshot` |
| Canais | `channel:start/stop/status/register`, `channel:getWebhookUrl`, `channel:sendMessage`, `channel:sendMessageQueued`, `channel:getAccessToken`, `channel:healthCheck`, `channel:debugSend` |
| E-mail | `email:send`, `email:test` |
| Atualizador | `updater:check`, `updater:getVersion` |
| Registro | `log:write` |
| Outros | `app:setAutoStart`, `app:getAutoStart`, `deep-link:getProtocol`, `crash:report/getLogs/clearLogs`, `perf:getMetrics` |

**Canais de eventos:** `timer:fired`, `channel:message`, `fs:watch:changed`, `app:update`, `updater:available`, `deep-link`

---

## 11. Arquitetura de segurança

| Medida | Detalhes |
|--------|---------|
| `nodeIntegration` | `false` �?sem Node.js no renderer |
| `contextIsolation` | `true` �?contextos JavaScript separados |
| Lista de permissões IPC | 68 canais; canais desconhecidos lançam erro ou são ignorados silenciosamente |
| Validação de caminhos | `ensureAllowedPath()` verifica contra `allowedDirectories` com correspondência estrita de prefixo |
| Comandos bloqueados | `ensureCommandAllowed()` rejeita `rm -rf`, `del /f /q`, `format`, `shutdown` |
| Confirmação | Confirmação opcional do usuário antes da execução de uma ferramenta |
| Armazenamento seguro | Criptografia do chaveiro do SO (DPAPI / Keychain / libsecret) para chaves de API |
| Integridade de habilidades | Somas de verificação SHA-256; histórico de versões (`skillVersions`, máx. 500 entradas) |
| Registro de auditoria | `RotatingLogger` �?10 MB/arquivo, 5 arquivos/dia, retenção de 7 dias |

---

## 12. Sistema de plugins

```ts
interface PluginInfo {
  id: string; name: string; version: string;
  description: string; enabled: boolean; config: Record<string, unknown>;
}
```

Os plugins são armazenados em `appStore.installedPlugins` e podem registrar ferramentas por meio do mapeamento `pluginTools` (`Record<string, string[]>` �?ID do plugin �?nomes de ferramentas). Em tempo de execução, `getPluginTools()` mescla as ferramentas do plugin no conjunto de ferramentas disponível.

**Pontos de extensão:** novas ferramentas (via `pluginTools`), novas habilidades (`type: 'marketplace'`), conectores de canais (`ChannelConfig`), provedores de IA personalizados (`ProviderConfig` compatível com OpenAI).

---

## 13. Integração de canais

As plataformas externas (Slack, Discord, Telegram, personalizada) se conectam por meio de um servidor webhook Express executado no processo principal.

```
Plataforma �?Webhook HTTP �?Processo principal (Express) �?evento channel:message �?Renderer/IA �?channel:sendMessage �?Plataforma
```

```ts
interface ChannelConfig {
  id: string; platform: 'slack' | 'discord' | 'telegram' | 'custom';
  name: string; token?: string; webhookUrl?: string; enabled: boolean;
}
```

A saúde é monitorada por meio do store `channelHealth`. Os agentes podem interagir programaticamente utilizando a habilidade `builtin-channels`.

---

## 14. Testes

### Testes unitários (Vitest)

Configuração: ambiente `jsdom`, globais habilitadas, padrão `src/**/*.{test,spec}.{ts,tsx}`, limiares de cobertura (linhas 8%, funções 5%, branches 5%).

```bash
npm run test          # Modo observação
npm run test:run      # Execução única
npm run test:coverage # Com cobertura v8
```

### Testes ponta a ponta (Playwright)

Configuração: apenas Chromium, URL base `localhost:5173`, início automático do servidor de desenvolvimento (timeout 120 s), tentativas 0 localmente / 2 em CI.

```bash
npm run test:e2e      # Executar testes ponta a ponta
npm run test:e2e:ui   # Interface do Playwright
```

---

## 15. CI/CD e publicação

### Fluxo de trabalho de testes (`test.yml`) �?em push ou pull request para `main`/`develop`

- Job **Test**: lint �?verificação de tipos �?testes unitários �?upload de cobertura (Codecov) �?Node 20.x e 22.x, Ubuntu
- Job **Build**: build �?empacotamento �?upload de artefatos (7 dias) �?Ubuntu/Windows/macOS, Node 22.x

### Fluxo de trabalho de publicação (`release.yml`) �?acionado na criação de uma release no GitHub

Compila e envia os instaladores por plataforma: `.AppImage`/`.deb`/`.rpm` (Linux), `.exe`/`.msi` (Windows), `.dmg`/`.zip` (macOS), além dos metadados `latest-*.yml`.

**Atualizador automático:** provedor GitHub do electron-builder; `updater:check` consulta a última release na inicialização.

---

## 16. Guia de desenvolvimento

### Configuração inicial

```bash
git clone https://github.com/fandych/suora.git && cd suora
npm install
npm run dev    # Electron + HMR
```

### Adicionar uma funcionalidade

1. Definir tipos em `src/types/index.ts`
2. Adicionar estado/ações em `appStore.ts`; incrementar a versão e adicionar migração
3. Implementar a lógica em `src/services/`
4. Construir componentes em `src/components/`; extrair hooks para `src/hooks/`
5. Registrar a rota em `App.tsx` se necessário
6. Adicionar chaves i18n para todos os 10 idiomas

### Adicionar um provedor de IA

Adicionar um caso em `aiService.ts �?initializeProvider()` com a fábrica SDK e a URL base padrão, depois adicionar a interface na página de modelos. Testar com `testConnection()`.

### Adicionar uma ferramenta

```ts
// src/services/tools.ts
my_tool: tool({
  description: 'Faz alguma coisa',
  inputSchema: z.object({ input: z.string() }),
  execute: async ({ input }) => {
    return JSON.stringify(await window.electron.invoke('my:channel', input))
  },
})
```

Se a ferramenta requer acesso ao sistema operacional: adicionar um handler IPC em `electron/main.ts` e adicionar o canal à lista de permissões em `electron/preload.ts`.

### Convenções

- Alias de caminho `@` para todas as importações · preferir `window.electron.invoke()` em vez das APIs do Node · esquemas Zod para entradas de ferramentas · tokens Tailwind `@theme` para novos estilos

---

## 17. Referência da API

### Ações do store (subconjunto principal)

```ts
addSession(session) / updateSession(id, data) / removeSession(id)
addAgent(agent) / updateAgent(id, data) / removeAgent(id)
addSkill(skill) / removeSkill(id)
setProviderConfigs(configs: ProviderConfig[])
recordModelUsage(modelId, promptTokens, completionTokens)
recordAgentPerformance(agentId, responseTimeMs, tokens, isError?)
addChannelMessage(msg) / clearChannelMessages(channelId?)
addInstalledPlugin(plugin) / updateInstalledPlugin(id, data) / removeInstalledPlugin(id)
setTheme(mode) / setLocale(locale) / setEmailConfig(config)
```

### Armazenamento de arquivos

```ts
fileStateStorage.getItem(name): Promise<string | null>
fileStateStorage.setItem(name, value): void
fileStateStorage.removeItem(name): void
readCached(name): string | null      // Síncrono, a partir do cache em memória
writeCached(name, value): void       // Cache + salvamento IPC assíncrono
```

### Ponte IPC (lado do renderer)

```ts
await window.electron.invoke('fs:readFile', path)
await window.electron.invoke('shell:exec', command)
await window.electron.invoke('email:send', { to, subject, body })
window.electron.on('timer:fired', (event, timer) => { ... })
window.electron.on('channel:message', (event, msg) => { ... })
```

### Agentes integrados

| Agente | ID | Habilidades-chave |
|--------|----|-------------------|
| Assistente | `default-assistant` | Todas as 18 habilidades |
| Especialista em código | `builtin-code-expert` | git, code-analysis, filesystem, shell |
| Escritor | `builtin-writer` | filesystem, web, utilities, memory |
| Pesquisador | `builtin-researcher` | web, browser, filesystem, memory |
| Analista de dados | `builtin-data-analyst` | filesystem, shell, utilities, code-analysis |
| Engenheiro DevOps | `builtin-devops` | shell, filesystem, system-management, git |
| Gerente de produto | `builtin-product-manager` | web, browser, utilities, channels |
| Tradutor | `builtin-translator` | web, utilities |
| Especialista em segurança | `builtin-security` | filesystem, shell, git, code-analysis |

---

*Última atualização: 2025*
