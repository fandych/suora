# Documentación técnica de Suora

Este documento es una referencia técnica basada en la implementación actual del repositorio. Está dirigido a contribuidores y mantenedores y solo describe estructuras realmente presentes en el código.

## 1. Visión general del sistema

Suora es un workbench local de IA basado en Electron. Los módulos principales disponibles hoy son:

- Chat
- Documents
- Pipeline
- Models
- Agents
- Skills
- Timer
- Channels
- MCP
- Settings

La aplicación sigue un enfoque local-first. El estado del usuario, las sesiones, los árboles de documentos, la configuración de agentes, la configuración de modelos y gran parte de los metadatos de ejecución se almacenan localmente mediante una capa de persistencia respaldada por IPC.

## 2. Arquitectura de ejecución

El runtime se divide en tres capas.

| Capa | Responsabilidad |
| --- | --- |
| Electron Main Process | Gestiona sistema de archivos, ayudas de fetch de red, Secure Storage, shell, runtime de canales y handlers IPC |
| Preload Bridge | Expone una API `window.electron` basada en allowlist bajo context isolation |
| React Renderer | Renderiza la interfaz del workbench, mantiene el estado con Zustand y orquesta IA, documentos, pipelines, canales y ajustes |

El renderer usa un Hash Router y carga los módulos de funcionalidad de forma lazy.

### Rutas de nivel superior actuales

| Ruta | Módulo |
| --- | --- |
| `/chat` | Workbench de chat |
| `/documents` | Workbench de documentos |
| `/pipeline` | Editor de pipelines y historial de ejecución |
| `/models/:view` | Vistas de proveedores, modelos y comparación |
| `/agents` | Gestión de agentes |
| `/skills/:view` | Vistas de instaladas, exploración y fuentes |
| `/timer` | Gestión de temporizadores y agendas |
| `/channels` | Integraciones de mensajería |
| `/mcp` | Integraciones y configuración MCP |
| `/settings/:section` | Secciones de ajustes |

### Secciones de ajustes actuales

- `general`
- `security`
- `voice`
- `shortcuts`
- `data`
- `logs`
- `system`

## 3. Estructura del repositorio

El repositorio actual se organiza en torno a una shell Electron y una aplicación React agrupada por funcionalidades.

```text
electron/
  main.ts          proceso principal Electron y handlers IPC
  preload.ts       preload bridge aislado
  channelService.ts
  database.ts

src/
  App.tsx          arranque del router e inicialización global
  main.tsx         entrada del renderer
  index.css        tokens globales de tema y estilos UI
  components/      módulos funcionales y UI compartida
  hooks/           hooks React
  services/        AI, almacenamiento, i18n, pipelines, canales, documentos
  store/           store Zustand y slices
  types/           tipos compartidos

docs/
  user/            documentación de usuario
  technical/       referencias técnicas

e2e/
  pruebas end-to-end con Playwright
```

## 4. Stack tecnológico

| Área | Tecnología |
| --- | --- |
| Shell de escritorio | Electron 41 |
| Frontend | React 19 |
| Herramientas de build | Vite 6 + electron-vite 5 |
| Estilos | Tailwind CSS 4 |
| Estado | Zustand 5 |
| Lenguaje | TypeScript 5.8 |
| Runtime IA | Vercel AI SDK 6 |
| Pruebas unitarias | Vitest |
| Pruebas E2E | Playwright |

## 5. Modelo de estado de la aplicación

Suora utiliza un único store persistido de Zustand en `src/store/appStore.ts` para coordinar todo el estado del workbench.

### Principales dominios de estado

- sesiones y pestañas de chat
- documentos, carpetas y grupos de documentos
- modelos y configuraciones de proveedores
- agentes, memorias de agentes, versiones de agentes y estadísticas de rendimiento
- skills, versiones de skills y fuentes externas
- pipelines y metadatos de ejecución
- temporizadores
- canales, salud de canales, usuarios, historial y tokens
- notificaciones
- configuración y estado de servidores MCP
- preferencias UI como tema, idioma, tamaño de fuente y color de acento

### Alcance actual de importación y exportación

- agentes personalizados
- skills personalizadas
- todas las sesiones
- configuraciones de proveedores
- configuración de directorios externos

## 6. Capa de modelos y servicio de IA

La integración de IA reside en `src/services/aiService.ts`.

### Proveedores soportados actualmente

- Anthropic
- OpenAI
- Google
- Ollama
- DeepSeek
- Zhipu
- MiniMax
- Groq
- Together AI
- Fireworks
- Perplexity
- Cohere
- endpoints compatibles con OpenAI

### Responsabilidades del servicio de IA

- validar la configuración del modelo
- inicializar y cachear clientes por identidad de proveedor, clave API y base URL
- clasificar errores de red y proveedor
- generar respuestas de texto normales
- producir respuestas en streaming en un bucle multi-paso con herramientas

### Tipos actuales de eventos de streaming

- `text-delta`
- `tool-call`
- `tool-result`
- `tool-error`
- `finish-step`
- `usage`
- `error`

## 7. Sistema de agentes y skills

### Agentes integrados actuales

- Assistant
- Code Expert
- Writing Strategist
- Research Analyst
- Security Auditor
- Data Analyst
- DevOps Expert

### Modelo de agente

El tipo `Agent` actual incluye:

- `systemPrompt`
- `modelId`
- `skills`
- `temperature`
- `maxTokens`
- `maxTurns`
- `responseStyle`
- `allowedTools`
- `disallowedTools`
- `permissionMode`
- `memories`
- `autoLearn`

Por tanto, los agentes de Suora no son solo prompts predefinidos. También incluyen comportamiento de enrutamiento, restricciones de herramientas y memoria.

### Modelo de skills

El sistema actual de skills se basa en paquetes de capacidad orientados por prompts. Hoy soporta:

- listado de skills instaladas
- exploración de registro
- gestión de fuentes
- edición y vista previa de `SKILL.md`
- importación de un archivo individual
- importación de una carpeta completa
- exportación como markdown o zip
- gestión de árboles de recursos junto a `SKILL.md`

Los comentarios del código y el comportamiento actual de la UI distinguen claramente dos capas: las herramientas integradas siguen viniendo del sistema de herramientas, mientras que las skills añaden instrucciones especializadas y recursos empaquetados.

## 8. Documents, pipelines y temporizadores

### Documents

El módulo Documents soporta actualmente:

- grupos de documentos
- carpetas anidadas
- documentos markdown
- renderizado Mermaid
- renderizado matemático
- backlinks y referencias
- búsqueda de documentos
- vista de grafo
- selección de documentos como contexto de chat

### Pipeline

El módulo Pipeline soporta actualmente:

- workflows multiagente por pasos
- reintentos y estrategias de backoff
- timeouts por paso
- ejecución condicional con `runIf`
- transformaciones de salida y exportación de variables
- límites de duración total, tokens y número de pasos
- vista previa Mermaid y exportación del source
- historial de ejecución y detalle de pasos
- guardar, importar y exportar

La capa de chat también soporta comandos `/pipeline` para listar, ejecutar, revisar estado, leer historial y cancelar pipelines guardados.

### Timer

Tipos actuales de temporizador:

- `Once`
- `Interval`
- `Cron`

Acciones actualmente soportadas:

- notificación de escritorio
- ejecutar un prompt de agente
- ejecutar un pipeline guardado

## 9. Channels y MCP

### Plataformas de canales

La superficie actual de `ChannelPlatform` soporta:

- WeChat Work
- WeChat Official Account
- WeChat Mini Program
- Feishu / Lark
- DingTalk
- Slack
- Telegram
- Discord
- Microsoft Teams
- Custom channels

### Comportamiento actual de canales

- transporte webhook o stream
- un reply agent por canal
- auto-reply activado o desactivado
- allowlist de chats
- historial de mensajes
- lista de usuarios
- panel de salud
- panel de depuración

### MCP

El módulo de integraciones ofrece actualmente:

- configuración de servidores
- seguimiento del estado de conexión
- integración de capacidades MCP en la ejecución de agentes

## 10. Modelo IPC y de seguridad

Suora mantiene context isolation en Electron y enruta las operaciones privilegiadas a través del preload bridge.

### Principales características de seguridad actuales

- el renderer no accede directamente a APIs de Node.js
- el preload solo expone una superficie invoke/on/send basada en allowlist
- los fallos de secure storage se muestran como advertencias en la UI
- el acceso al sistema de archivos puede sandboxarse
- el usuario puede definir directorios permitidos
- se pueden bloquear patrones shell peligrosos
- la ejecución de herramientas puede requerir confirmación previa

### Comportamiento actual de Secure Storage

La aplicación intenta primero guardar las claves API en el almacenamiento seguro del sistema operativo. Si ese almacenamiento no está disponible o falla el cifrado, la UI advierte que las claves quedan solo en memoria y deben volver a introducirse tras reiniciar.

## 11. Tema UI, internacionalización, build y pruebas

### Tema y preferencias

El renderer usa un sistema compartido de tokens de tema en `src/index.css` y hooks como `useTheme`. Los ejes de preferencia soportados actualmente son:

- tema claro, oscuro o del sistema
- tamaño de fuente
- fuente de código
- color de acento
- idioma

El modo de tema por defecto es actualmente `system`.

### Idiomas integrados actualmente

- English
- Chinese
- Japanese
- Korean
- French
- German
- Spanish
- Portuguese
- Russian
- Arabic

### Comandos de desarrollo habituales

```bash
npm install
npm run dev
npm run build
npm run preview
npm run package
npm run lint
npm run type-check
npm run test:run
npm run test:e2e
```

### Cobertura de pruebas visible actualmente

- comportamiento del preload de Electron
- utilidades de almacenamiento
- UI de onboarding
- comportamiento del editor de skills
- flujos de marketplace y skill registry
- hooks de tema
- helpers de base de datos
- recorridos smoke con Playwright

## 12. Notas de mantenimiento

Cuando actualice la documentación técnica de este repositorio, priorice siempre hechos respaldados por el código sobre descripciones heredadas. Los anclajes más fiables son:

- las rutas reales en `src/App.tsx`
- los agentes integrados reales en `src/store/appStore.ts`
- los tipos reales de proveedores en `src/services/aiService.ts`
- las secciones reales de ajustes en `src/components/settings/SettingsLayout.tsx`

Salvo que haya verificado el código justo antes, evite fijar en la documentación números sensibles al drift como el total de canales IPC o el total de herramientas.