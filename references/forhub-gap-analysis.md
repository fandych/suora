# Forhub Gap Analysis

This document tracks the current gap between the local suora workspace and the copied or referenced forhub workflow/toolset/chat behavior.

## Scope

- Current suora chat surface:
  - `src/views/chats/detail.tsx`
  - `src/views/chats/components/chat-message-item.tsx`
  - `src/services/ai-service.ts`
  - `src/services/ai-tools.ts`
- Current suora workflow surface:
  - `src/views/workflows/detail.tsx`
  - `src/views/workflows/components/workflow-properties-panel.tsx`
  - `src/views/workflows/components/workflow-trace-explorer.tsx`
  - `src/views/workflows/components/workflow-editor-config.ts`
  - `src/views/workflows/components/workflow-canvas-node.tsx`
- Current suora integration surface:
  - `src/views/integrations/detail.tsx`
  - `src/views/integrations/components/*`
- Forhub reference surfaces:
  - `C:/Users/fandych/OneDrive/Documents/Projects/forhub/forhub-server/app/workspaces/[workspaceKey]/workflow/[workflowId]/components/*`
  - `C:/Users/fandych/OneDrive/Documents/Projects/forhub/forhub-server/app/workspaces/[workspaceKey]/toolsets/[toolsetId]/components/*`

## Chat

### Aligned in this repo

- The chat route now lands directly on a blank chat editor instead of a separate home card.
- The message panel is rendered as a constrained scroll region and the input panel is pinned to the bottom.
- Empty-state content no longer participates in the message scroller height calculation; it is rendered as an overlay instead.
- Messages render markdown-like content via the local markdown renderer and post-process math, mermaid, and code blocks.
- Per-message actions now exist for speak, copy, and export.
- The selected agent now participates in chat execution and available tools.
- File or image attachments can be attached when the selected configured model supports them.
- Model selectors only show configured and enabled models.

### Still different from an ideal forhub-grade surface

- Tool calls and tool results are still rendered as chat timeline items rather than a richer execution stream with distinct visual semantics.
- Provider or agent metadata is still derived from the active session settings more often than from per-message provenance.
- The chat route does not yet expose a separate structured execution sidecar for tool traces, intermediate thoughts, or invocation metrics.
- Attachment upload is functional, but it is still lightweight compared with a dedicated media/file workflow surface.

### Current code-level root causes

- Chat history persistence still stores plain message text only, so attachments and tool events are reconstructed at render time rather than stored as first-class message parts.
- Chat tool activity is modeled as ephemeral UI events instead of a persisted execution timeline.
- Provider/viewport scroller composition is still custom, so chat layout changes must keep `MessageScrollerViewport` height-only and move layout padding to inner content wrappers to avoid false overflow.

## Workflow

### Aligned in this repo

- Workflow panels are now embedded as real `Panel` overlays inside `ReactFlow` instead of living outside the canvas.
- The node taxonomy now includes:
  - `start`
  - `end`
  - `document-retrieval`
  - `agent`
  - `fork`
  - `join`
  - `if-else`
  - `http`
  - `script`
- The workflow editor now exposes a dedicated properties panel component and a dedicated dry-run trace explorer component.
- Workflow JSON import and export exist.
- Basic node actions now include duplicate and delete.
- Model selectors inside workflow only show configured and enabled models.

### Still different from forhub

- Forhub separates general metadata, dry-run, invocation history, and node configuration into more distinct surfaces. The local repo still keeps node configuration and dry-run controls in the same right-side panel.
- Forhub node fields are denser and more specialized per node type. The local repo now covers the main requested taxonomy, but the field set is still slimmer than the full forhub editor.
- Forhub has richer node graph utilities such as design issues, deeper branch management, and more specialized node cards and controls.
- Forhub dry-run traces are more structured and support richer nested input/output exploration.

### Important implementation note

- The current repo now matches the requested taxonomy and main editing surfaces, but not every specialized forhub field or branch behavior has been ported one-to-one.

## Integrations / Toolsets

### Aligned in this repo

- `src/views/integrations/detail.tsx` has been split into toolset-style editor components:
  - `integration-basic-editor.tsx`
  - `integration-parameter-editor.tsx`
  - `integration-script-workbench.tsx`
  - `integration-try-run-sheet.tsx`
  - `integration-version-history-panel.tsx`
- The main editor now resembles a toolset workbench instead of a single monolithic form.
- MCP, HTTP, and Script remain connected to the current suora execution chain instead of becoming static UI-only panels.
- Version control UI has been removed from the visible integration editor surface per current product direction.

### Still different from forhub

- Forhub has a richer script contract drawer and input/output contract flow than the current local parameter editor.
- Forhub has a more advanced HTTP endpoint discovery and import workflow.
- Forhub has deeper version-navigation flows; the local repo intentionally removed explicit version-control UI on this iteration.
- The local MCP/HTTP/Script editors still follow current suora repository contracts rather than a full forhub field-for-field migration.

## System Agents

### Aligned in this repo

- Built-in system agents are no longer inserted into the database by default.
- System agents are layered in code from `src/data/repositories/system-agents.ts`.
- A general-purpose built-in assistant now exists: `agent-general-assistant` / `通用助手`.

### Why this changed

- The previous implementation inserted built-in agents into SQLite during seeding, which caused `UNIQUE constraint failed: agents.id` when the same IDs were encountered again.
- The repo now resolves built-in system agents via repository overlay and only writes an agent row if the user explicitly saves an override.

## Known Remaining Gaps

- Chat still needs a more structured persisted representation for attachments and tool executions if it is meant to fully match an advanced assistant timeline.
- Workflow still needs deeper one-to-one field parity for every node type from forhub.
- Integrations still need richer HTTP discovery/import and script contract editing if strict forhub parity is required.

## Verification Status

- `npm run type-check`: passing
- `npm run build`: passing