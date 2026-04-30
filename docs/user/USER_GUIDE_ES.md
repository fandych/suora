# Guía del usuario de Suora

Esta guía se basa en la implementación actual del código. Describe lo que Suora puede hacer hoy y no lo que aparecía en planes antiguos o documentación desactualizada.

## 1. Qué es Suora

Suora es un entorno local de trabajo con IA. La aplicación actual no es solo una ventana de chat, sino un espacio de trabajo de escritorio con chat, documentos, modelos, agentes, habilidades, pipelines, temporizadores, canales, servidores MCP y ajustes.

Puede usar Suora para:

- ejecutar conversaciones diarias y tareas con distintos modelos
- delegar trabajo a agentes especializados en código, redacción, investigación, seguridad, datos y DevOps
- mantener un espacio local de documentos y adjuntar ese contexto al chat
- construir pipelines de varios pasos y ejecutarlos manualmente o por horario
- conectar plataformas de mensajería para que el asistente de escritorio responda mensajes entrantes

## 2. Instalación y primer inicio

### Requisitos

- entorno de escritorio en Windows, macOS o Linux
- Node.js 18+ al ejecutar desde el código fuente
- npm

### Ejecutar desde el código fuente

```bash
npm install
npm run dev
```

### Onboarding

En el primer inicio, Suora muestra un flujo de cinco pasos:

1. Welcome
2. Configure a Model Provider
3. Meet Your Agents
4. Explore Skills
5. You're All Set

Si lo omite, puede volver a lanzarlo desde `Settings -> System`.

## 3. Mapa del espacio de trabajo

| Módulo | Uso actual |
| --- | --- |
| Chat | Chat multi-sesión, cambio de agente o modelo, adjuntos y llamadas a herramientas |
| Documents | Grupos de documentos locales, carpetas, enlaces inversos y vista de grafo |
| Pipeline | Diseño y ejecución de flujos multiagente |
| Models | Configuración de proveedores, activación de modelos, pruebas de conexión y comparación |
| Agents | Gestión de agentes integrados y personalizados, pruebas, importación, exportación y versiones |
| Skills | Habilidades instaladas, exploración del registro y edición de `SKILL.md` |
| Timer | Programaciones únicas, por intervalo y Cron |
| Channels | Integraciones de mensajería y enrutamiento de respuestas |
| MCP | Configuración de servidores Model Context Protocol |
| Settings | Preferencias, seguridad, datos, registros y diagnóstico |

## 4. Flujo de chat

La experiencia actual de chat incluye:

- múltiples sesiones y pestañas
- selección de agente y modelo por sesión
- adjuntos de imagen, archivo y audio
- respuestas en streaming
- renderizado de markdown, bloques de código y matemáticas
- cronología y estado de llamadas a herramientas
- reintento de respuestas fallidas
- editar, borrar, fijar y ramificar mensajes
- feedback sobre respuestas del asistente
- lectura en voz alta de respuestas del asistente
- citas en línea

### Atajos que funcionan actualmente

- `Ctrl/Cmd + K`: abrir la paleta de comandos
- `Enter`: enviar mensaje
- `Shift + Enter`: nueva línea en el cuadro de entrada
- `Escape`: cerrar la paleta o los diálogos
- `Ctrl/Cmd + S`: guardar en el editor de documentos

### Paleta de comandos

La paleta puede saltar directamente a:

- sesiones
- documentos
- agentes
- habilidades
- modelos
- ajustes
- canales
- temporizadores
- MCP
- pipeline

## 5. Modelos y proveedores

La capa actual de proveedores admite:

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

### Lo que permite hoy el módulo Models

- añadir configuraciones de proveedor
- usar presets de proveedores
- introducir claves API y Base URL personalizada
- probar conectividad
- activar o desactivar modelos individuales
- ajustar `temperature` y `maxTokens` por modelo
- ver una lista de modelos habilitados
- comparar modelos en la vista Compare

Si usa Ollama, el endpoint local por defecto es `http://localhost:11434/v1`.

## 6. Agentes y habilidades

### Agentes integrados

- Assistant
- Code Expert
- Writing Strategist
- Research Analyst
- Security Auditor
- Data Analyst
- DevOps Expert

### Capacidades de agentes personalizados

El editor actual soporta:

- nombre, avatar, color y prompt del sistema
- asociación con modelo
- asignación de habilidades
- temperatura, máximo de turnos y estilo de respuesta
- listas de herramientas permitidas y bloqueadas
- autoaprendizaje
- importar, exportar y duplicar
- instantáneas de versión y restauración
- chat de prueba dentro del módulo Agents

### Capacidades del módulo Skills

El flujo actual de habilidades soporta:

- ver habilidades instaladas
- activar o desactivar habilidades
- editar `SKILL.md`
- explorar habilidades del registro
- vista previa de instalación antes de instalar
- añadir y gestionar fuentes de habilidades
- importar un archivo de habilidad
- importar una carpeta completa de habilidad
- exportar una habilidad como markdown o zip

Las habilidades también pueden cargarse automáticamente desde el workspace y desde directorios externos.

## 7. Documentos, pipelines y temporizadores

### Documents

El módulo Documents soporta actualmente:

- grupos de documentos
- carpetas anidadas
- documentos markdown
- diagramas Mermaid
- bloques matemáticos
- búsqueda de documentos
- backlinks y referencias
- vista de grafo
- uso de documentos seleccionados como contexto del chat

### Pipeline

El módulo Pipeline soporta actualmente:

- flujos multiagente por pasos
- reintentos y estrategias de backoff por paso
- timeouts por paso
- ejecución condicional con `runIf`
- transformaciones de salida y variables exportadas
- límites de duración total, tokens totales y número de pasos
- vista previa Mermaid y exportación del origen
- historial de ejecución y detalle de pasos
- guardar, importar y exportar

El chat también soporta comandos `/pipeline` como:

- `/pipeline list`
- `/pipeline run <name-or-id>`
- `/pipeline status`
- `/pipeline history <name-or-id>`
- `/pipeline cancel`

### Timer

Los tipos actuales de temporizador son:

- Once
- Interval
- Cron

Las acciones actuales son:

- notificación de escritorio
- ejecutar un prompt de agente
- ejecutar un pipeline guardado

## 8. Channels y MCP

### Plataformas de canal soportadas

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

### Lo que soporta hoy el módulo Channels

- transporte por webhook o stream
- asignar un agente de respuesta por canal
- activar o desactivar auto reply
- lista de chats permitidos
- historial de mensajes
- lista de usuarios rastreados
- vista de salud
- vista de depuración

### MCP

El módulo MCP se usa actualmente para:

- añadir configuraciones de servidor
- editar configuraciones de servidor
- revisar el estado de conexión
- exponer capacidades MCP a los agentes

## 9. Ajustes, seguridad y datos

Las secciones actuales de ajustes son:

- General
- Security
- Voice
- Shortcuts
- Data
- Logs
- System

### Funciones importantes actuales

- tema, idioma, fuentes y color de acento
- inicio automático
- configuración de proxy
- ajustes SMTP y prueba de conexión
- gestor de variables de entorno
- política de confirmación de herramientas
- modo sandbox del sistema de archivos
- lista de directorios permitidos
- patrones shell bloqueados
- preferencias de voz
- gestión de atajos
- importación y exportación
- política de retención
- registros e historial de fallos
- métricas de ejecución
- reiniciar onboarding

### API keys y almacenamiento seguro

La implementación actual intenta guardar primero las claves API en el almacenamiento seguro del sistema operativo.

Si el keyring del sistema no está disponible o falla el cifrado, Suora avisa de que:

- las claves permanecen solo en memoria
- hay que volver a introducirlas después de reiniciar

### Lo que incluye hoy la exportación

- agentes personalizados
- habilidades personalizadas
- todas las sesiones
- configuraciones de proveedores
- configuraciones de directorios externos

## 10. Resolución de problemas

### Falla la conexión del modelo

Compruebe en este orden:

1. la API key es válida
2. la Base URL coincide con el proveedor
3. al menos un modelo está habilitado
4. el proxy no está bloqueando la solicitud
5. la prueba de conexión en Models funciona

### Un canal no recibe mensajes

Compruebe en este orden:

1. el canal está habilitado
2. el agente de respuesta existe y está habilitado
3. el servidor local de canales está activo para canales webhook
4. la URL de callback de la plataforma coincide exactamente con la de Suora
5. el chat actual no está bloqueado por `allowedChats`
6. la vista Health o Debug no muestra error de credenciales

### Una habilidad no parece activa

Compruebe en este orden:

1. la habilidad está habilitada
2. la habilidad necesaria está asignada al agente
3. la habilidad fue importada al workspace actual o a un directorio externo
4. el contenido es un `SKILL.md` válido

### Un temporizador no se ejecuta

Compruebe en este orden:

1. el temporizador está habilitado
2. la expresión Cron es válida
3. el agente o pipeline de destino sigue existiendo
4. la aplicación de escritorio sigue en ejecución

## 11. Primera sesión recomendada

Si es nuevo en la compilación actual, este orden funciona bien:

1. añada un proveedor y active un modelo en `Models`
2. revise los agentes integrados en `Agents`
3. inicie su primera conversación en `Chat`
4. cree un grupo de documentos en `Documents`
5. guarde un flujo de dos o tres pasos en `Pipeline`
6. prográmelo desde `Timer`
7. configure `Channels` o `MCP` cuando el flujo local ya sea estable