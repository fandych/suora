import { AlertCircleIcon, CheckIcon, ClipboardIcon, ExternalLinkIcon, EyeIcon, EyeOffIcon, Loader2Icon, RotateCcwIcon } from "lucide-react"
import { useState } from "react"

import { Button } from "@/components/ui/button"
import { copyTextToClipboard } from "@/lib/clipboard"
import { showToast } from "@/lib/app-toast"
import { suoraIpc } from "@/lib/ipc"
import type { ChatBrowserInteractionState } from "@/views/chats/chat-browser-status"

type ChatBrowserStatusBarProps = {
  browserState: ChatBrowserInteractionState
  onContinue: () => void
  onRetry?: () => void
  sessionId?: string | null
  pendingContinue?: boolean
}

export function ChatBrowserStatusBar({ browserState, onContinue, onRetry, sessionId, pendingContinue = false }: ChatBrowserStatusBarProps) {
  const [pageText, setPageText] = useState("")
  const [isReadingPage, setIsReadingPage] = useState(false)
  const [showPageText, setShowPageText] = useState(false)

  if (browserState.status === "idle") {
    return null
  }

  const handleReadPage = async () => {
    setIsReadingPage(true)
    try {
      const result = await suoraIpc.tools.browserPage({ sessionId: sessionId ?? undefined, includeText: true, includeLinks: false }) as { text?: string }
      setPageText(result.text?.trim() || "当前页面没有可读取的文本。")
      setShowPageText(true)
    } catch (error) {
      showToast({ title: "读取页面失败", description: error instanceof Error ? error.message : String(error), type: "error" })
    } finally {
      setIsReadingPage(false)
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-sky-200 bg-sky-50/80 px-2.5 py-2 text-xs text-sky-900">
      {browserState.status === "error" ? <AlertCircleIcon className="size-3.5 shrink-0 text-destructive" /> : browserState.status === "working" || browserState.status === "navigating" ? <Loader2Icon className="size-3.5 shrink-0 animate-spin" /> : <ExternalLinkIcon className="size-3.5 shrink-0" />}
      <span className="font-medium">{browserState.status === "error" ? "浏览器操作失败" : browserState.status === "navigating" ? "正在打开网页" : browserState.status === "working" ? "正在读取或操作网页" : "浏览器已打开，等待你的操作"}</span>
      {browserState.error ? <span className="basis-full text-destructive">{browserState.error}</span> : null}
      {browserState.url ? <span className="min-w-0 max-w-full truncate text-[11px] text-sky-800/90" title={browserState.url}>{browserState.url}</span> : null}
      {browserState.status === "awaiting-user" ? <span className="basis-full text-[11px] text-sky-800/80">完成登录、验证码或网页操作后，点击“我已完成”继续。</span> : null}
      {browserState.status === "awaiting-user" ? (
        <Button size="sm" variant="secondary" type="button" className="h-7 px-2.5 text-[11px]" onClick={onContinue} disabled={pendingContinue}>
          {pendingContinue ? <Loader2Icon className="animate-spin" /> : <CheckIcon />}
          {pendingContinue ? "正在继续..." : "我已完成，继续"}
        </Button>
      ) : null}
      {browserState.status === "error" && onRetry ? <Button size="sm" variant="ghost" type="button" className="h-7 px-2 text-[11px]" onClick={onRetry}>
        <RotateCcwIcon />
        重试
      </Button> : null}
      {browserState.url ? <Button size="sm" variant="ghost" type="button" className="h-7 px-2 text-[11px]" onClick={() => { void copyTextToClipboard(browserState.url).then(() => showToast({ title: "链接已复制", description: "浏览器页面链接已复制到剪贴板。", type: "success", timeout: 1800 })) }} aria-label="复制浏览器页面链接">
        <ClipboardIcon />
        复制链接
      </Button> : null}
      {browserState.status !== "navigating" && browserState.status !== "working" ? <Button size="sm" variant="ghost" type="button" className="h-7 px-2 text-[11px]" onClick={() => { void handleReadPage() }} disabled={isReadingPage}>
        {isReadingPage ? <Loader2Icon className="animate-spin" /> : <ExternalLinkIcon />}
        {isReadingPage ? "读取中..." : "查看页面内容"}
      </Button> : null}
      <Button size="sm" variant="ghost" type="button" className="h-7 px-2 text-[11px]" onClick={() => { void suoraIpc.tools.browserNavigate({ sessionId: sessionId ?? undefined, visible: !browserState.visible }) }} disabled={browserState.status === "navigating" || browserState.status === "working"} aria-label={browserState.visible ? "隐藏浏览器窗口" : "打开浏览器窗口"}>
        {browserState.visible ? <EyeOffIcon className="size-3.5" /> : <EyeIcon className="size-3.5" />}
        {browserState.visible ? "隐藏浏览器" : "打开浏览器"}
      </Button>
      {showPageText ? <div className="basis-full rounded-md border border-sky-200 bg-white/70 p-2 text-[11px] text-sky-950">
        <div className="mb-1 flex items-center justify-between gap-2 font-medium">
          <span>当前页面内容预览</span>
          <Button size="sm" variant="ghost" type="button" className="h-5 px-1.5 text-[10px]" onClick={() => setShowPageText(false)}>收起</Button>
        </div>
        <pre className="max-h-40 overflow-auto whitespace-pre-wrap wrap-break-word leading-5">{pageText}</pre>
      </div> : null}
    </div>
  )
}