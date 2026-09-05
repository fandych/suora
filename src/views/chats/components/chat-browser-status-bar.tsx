import { ExternalLinkIcon, EyeIcon, EyeOffIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { suoraIpc } from "@/lib/ipc"
import type { ChatBrowserInteractionState } from "@/views/chats/chat-browser-status"

type ChatBrowserStatusBarProps = {
  browserState: ChatBrowserInteractionState
  onContinue: () => void
  pendingContinue?: boolean
}

export function ChatBrowserStatusBar({ browserState, onContinue, pendingContinue = false }: ChatBrowserStatusBarProps) {
  if (browserState.status === "idle") {
    return null
  }

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-sky-200 bg-sky-50/80 px-2.5 py-2 text-xs text-sky-900">
      <ExternalLinkIcon className="size-3.5 shrink-0" />
      <span>{browserState.status === "navigating" ? "浏览器已打开，正在跳转页面" : "浏览器已打开，等待你操作后继续"}</span>
      {browserState.url ? <span className="truncate text-[11px] text-sky-800/90">{browserState.url}</span> : null}
      {browserState.status === "awaiting-user" ? (
        <Button size="sm" variant="secondary" type="button" className="h-6 px-2 text-[11px]" onClick={onContinue} disabled={pendingContinue}>
          {pendingContinue ? "继续生成中..." : "继续生成"}
        </Button>
      ) : null}
      <Button size="sm" variant="ghost" type="button" className="h-6 px-2 text-[11px]" onClick={() => { void suoraIpc.tools.browserNavigate({ visible: !browserState.visible }) }}>
        {browserState.visible ? <EyeOffIcon className="size-3.5" /> : <EyeIcon className="size-3.5" />}
        {browserState.visible ? "隐藏浏览器" : "打开浏览器"}
      </Button>
    </div>
  )
}