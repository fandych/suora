# Suora �?Guía del Usuario

## Tabla de contenidos

1. [Introducción](#introducción)
2. [Instalación](#instalación)
3. [Primeros pasos](#primeros-pasos)
4. [Chat](#chat)
5. [Modelos de IA](#modelos-de-ia)
6. [Agentes](#agentes)
7. [Habilidades](#habilidades)
8. [Temporizadores y programación](#temporizadores-y-programación)
9. [Canales](#canales)
10. [Ajustes](#ajustes)
11. [Base de conocimiento y memoria](#base-de-conocimiento-y-memoria)
12. [Seguridad y privacidad](#seguridad-y-privacidad)
13. [Atajos de teclado](#atajos-de-teclado)
14. [Resolución de problemas](#resolución-de-problemas)
15. [Preguntas frecuentes](#preguntas-frecuentes)

---

## Introducción

Suora es una aplicación de escritorio con inteligencia artificial construida sobre Electron. Ofrece soporte multi-modelo —Anthropic Claude, OpenAI GPT, Google Vertex AI, entre otros�? agentes inteligentes, un sistema extensible de habilidades, gestión de memoria a corto y largo plazo, y una arquitectura de plugins diseñada para integraciones externas.

La aplicación es multiplataforma y funciona en **Windows**, **macOS** y **Linux**. Su objetivo es proporcionar un asistente de IA potente y personalizable directamente en el escritorio, sin depender del navegador.

### Características principales

- **Multi-modelo**: alterne entre distintos proveedores de IA según la tarea.
- **Agentes especializados**: perfiles preconfigurados para programación, escritura, investigación y más.
- **Sistema de habilidades**: herramientas que los agentes pueden ejecutar (sistema de archivos, shell, web, Git, etc.).
- **Memoria inteligente**: contexto conversacional a corto plazo y conocimiento persistente a largo plazo.
- **Plugins y canales**: integración con WeChat, Feishu, DingTalk y servicios externos.

---

## Instalación

### Descarga directa

Descargue la versión más reciente desde la página de [GitHub Releases](https://github.com) del proyecto:

| Sistema operativo | Formato              |
|-------------------|----------------------|
| Windows           | `.exe` (instalador)  |
| macOS             | `.dmg`               |
| Linux             | `.AppImage` / `.deb` |

Ejecute el instalador y siga las instrucciones en pantalla. En Linux, es posible que necesite otorgar permisos de ejecución al archivo `.AppImage`:

```bash
chmod +x suora-*.AppImage
./suora-*.AppImage
```

### Compilación desde fuentes

Si prefiere compilar la aplicación usted mismo, necesitará **Node.js 18+** y **Git**:

```bash
git clone https://github.com/<org>/suora.git
cd suora
npm install
npm run build
npm run package
```

El ejecutable resultante se encontrará en el directorio `dist/`.

---

## Primeros pasos

Al iniciar Suora por primera vez, se mostrará un **asistente de configuración** de cinco pasos:

1. **Bienvenida** �?Presentación general de la aplicación.
2. **Proveedor de modelos** �?Configure al menos un proveedor de IA e introduzca su clave API.
3. **Agentes** �?Conozca los agentes integrados y sus especialidades.
4. **Habilidades** �?Explore las herramientas disponibles que los agentes pueden utilizar.
5. **Listo** �?La configuración ha finalizado; puede comenzar a usar la aplicación.

> **Nota:** puede omitir el asistente en cualquier momento y configurar estos ajustes más adelante desde el panel de **Ajustes**.

---

## Chat

La interfaz de chat es el núcleo de la aplicación. Admite **múltiples sesiones** simultáneas, cada una con su propio historial y contexto.

### Controles básicos

- **Nuevo chat**: `Ctrl+N` (o `Cmd+N` en macOS).
- **Enviar mensaje**: `Enter`.
- **Nueva línea sin enviar**: `Shift+Enter`.
- **Paleta de comandos**: `Ctrl+K` para acceder rápidamente a acciones.
- **Entrada por voz**: `Ctrl+Shift+V` para dictar mensajes.

### Funcionalidades del chat

- **Respuestas en streaming**: las respuestas se muestran en tiempo real a medida que el modelo las genera.
- **Renderizado Markdown**: las respuestas incluyen resaltado de sintaxis en bloques de código, tablas y formato enriquecido.
- **Indicadores de herramientas**: cuando un agente ejecuta una habilidad, se muestra su estado:
  - �?Pendiente
  - �?Ejecutando
  - �?Éxito
  - �?Error
- **Valoración de mensajes**: utilice 👍 y 👎 para valorar las respuestas y mejorar el aprendizaje del agente.
- **Consumo de tokens**: cada respuesta muestra la cantidad de tokens utilizados.
- **Archivos adjuntos**: arrastre archivos a la ventana de chat o utilice el botón de adjuntar para incluir documentos en la conversación.

---

## Modelos de IA

Suora es compatible con múltiples proveedores de IA. Puede configurar varios simultáneamente y alternar entre ellos según la tarea.

### Proveedores soportados

| Proveedor             | Descripción                                      |
|-----------------------|--------------------------------------------------|
| **Anthropic**         | Claude 3 Opus, Sonnet, Haiku                     |
| **OpenAI**            | GPT-4o, GPT-4, GPT-3.5 Turbo                    |
| **Google Vertex AI**  | Gemini Pro, Gemini Ultra                         |
| **Ollama**            | Modelos locales (Llama, Mistral, CodeLlama, etc.)|
| **DeepSeek**          | DeepSeek Coder, DeepSeek Chat                    |
| **Groq**              | Inferencia de alta velocidad                     |
| **Together AI**       | Modelos de código abierto alojados               |
| **Fireworks AI**      | Inferencia optimizada                            |
| **Perplexity**        | Búsqueda aumentada con IA                        |
| **Cohere**            | Command, Embed                                   |
| **Compatible OpenAI** | Cualquier API compatible con el formato de OpenAI|

### Añadir un proveedor

1. Abra **Ajustes �?Proveedores**.
2. Pulse **Añadir proveedor**.
3. Seleccione el proveedor e introduzca su **clave API**.
4. Pulse **Probar conexión** para verificar que la configuración es correcta.
5. Guarde los cambios.

Cada modelo permite ajustar individualmente la **temperatura** (creatividad de las respuestas) y el número **máximo de tokens** por respuesta.

---

## Agentes

Los agentes son perfiles especializados que combinan un prompt de sistema, un estilo de respuesta y un conjunto de habilidades. Suora incluye **9 agentes integrados**:

| Agente                     | Temperatura | Especialidad                          |
|----------------------------|:-----------:|---------------------------------------|
| 🤖 Asistente General       | 0.7         | Tareas generales y conversación       |
| 🧑‍�?Experto en Código       | 0.5         | Programación y depuración             |
| ✍️ Escritor                 | 0.8         | Redacción y contenido creativo        |
| 📚 Investigador            | 0.6         | Búsqueda y síntesis de información    |
| 📊 Analista de Datos       | 0.5         | Análisis y visualización de datos     |
| 🚀 Ingeniero DevOps        | 0.4         | Infraestructura y despliegue          |
| 🛡�?Auditor de Seguridad    | 0.3         | Revisión de seguridad y vulnerabilidades |
| 🌐 Traductor               | 0.3         | Traducción entre idiomas              |
| 📱 Product Manager         | 0.6         | Gestión de producto y requisitos      |

### Agentes personalizados

Puede crear sus propios agentes configurando:

- **Nombre** e icono identificativo.
- **Prompt de sistema**: instrucciones base que definen el comportamiento del agente.
- **Estilo de respuesta**: conciso, equilibrado o detallado.
- **Temperatura**: valor entre 0 y 1 que controla la creatividad.
- **Habilidades asignadas**: seleccione qué herramientas puede utilizar el agente.

Los agentes incorporan **aprendizaje automático**: a partir de las valoraciones que usted otorgue a sus respuestas, el agente ajusta su comportamiento progresivamente.

---

## Habilidades

Las habilidades son herramientas que los agentes pueden invocar para realizar acciones concretas. Suora ofrece **más de 18 categorías**:

- **Sistema de archivos** �?Leer, escribir, listar y manipular archivos y directorios.
- **Shell** �?Ejecutar comandos del sistema operativo.
- **Herramientas web** �?Realizar solicitudes HTTP, consultar APIs.
- **Utilidades** �?Portapapeles, notificaciones del sistema, capturas de pantalla, información del sistema.
- **Tareas** �?Gestión de listas de tareas pendientes.
- **Temporizadores** �?Programar acciones diferidas o periódicas.
- **Memoria** �?Almacenar y recuperar conocimiento persistente.
- **Automatización del navegador** �?Navegar y manipular páginas web.
- **Comunicación entre agentes** �?Permitir que los agentes colaboren entre sí.
- **Automatización de eventos** �?Reaccionar ante eventos del sistema.
- **Auto-evolución** �?El agente mejora sus propias capacidades con el uso.
- **Adjuntos** �?Procesar documentos e imágenes adjuntos.
- **Git** �?Operaciones de control de versiones.
- **Análisis de código** �?Revisión estática y sugerencias de mejora.
- **Interacción avanzada** �?Diálogos complejos y flujos multi-paso.
- **Canales** �?Envío y recepción de mensajes a plataformas externas.
- **Correo electrónico** �?Envío de correos vía SMTP.
- **Gestión del sistema** �?Monitoreo de recursos y procesos.

Puede **activar o desactivar** cada habilidad desde **Ajustes �?Habilidades**. Además, el **Marketplace** permite descargar e instalar habilidades creadas por la comunidad.

---

## Temporizadores y programación

Los temporizadores permiten programar acciones que se ejecutan de forma automática.

### Tipos de temporizador

| Tipo        | Descripción                                          | Ejemplo                            |
|-------------|------------------------------------------------------|------------------------------------|
| **Único**   | Se ejecuta una sola vez en una fecha y hora concretas | «El 15 de marzo a las 09:00»      |
| **Intervalo** | Se repite cada N minutos/horas                     | «Cada 30 minutos»                 |
| **Cron**    | Expresión Cron para programación avanzada             | `0 9 * * 1-5` (lunes a viernes, 9:00) |

### Acciones disponibles

- **Notificación**: muestra una notificación del sistema.
- **Prompt de agente**: envía un mensaje automático a un agente específico.

### Referencia rápida de expresiones Cron

```
┌───────────── minuto (0-59)
�?┌───────────── hora (0-23)
�?�?┌───────────── día del mes (1-31)
�?�?�?┌───────────── mes (1-12)
�?�?�?�?┌───────────── día de la semana (0-6, domingo=0)
�?�?�?�?�?
* * * * *
```

---

## Canales

Los canales permiten conectar Suora con plataformas de mensajería externas.

### Plataformas soportadas

- **WeChat** (Work/Enterprise)
- **Feishu** (Lark)
- **DingTalk**

### Configuración

Para cada canal necesitará:

1. **App ID** y **App Secret** de la plataforma correspondiente.
2. **Token de verificación** para validar las solicitudes entrantes.
3. **Clave de cifrado** para la comunicación segura.
4. Modo de conexión: **Webhook** (HTTP callback) o **Stream** (conexión persistente).

### Funcionalidades

- **Auto-respuesta**: los agentes responden automáticamente a los mensajes recibidos.
- **Tipos de mensajes**: texto, imágenes, archivos, tarjetas interactivas.
- **Monitoreo de salud**: panel de estado que muestra la conectividad y latencia de cada canal.

---

## Ajustes

### General

- **Tema**: claro, oscuro o sincronizado con el sistema.
- **Idioma**: selección del idioma de la interfaz.
- **Inicio automático**: abrir Suora al iniciar sesión en el sistema operativo.
- **Guardado automático**: guardar las sesiones periódicamente.
- **Espacio de trabajo**: directorio predeterminado para las operaciones de archivos.

### Apariencia

- **Tamaño de fuente**: ajuste del tamaño de texto general.
- **Fuente de código**: tipografía monoespaciada para bloques de código.
- **Estilo de burbuja**: personalización de las burbujas de mensajes.
- **Color de acento**: color principal de la interfaz.

### Voz

- Configuración del motor de reconocimiento y síntesis de voz.

### Proxy

- Soporte para proxies **HTTP**, **HTTPS** y **SOCKS5**.
- Configuración de host, puerto y credenciales.

### Correo electrónico

- Configuración del servidor **SMTP** para el envío de correos desde la aplicación.

### Gestión de datos

- **Retención de historial**: defina cuánto tiempo conservar las sesiones.
- **Borrar datos**: elimine el historial de chat, la memoria o todos los datos.
- **Exportar/Importar**: respalde y restaure su configuración y datos en formato JSON.

---

## Base de conocimiento y memoria

Suora gestiona la memoria en dos niveles:

### Tipos de memoria

| Tipo              | Descripción                                                       |
|-------------------|-------------------------------------------------------------------|
| **Perspectiva**   | Puntos de vista y opiniones del usuario sobre temas específicos   |
| **Preferencia**   | Configuraciones y estilos preferidos por el usuario               |
| **Corrección**    | Rectificaciones a respuestas anteriores del agente                |
| **Conocimiento**  | Información factual que el agente debe recordar                   |

### Alcance

- **Sesión**: la memoria se conserva únicamente durante la sesión activa.
- **Global**: la memoria persiste entre sesiones y está disponible para todos los agentes.

### Memoria vectorial

El sistema incorpora **búsqueda semántica** mediante embeddings vectoriales. Esto permite al agente recuperar información relevante aunque la consulta no coincida textualmente con lo almacenado, mejorando significativamente la calidad de las respuestas contextuales.

---

## Seguridad y privacidad

### Políticas de ejecución

- **Directorios permitidos**: restrinja las operaciones de archivos a directorios específicos.
- **Comandos bloqueados**: defina una lista de comandos del sistema que no pueden ejecutarse.
- **Confirmación**: exija confirmación manual antes de ejecutar acciones potencialmente peligrosas.

### Integridad de habilidades

Cada habilidad se verifica mediante un hash **SHA-256** para garantizar que no ha sido modificada de forma no autorizada.

### Registro de auditoría

- Se registran todas las acciones ejecutadas por los agentes.
- Capacidad máxima de **10,000 entradas**.
- Exportación en formato **JSON** para análisis externo.

---

## Atajos de teclado

| Acción                    | Windows / Linux       | macOS                 |
|---------------------------|-----------------------|-----------------------|
| Nuevo chat                | `Ctrl+N`              | `Cmd+N`               |
| Enviar mensaje            | `Enter`               | `Enter`               |
| Nueva línea               | `Shift+Enter`         | `Shift+Enter`         |
| Paleta de comandos        | `Ctrl+K`              | `Cmd+K`               |
| Entrada por voz           | `Ctrl+Shift+V`        | `Cmd+Shift+V`         |
| Buscar en chat            | `Ctrl+F`              | `Cmd+F`               |
| Cerrar sesión activa      | `Ctrl+W`              | `Cmd+W`               |
| Abrir ajustes             | `Ctrl+,`              | `Cmd+,`               |
| Alternar barra lateral    | `Ctrl+B`              | `Cmd+B`               |
| Zoom: aumentar            | `Ctrl++`              | `Cmd++`               |
| Zoom: reducir             | `Ctrl+-`              | `Cmd+-`               |
| Zoom: restablecer         | `Ctrl+0`              | `Cmd+0`               |

---

## Resolución de problemas

### La aplicación no inicia

- Verifique que su sistema operativo cumple los requisitos mínimos.
- En Linux, compruebe que tiene las dependencias de Electron instaladas (`libgtk-3-0`, `libnss3`).
- Elimine la carpeta de configuración (`~/.config/suora` en Linux, `~/Library/Application Support/suora` en macOS) y reinicie.

### Las respuestas de la IA fallan

- Confirme que la clave API es válida y no ha expirado.
- Compruebe su conexión a internet (salvo que utilice modelos locales con Ollama).
- Revise que no ha excedido la cuota de uso de su proveedor.
- Utilice **Probar conexión** en Ajustes �?Proveedores para diagnosticar el problema.

### Las habilidades no se ejecutan

- Verifique que la habilidad está activada en Ajustes �?Habilidades.
- Compruebe las políticas de seguridad: el directorio o comando podría estar bloqueado.
- Revise el registro de auditoría para obtener detalles del error.

### Los temporizadores no se disparan

- Asegúrese de que la aplicación permanece en ejecución (puede estar minimizada en la bandeja del sistema).
- Verifique que la fecha, hora y zona horaria del sistema son correctas.
- Compruebe la sintaxis de la expresión Cron si utiliza programación avanzada.

### Uso alto de memoria

- Cierre las sesiones de chat que ya no necesite.
- Reduzca el período de retención del historial en Ajustes �?Gestión de datos.
- Reinicie la aplicación periódicamente si trabaja con sesiones extensas.

---

## Preguntas frecuentes

**¿Suora envía mis datos a servidores externos?**
La aplicación únicamente se comunica con los proveedores de IA que usted haya configurado. No se recopilan datos de uso ni telemetría. Sus claves API se almacenan localmente en su equipo.

**¿Puedo utilizar modelos locales sin conexión a internet?**
Sí. Configure **Ollama** como proveedor para ejecutar modelos localmente. Una vez descargado el modelo, no necesitará conexión a internet.

**¿Cómo reinicio la aplicación a su estado original?**
Vaya a **Ajustes �?Gestión de datos �?Borrar todos los datos**. Esto eliminará el historial, la memoria y la configuración personalizada, restaurando los valores predeterminados.

**¿Puedo utilizar varios proveedores de IA simultáneamente?**
Sí. Puede configurar tantos proveedores como desee y alternar entre ellos en cualquier momento desde el selector de modelos en la interfaz de chat.

**¿Dónde se almacenan las sesiones de chat?**
Las sesiones se guardan localmente en el directorio de datos de la aplicación, que varía según el sistema operativo. Puede exportarlas desde Ajustes �?Gestión de datos �?Exportar.

**¿Puedo crear mis propias habilidades?**
Sí. El sistema de habilidades es extensible. Consulte la documentación para desarrolladores sobre cómo crear y publicar habilidades personalizadas en el Marketplace.

**¿Existe una versión móvil?**
Actualmente, Suora está disponible exclusivamente como aplicación de escritorio para Windows, macOS y Linux. No hay una versión móvil prevista por el momento.

**¿Cómo puedo reportar un error?**
Abra un *issue* en el repositorio de GitHub del proyecto. Incluya los pasos para reproducir el error, el sistema operativo, la versión de la aplicación y, si es posible, capturas de pantalla o registros del error.
