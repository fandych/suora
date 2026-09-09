import { FileImageIcon, FileVideoIcon, FileWarningIcon, Music4Icon } from "lucide-react"

import { getResourcePreviewKind, isDataUrl } from "@/lib/resources/archive-import"

type ResourceFilePreviewProps = {
  content: string
  path: string
}

export function ResourceFilePreview({ content, path }: ResourceFilePreviewProps) {
  const kind = getResourcePreviewKind(path, content)

  if (kind === "image" && isDataUrl(content)) {
    return <div className="flex h-full items-center justify-center overflow-auto rounded-xl border bg-muted/20 p-4"><img src={content} alt={path} className="max-h-full max-w-full rounded-lg object-contain" /></div>
  }

  if (kind === "video" && isDataUrl(content)) {
    return <div className="flex h-full items-center justify-center rounded-xl border bg-muted/20 p-4"><video src={content} controls className="max-h-full max-w-full rounded-lg" /></div>
  }

  if (kind === "audio" && isDataUrl(content)) {
    return <div className="flex h-full flex-col items-center justify-center gap-4 rounded-xl border bg-muted/20 p-6 text-center"><Music4Icon className="size-8 text-muted-foreground" /><audio src={content} controls className="w-full max-w-md" /></div>
  }

  if (kind === "binary") {
    return <div className="flex h-full flex-col items-center justify-center gap-3 rounded-xl border border-dashed bg-muted/20 p-6 text-center text-sm text-muted-foreground"><FileWarningIcon className="size-8" /><div>This file type cannot be edited as text in the current workbench.</div><div className="text-xs">Path: {path}</div></div>
  }

  if (kind === "image") {
    return <div className="flex h-full flex-col items-center justify-center gap-3 rounded-xl border border-dashed bg-muted/20 p-6 text-center text-sm text-muted-foreground"><FileImageIcon className="size-8" /><div>Image content is available, but the file does not contain an embeddable data URL preview.</div></div>
  }

  if (kind === "video") {
    return <div className="flex h-full flex-col items-center justify-center gap-3 rounded-xl border border-dashed bg-muted/20 p-6 text-center text-sm text-muted-foreground"><FileVideoIcon className="size-8" /><div>Video content is available, but the file does not contain an embeddable data URL preview.</div></div>
  }

  return null
}
