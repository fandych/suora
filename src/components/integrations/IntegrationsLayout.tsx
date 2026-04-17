import { MCPSettingsPanel } from './MCPSettingsPanel'

export function IntegrationsLayout() {
  return (
    <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
      <div className="h-13 px-8 flex items-center border-b border-border-subtle/50 shrink-0">
        <h2 className="text-sm font-semibold text-text-primary">MCP Servers</h2>
        <span className="ml-3 text-[10px] text-text-muted/60 font-medium">Model Context Protocol</span>
      </div>
      <div className="flex-1 p-6 overflow-y-auto">
        <MCPSettingsPanel />
      </div>
    </div>
  )
}
