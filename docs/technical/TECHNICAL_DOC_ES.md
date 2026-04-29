# Suora �?Documentación Técnica

> Una aplicación de escritorio inteligente basada en Electron con soporte multimodelo, agentes inteligentes, sistema de habilidades, gestión de memoria y arquitectura de plugins.

## Tabla de contenidos

1. [Visión general de la arquitectura](#1-visión-general-de-la-arquitectura)
2. [Estructura del proyecto](#2-estructura-del-proyecto)
3. [Pila tecnológica](#3-pila-tecnológica)
4. [Sistema de compilación](#4-sistema-de-compilación)
5. [Gestión de estado](#5-gestión-de-estado)
6. [Capa de servicio de IA](#6-capa-de-servicio-de-ia)
7. [Sistema de habilidades / herramientas](#7-sistema-de-habilidades--herramientas)
8. [Sistema de internacionalización](#8-sistema-de-internacionalización)
9. [Sistema de memoria](#9-sistema-de-memoria)
10. [Comunicación IPC](#10-comunicación-ipc)
11. [Arquitectura de seguridad](#11-arquitectura-de-seguridad)
12. [Sistema de plugins](#12-sistema-de-plugins)
13. [Integración de canales](#13-integración-de-canales)
14. [Pruebas](#14-pruebas)
15. [CI/CD y publicación](#15-cicd-y-publicación)
16. [Guía de desarrollo](#16-guía-de-desarrollo)
17. [Referencia de API](#17-referencia-de-api)

---

## 1. Visión general de la arquitectura

```
┌───────────────────────────────────────────────────────�?
�?                  Electron Shell                      �?
�?                                                      �?
�? ┌─────────────�? IPC (68 canales)    ┌────────────�? �?
�? │Proceso      │◄───────────────────►│  Renderer   �? �?
�? │principal    �? puente preload      �?(React 19)  �? �?
�? �?(Node.js)   �?                     �?            �? �?
�? │�?Handlers   �?                     │�?Zustand 5  �? �?
�? �? IPC        �?                     │�?AI SDK 6   �? �?
�? │�?E/S arch.  �?                     │�?Herram.    �? �?
�? │�?Exec shell �?                     │�?Router     �? �?
�? │�?Email SMTP �?                     │�?Tailwind 4 �? �?
�? │�?Logger     �?                     �?            �? �?
�? └─────────────�?                     └────────────�? �?
�?       �? contextIsolation: true            �?        �?
�?       └──────── Preload (preload.ts) ──────�?        �?
�?             window.electron.invoke/on/send            �?
└───────────────────────────────────────────────────────�?
```

- **Proceso principal** (`electron/main.ts`) �?posee la `BrowserWindow`; gestiona todas las operaciones a nivel del sistema operativo (sistema de archivos, shell, portapapeles, SMTP, temporizadores, automatización del navegador) mediante handlers IPC.
- **Script de precarga** (`electron/preload.ts`) �?contexto aislado que expone una lista blanca de 68 canales IPC a través de `contextBridge.exposeInMainWorld('electron', ...)`.
- **Renderer** (`src/`) �?aplicación React 19 de una sola página empaquetada por Vite 6, estado mediante Zustand 5, IA mediante Vercel AI SDK 6 y acceso al sistema operativo a través del puente preload.

---

## 2. Estructura del proyecto

```
src/
├── App.tsx                  # React Router (8 rutas)
├── index.css                # Tokens @theme de Tailwind (oscuro/claro)
├── store/appStore.ts        # Estado global Zustand (versión 18)
├── services/
�?  ├── aiService.ts         # Integración IA multiproveedor
�?  ├── tools.ts             # 18 categorías de habilidades, 42+ herramientas
�?  ├── i18n.ts              # Traducción a 10 idiomas (~910 claves)
�?  ├── fileStorage.ts       # Persistencia JSON respaldada por IPC + caché
�?  ├── voiceInteraction.ts  # API Web Speech (STT/TTS)
�?  └── logger.ts            # Reenvío de logs Renderer �?main
├── hooks/
�?  ├── useI18n.ts           # Hook de traducción
�?  └── useTheme.ts          # Hook de tema/acento/fuente
├── components/              # Componentes React organizados por funcionalidad
├── types/index.ts           # Interfaces TypeScript compartidas
└── test/setup.ts            # Configuración de Vitest

electron/
├── main.ts                  # Proceso principal, handlers IPC, SMTP, actualizador
├── preload.ts               # Puente aislado por contexto (68 canales)
└── logger.ts                # RotatingLogger (~/.suora/logs)
```

**Salidas de compilación:** `out/main/` (ESM) · `out/preload/` (CJS) · `out/renderer/` (SPA) · `dist/` (instaladores)

---

## 3. Pila tecnológica

| Capa | Tecnología | Versión |
|------|-----------|---------|
| Escritorio | Electron | 41.x |
| Frontend | React | 19.2 |
| Empaquetador | Vite + electron-vite | 6.0 + 5.0 |
| Estilos | Tailwind CSS | 4.2 |
| Estado | Zustand | 5.0 |
| SDK de IA | Vercel AI SDK (`ai`) | 6.0 |
| Lenguaje | TypeScript | 5.8+ |
| Enrutador | React Router | 7.x |
| Validación | Zod | 4.x |
| Correo | nodemailer | 8.x |
| HTTP/WS | Express 5 + ws 8 | �?|
| Empaquetado | electron-builder | 26.x |
| Pruebas | Vitest 4.x + Playwright 1.58 | �?|

**Paquetes de proveedores de IA:** `@ai-sdk/anthropic`, `@ai-sdk/openai`, `@ai-sdk/google-vertex`, `@ai-sdk/openai-compatible` (para Ollama, DeepSeek, Groq, Together, Fireworks, Perplexity, Cohere, Zhipu, MiniMax y endpoints personalizados).

---

## 4. Sistema de compilación

Tres objetivos de compilación definidos en `electron.vite.config.ts`:

| Objetivo | Entrada | Salida | Formato |
|----------|---------|--------|---------|
| Main | `electron/main.ts` | `out/main/` | ESM |
| Preload | `electron/preload.ts` | `out/preload/` | CJS |
| Renderer | `index.html` | `out/renderer/` | SPA |

El renderer utiliza `@vitejs/plugin-react` + `@tailwindcss/vite`, con el alias de ruta `@` �?`./src`, y el servidor de desarrollo en `127.0.0.1:5173` (puerto estricto).

| Comando | Descripción |
|---------|-------------|
| `npm run dev` | Electron + servidor de desarrollo Vite con reemplazo de módulos en caliente (HMR) |
| `npm run build` | Compilación de producción (los tres objetivos) |
| `npm run package` | Compilación + electron-builder (NSIS/DMG/AppImage) |

**Objetivos de electron-builder:** Windows (NSIS + portable), macOS (DMG + ZIP), Linux (AppImage + DEB + RPM).

---

## 5. Gestión de estado

Un único store de Zustand con middleware `persist` respaldado por almacenamiento de archivos IPC.

**Nombre del store:** `suora-store` · **Versión:** 18 · **Backend:** `{workspace}/`

### Segmentos de estado principales

| Segmento | Campos clave |
|----------|-------------|
| Sesiones | `sessions`, `activeSessionId`, `openSessionTabs` |
| Agentes | `agents`, `selectedAgent`, `agentPerformance`, `agentVersions` |
| Modelos | `providerConfigs`, `globalModels`, `modelUsageStats` |
| Habilidades | `skills`, `pluginTools`, `skillVersions` |
| Memoria | `globalMemories` |
| Seguridad | `toolSecurity` (directorios permitidos, comandos bloqueados, confirmación) |
| Apariencia | `theme`, `fontSize`, `codeFont`, `accentColor`, `bubbleStyle`, `locale` |
| Canales | `channelConfigs`, `channelMessages`, `channelTokens`, `channelHealth` |
| Plugins | `installedPlugins` |
| Correo | `emailConfig` (SMTP) |

### Flujo de persistencia

```
Zustand �?adaptador fileStateStorage �?IPC (db:loadPersistedStore / db:savePersistedStore) �?{workspace}/{settings,models}.json + sessions/, agents/, channels/, …
```

Un caché `Map` en memoria permite lecturas síncronas mediante `readCached()`/`writeCached()`. En la primera carga, el adaptador verifica el almacenamiento de archivos, recurre a `localStorage` (migración) y luego almacena en caché.

### Migraciones (Versión 1 �?18)

v2: memoria de agente, herramientas de habilidades · v3: valores predeterminados de `toolSecurity` · v5: `workspacePath` · v7: migración de `providerConfigs` de Record a Array · v8: confirmación deshabilitada por defecto · v9: `globalMemories`, relleno retroactivo del ámbito de memoria · v10: canales, plugins, locale, agente, incorporación · v11: `pluginTools`, `skillVersions` · v12: `emailConfig`

---

## 6. Capa de servicio de IA

Las instancias de proveedor se almacenan en caché por clave `${providerId}:${apiKey}:${baseUrl}`.

### Proveedores compatibles (13+)

Anthropic y OpenAI utilizan sus paquetes SDK nativos. Todos los demás proveedores utilizan `@ai-sdk/openai-compatible` con URLs base preconfiguradas (Google �?`generativelanguage.googleapis.com`, Ollama �?`localhost:11434/v1`, DeepSeek, Groq, Together, Fireworks, Perplexity, Cohere, Zhipu, MiniMax o personalizado).

### Funciones principales

```ts
validateModelConfig(model): { valid: boolean; error?: string }
initializeProvider(providerType, apiKey, baseUrl?, providerId?): void
testConnection(providerType, apiKey, baseUrl, modelId): Promise<{ success; error?; latency? }>
generateResponse(modelId, messages, systemPrompt?): Promise<string>
streamResponseWithTools(model, messages, tools, systemPrompt?, maxSteps?): AsyncGenerator<AppStreamEvent[]>
```

### Eventos de streaming

`text-delta` · `tool-call` · `tool-result` · `tool-error` · `finish-step` · `usage` · `error`

Las llamadas a herramientas se ejecutan en un bucle de múltiples pasos (máximo predeterminado de 20 pasos, `toolChoice: 'auto'`).

---

## 7. Sistema de habilidades / herramientas

### 18 habilidades integradas

| ID de habilidad | Herramientas (ejemplos) |
|-----------------|------------------------|
| `builtin-filesystem` | `list_dir`, `read_file`, `write_file`, `search_files`, `copy_file`, `move_file`, `stat_file` |
| `builtin-shell` | `shell` (bash en Unix, PowerShell en Windows) |
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

### Registro de herramientas

```ts
import { tool } from 'ai'
import { z } from 'zod'

export const builtinToolDefs: ToolSet = {
  list_dir: tool({
    description: 'Listar archivos y directorios',
    inputSchema: z.object({ path: z.string() }),
    execute: async ({ path }) => { /* llamada IPC */ },
  }),
}
```

Funciones: `registerTools()`, `getToolsForSkills(skillIds)`, `buildToolSet()`, `getCustomToolsFromSkill()`, `getPluginTools()`.

Las habilidades pueden instalarse desde el marketplace (registro oficial o privado, controlado mediante la configuración `marketplace` del store).

---

## 8. Sistema de internacionalización

**10 idiomas:** en · zh · ja · ko · fr · de · es · pt · ru · ar (~910 claves por idioma)

```ts
import { useI18n } from '@/hooks/useI18n'
const { t } = useI18n()
t('chat.send')  // Traducción según la configuración regional
```

**Espacios de nombres principales:** `nav.*`, `chat.*`, `agents.*`, `skills.*`, `models.*`, `settings.*`, `channels.*`, `common.*`, `onboarding.*`

**Cadena de respaldo:** configuración regional actual �?inglés �?respaldo proporcionado �?clave sin traducir.

**Añadir un idioma:** (1) agregar el código al tipo `AppLocale`, (2) agregar la tabla de traducción en `i18n.ts`, (3) agregar la opción en la interfaz de configuración.

---

## 9. Sistema de memoria

| Nivel | Ámbito | Límite | Persistencia |
|-------|--------|--------|--------------|
| Corto plazo | Por sesión | 100 elementos | Solo durante la vida de la sesión |
| Largo plazo | Global | Ilimitada | `globalMemories` en el store |
| Vectorial | Global | Ilimitada | Herramientas `search_memory`/`add_memory` |

```ts
interface AgentMemoryEntry {
  id: string; content: string; type: string;     // 'fact', 'preference', 'context'
  scope: 'session' | 'global'; createdAt: number; source?: string;
}
```

Los agentes con `autoLearn: true` persisten automáticamente los hechos mediante la habilidad `builtin-self-evolution`.

---

## 10. Comunicación IPC

**67 canales invoke** (solicitud-respuesta) · **1 canal send** (`app:ready`) · **6 canales on** (eventos)

### Puente preload

```ts
window.electron.invoke(channel, ...args): Promise<unknown>  // Lista blanca; lanza error en canales desconocidos
window.electron.on(channel, listener): void                  // Lista blanca; se ignora silenciosamente en caso contrario
window.electron.send(channel, ...args): void                 // Lista blanca; se ignora silenciosamente en caso contrario
```

### Índice de canales

| Categoría | Canales |
|-----------|---------|
| Sistema de archivos | `fs:listDir`, `fs:readFile`, `fs:readFileRange`, `fs:writeFile`, `fs:deleteFile`, `fs:editFile`, `fs:searchFiles`, `fs:moveFile`, `fs:copyFile`, `fs:stat`, `fs:watch:start`, `fs:watch:stop` |
| Shell | `shell:exec`, `shell:openUrl` |
| Web | `web:search`, `web:fetch` |
| Navegador | `browser:navigate`, `browser:screenshot`, `browser:evaluate`, `browser:extractLinks`, `browser:extractText`, `browser:fillForm`, `browser:click` |
| Portapapeles | `clipboard:read`, `clipboard:write` |
| Temporizadores | `timer:list`, `timer:create`, `timer:update`, `timer:delete`, `timer:history` |
| Store | `db:getSnapshot`, `db:loadPersistedStore`, `db:savePersistedStore`, `db:listEntities`, `db:saveEntity`, `db:deleteEntity` |
| Almacenamiento seguro | `safe-storage:encrypt`, `safe-storage:decrypt`, `safe-storage:isAvailable` |
| Sistema | `system:getDefaultWorkspacePath`, `system:ensureDirectory`, `system:info`, `system:notify`, `system:screenshot` |
| Canales | `channel:start/stop/status/register`, `channel:getWebhookUrl`, `channel:sendMessage`, `channel:sendMessageQueued`, `channel:getAccessToken`, `channel:healthCheck`, `channel:debugSend` |
| Correo | `email:send`, `email:test` |
| Actualizador | `updater:check`, `updater:getVersion` |
| Registro | `log:write` |
| Otros | `app:setAutoStart`, `app:getAutoStart`, `deep-link:getProtocol`, `crash:report/getLogs/clearLogs`, `perf:getMetrics` |

**Canales de eventos:** `timer:fired`, `channel:message`, `fs:watch:changed`, `app:update`, `updater:available`, `deep-link`

---

## 11. Arquitectura de seguridad

| Medida | Detalles |
|--------|---------|
| `nodeIntegration` | `false` �?sin Node.js en el renderer |
| `contextIsolation` | `true` �?contextos JavaScript separados |
| Lista blanca IPC | 68 canales; los canales desconocidos lanzan error o se ignoran silenciosamente |
| Validación de rutas | `ensureAllowedPath()` verifica contra `allowedDirectories` con coincidencia estricta de prefijo |
| Comandos bloqueados | `ensureCommandAllowed()` rechaza `rm -rf`, `del /f /q`, `format`, `shutdown` |
| Confirmación | Confirmación opcional del usuario antes de la ejecución de una herramienta |
| Almacenamiento seguro | Cifrado del llavero del SO (DPAPI / Keychain / libsecret) para claves API |
| Integridad de habilidades | Sumas de verificación SHA-256; historial de versiones (`skillVersions`, máx. 500 entradas) |
| Registro de auditoría | `RotatingLogger` �?10 MB/archivo, 5 archivos/día, retención de 7 días |

---

## 12. Sistema de plugins

```ts
interface PluginInfo {
  id: string; name: string; version: string;
  description: string; enabled: boolean; config: Record<string, unknown>;
}
```

Los plugins se almacenan en `appStore.installedPlugins` y pueden registrar herramientas mediante el mapeo `pluginTools` (`Record<string, string[]>` �?ID del plugin �?nombres de herramientas). En tiempo de ejecución, `getPluginTools()` fusiona las herramientas del plugin en el conjunto de herramientas disponible.

**Puntos de extensión:** nuevas herramientas (vía `pluginTools`), nuevas habilidades (`type: 'marketplace'`), conectores de canales (`ChannelConfig`), proveedores de IA personalizados (`ProviderConfig` compatible con OpenAI).

---

## 13. Integración de canales

Las plataformas externas (Slack, Discord, Telegram, personalizada) se conectan mediante un servidor webhook Express que se ejecuta en el proceso principal.

```
Plataforma �?Webhook HTTP �?Proceso principal (Express) �?evento channel:message �?Renderer/IA �?channel:sendMessage �?Plataforma
```

```ts
interface ChannelConfig {
  id: string; platform: 'slack' | 'discord' | 'telegram' | 'custom';
  name: string; token?: string; webhookUrl?: string; enabled: boolean;
}
```

El estado se monitorea a través del store `channelHealth`. Los agentes pueden interactuar programáticamente utilizando la habilidad `builtin-channels`.

---

## 14. Pruebas

### Pruebas unitarias (Vitest)

Configuración: entorno `jsdom`, globales habilitadas, patrón `src/**/*.{test,spec}.{ts,tsx}`, umbrales de cobertura (líneas 8 %, funciones 5 %, ramas 5 %).

```bash
npm run test          # Modo vigilancia
npm run test:run      # Ejecución única
npm run test:coverage # Con cobertura v8
```

### Pruebas de extremo a extremo (Playwright)

Configuración: solo Chromium, URL base `localhost:5173`, inicio automático del servidor de desarrollo (timeout 120 s), reintentos 0 en local / 2 en CI.

```bash
npm run test:e2e      # Ejecutar pruebas de extremo a extremo
npm run test:e2e:ui   # Interfaz de Playwright
```

---

## 15. CI/CD y publicación

### Flujo de trabajo de pruebas (`test.yml`) �?en push o pull request a `main`/`develop`

- Job **Test**: lint �?verificación de tipos �?pruebas unitarias �?carga de cobertura (Codecov) �?Node 20.x y 22.x, Ubuntu
- Job **Build**: compilación �?empaquetado �?carga de artefactos (7 días) �?Ubuntu/Windows/macOS, Node 22.x

### Flujo de trabajo de publicación (`release.yml`) �?activado al crear una release en GitHub

Compila y carga los instaladores por plataforma: `.AppImage`/`.deb`/`.rpm` (Linux), `.exe`/`.msi` (Windows), `.dmg`/`.zip` (macOS), además de los metadatos `latest-*.yml`.

**Actualización automática:** proveedor GitHub de electron-builder; `updater:check` consulta la última release al inicio.

---

## 16. Guía de desarrollo

### Configuración inicial

```bash
git clone https://github.com/fandych/suora.git && cd suora
npm install
npm run dev    # Electron + HMR
```

### Añadir una funcionalidad

1. Definir tipos en `src/types/index.ts`
2. Añadir estado/acciones en `appStore.ts`; incrementar la versión y agregar migración
3. Implementar la lógica en `src/services/`
4. Construir componentes en `src/components/`; extraer hooks a `src/hooks/`
5. Registrar la ruta en `App.tsx` si es necesario
6. Añadir claves i18n para los 10 idiomas

### Añadir un proveedor de IA

Agregar un caso en `aiService.ts �?initializeProvider()` con la fábrica SDK y la URL base predeterminada, luego añadir la interfaz en la página de modelos. Probar con `testConnection()`.

### Añadir una herramienta

```ts
// src/services/tools.ts
my_tool: tool({
  description: 'Hace algo',
  inputSchema: z.object({ input: z.string() }),
  execute: async ({ input }) => {
    return JSON.stringify(await window.electron.invoke('my:channel', input))
  },
})
```

Si la herramienta requiere acceso al sistema operativo: agregar un handler IPC en `electron/main.ts` y añadir el canal a la lista blanca en `electron/preload.ts`.

### Convenciones

- Alias de ruta `@` para todas las importaciones · preferir `window.electron.invoke()` sobre las API de Node · esquemas Zod para las entradas de herramientas · tokens Tailwind `@theme` para nuevos estilos

---

## 17. Referencia de API

### Acciones del store (subconjunto principal)

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

### Almacenamiento de archivos

```ts
fileStateStorage.getItem(name): Promise<string | null>
fileStateStorage.setItem(name, value): void
fileStateStorage.removeItem(name): void
readCached(name): string | null      // Síncrono, desde la caché en memoria
writeCached(name, value): void       // Caché + guardado IPC asíncrono
```

### Puente IPC (lado del renderer)

```ts
await window.electron.invoke('fs:readFile', path)
await window.electron.invoke('shell:exec', command)
await window.electron.invoke('email:send', { to, subject, body })
window.electron.on('timer:fired', (event, timer) => { ... })
window.electron.on('channel:message', (event, msg) => { ... })
```

### Agentes integrados

| Agente | ID | Habilidades clave |
|--------|----|-------------------|
| Asistente | `default-assistant` | Las 18 habilidades |
| Experto en código | `builtin-code-expert` | git, code-analysis, filesystem, shell |
| Escritor | `builtin-writer` | filesystem, web, utilities, memory |
| Investigador | `builtin-researcher` | web, browser, filesystem, memory |
| Analista de datos | `builtin-data-analyst` | filesystem, shell, utilities, code-analysis |
| Ingeniero DevOps | `builtin-devops` | shell, filesystem, system-management, git |
| Gerente de producto | `builtin-product-manager` | web, browser, utilities, channels |
| Traductor | `builtin-translator` | web, utilities |
| Especialista en seguridad | `builtin-security` | filesystem, shell, git, code-analysis |

---

*Última actualización: 2025*
