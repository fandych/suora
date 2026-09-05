import { useCallback, useEffect, useState } from "react"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import type { ChannelConfigRecord } from "@/data/domain/models"
import { CompactInput, Field, Hint } from "@/views/channels/components/channel-form-fields"

const WECHAT_QR_SCREENSHOT_RETRY_DELAYS_MS = [0, 1800, 3500]

function normalizeWeChatQrImageSource(value?: string) {
  const trimmed = value?.trim() || ""
  if (!trimmed) {
    return ""
  }

  if (/^(?:data:|https?:\/\/|blob:|file:)/i.test(trimmed)) {
    return trimmed
  }

  return `data:image/png;base64,${trimmed}`
}

function toDataUrl(base64: string, format?: string) {
  const mime = format?.trim().toLowerCase() === "jpeg" || format?.trim().toLowerCase() === "jpg"
    ? "image/jpeg"
    : "image/png"
  return `data:${mime};base64,${base64}`
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

function wait(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms))
}

async function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error("Failed to load preview image"))
    image.src = src
  })
}

async function buildWeChatQrScreenshotPreview(base64: string, format?: string): Promise<{ dataUrl: string; shouldRetry: boolean }> {
  const fullDataUrl = toDataUrl(base64, format)
  if (typeof document === "undefined" || typeof Image === "undefined") {
    return { dataUrl: fullDataUrl, shouldRetry: false }
  }

  try {
    const image = await loadImage(fullDataUrl)
    const canvas = document.createElement("canvas")
    canvas.width = image.naturalWidth
    canvas.height = image.naturalHeight
    const context = canvas.getContext("2d", { willReadFrequently: true })
    if (!context) {
      return { dataUrl: fullDataUrl, shouldRetry: false }
    }

    context.drawImage(image, 0, 0)
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data
    let minX = canvas.width
    let maxX = -1
    let minY = canvas.height
    let maxY = -1

    for (let y = 0; y < canvas.height; y += 2) {
      for (let x = 0; x < canvas.width; x += 2) {
        const index = (y * canvas.width + x) * 4
        const alpha = pixels[index + 3] ?? 0
        if (alpha < 220) {
          continue
        }

        const red = pixels[index] ?? 255
        const green = pixels[index + 1] ?? 255
        const blue = pixels[index + 2] ?? 255
        const luminance = 0.2126 * red + 0.7152 * green + 0.0722 * blue
        if (luminance > 245) {
          continue
        }

        minX = Math.min(minX, x)
        maxX = Math.max(maxX, x)
        minY = Math.min(minY, y)
        maxY = Math.max(maxY, y)
      }
    }

    if (maxX < minX || maxY < minY) {
      return { dataUrl: fullDataUrl, shouldRetry: true }
    }

    const contentWidth = maxX - minX + 1
    const contentHeight = maxY - minY + 1
    if (Math.max(contentWidth, contentHeight) < 180 || contentWidth * contentHeight < 45_000) {
      return { dataUrl: fullDataUrl, shouldRetry: true }
    }

    const centerX = minX + contentWidth / 2
    const centerY = minY + contentHeight * 0.72
    const cropSize = Math.round(Math.max(contentWidth * 1.18, contentHeight * 0.68, 260))
    const cropLeft = clamp(Math.round(centerX - cropSize / 2), 0, Math.max(0, canvas.width - cropSize))
    const cropTop = clamp(Math.round(centerY - cropSize / 2), 0, Math.max(0, canvas.height - cropSize))
    const outputSize = Math.max(512, cropSize)

    const outputCanvas = document.createElement("canvas")
    outputCanvas.width = outputSize
    outputCanvas.height = outputSize
    const outputContext = outputCanvas.getContext("2d")
    if (!outputContext) {
      return { dataUrl: fullDataUrl, shouldRetry: false }
    }

    outputContext.imageSmoothingEnabled = false
    outputContext.drawImage(canvas, cropLeft, cropTop, cropSize, cropSize, 0, 0, outputSize, outputSize)
    return {
      dataUrl: outputCanvas.toDataURL(format?.trim().toLowerCase() === "jpeg" || format?.trim().toLowerCase() === "jpg" ? "image/jpeg" : "image/png"),
      shouldRetry: false,
    }
  } catch {
    return { dataUrl: fullDataUrl, shouldRetry: false }
  }
}

type ChannelPlatformWeChatPersonalFormProps = {
  channel: ChannelConfigRecord
  verificationCode: string
  showVerification: boolean
  onBind: () => void
  onVerificationCodeChange: (value: string) => void
  onConfirmBinding: () => void
  isBinding: boolean
}

export function ChannelPlatformWeChatPersonalForm({
  channel,
  verificationCode,
  showVerification,
  onBind,
  onVerificationCodeChange,
  onConfirmBinding,
  isBinding,
}: ChannelPlatformWeChatPersonalFormProps) {
  const normalizedWeChatQrSource = channel.wechatPersonalQrCodeUrl?.trim() || ""
  const [qrPreviewFallback, setQrPreviewFallback] = useState<{ source: string; dataUrl: string } | null>(null)
  const [qrPreviewResolvingSource, setQrPreviewResolvingSource] = useState("")
  const [qrImageLoaded, setQrImageLoaded] = useState(false)
  const [isQrDialogOpen, setIsQrDialogOpen] = useState(false)
  const [requestedQrFlow, setRequestedQrFlow] = useState(false)
  const [sourceSnapshotOnOpen, setSourceSnapshotOnOpen] = useState("")
  const bindButtonLabel = channel.wechatPersonalBindingStatus === "bound" ? "Rebind WeChat" : "Start QR binding"
  const isWeChatConnected = channel.wechatPersonalBindingStatus === "bound" || channel.bindingState === "connected"
  const qrImageSource = qrPreviewFallback?.source === normalizedWeChatQrSource
    ? qrPreviewFallback.dataUrl
    : normalizeWeChatQrImageSource(channel.wechatPersonalQrCodeUrl)
  const isQrDialogVisible = isQrDialogOpen && !isWeChatConnected
  const shouldWaitForFreshQr = requestedQrFlow && (isBinding || sourceSnapshotOnOpen === normalizedWeChatQrSource)
  const qrStatusMessage = channel.wechatPersonalQrStatus === "scaned"
    ? "已扫码，等待用户确认"
    : channel.wechatPersonalQrStatus === "need_verifycode"
      ? "需要验证码，请在下方输入设备上显示的数字"
      : "仅在微信运行时明确要求时再输入验证码"
  const qrStatusClassName = channel.wechatPersonalQrStatus === "scaned" || channel.wechatPersonalQrStatus === "need_verifycode"
    ? "text-center text-sm font-medium text-emerald-700"
    : "text-center text-sm text-muted-foreground"

  useEffect(() => {
    setQrPreviewFallback((current) => {
      if (!current) {
        return current
      }
      return current.source === normalizedWeChatQrSource ? current : null
    })
    setQrPreviewResolvingSource((current) => current === normalizedWeChatQrSource ? current : "")
    setQrImageLoaded(false)
  }, [normalizedWeChatQrSource])

  useEffect(() => {
    if (requestedQrFlow && !isBinding && normalizedWeChatQrSource && sourceSnapshotOnOpen !== normalizedWeChatQrSource) {
      setRequestedQrFlow(false)
    }
    if (isWeChatConnected) {
      setIsQrDialogOpen(false)
      setRequestedQrFlow(false)
    }
  }, [isWeChatConnected, channel.wechatPersonalQrStatus, isBinding, normalizedWeChatQrSource, requestedQrFlow, sourceSnapshotOnOpen])

  const handleOpenBindDialog = () => {
    setSourceSnapshotOnOpen(normalizedWeChatQrSource)
    setRequestedQrFlow(true)
    setQrImageLoaded(false)
    setIsQrDialogOpen(true)
    onBind()
  }

  const handleQrPreviewError = useCallback(async () => {
    const source = normalizedWeChatQrSource
    if (!source || !/^https?:\/\//i.test(source)) {
      return
    }

    if (qrPreviewFallback?.source === source || qrPreviewResolvingSource === source) {
      return
    }

    setQrPreviewResolvingSource(source)
    try {
      let fallbackDataUrl = ""
      for (const delayMs of WECHAT_QR_SCREENSHOT_RETRY_DELAYS_MS) {
        if (delayMs > 0) {
          await wait(delayMs)
        }

        const result = await window.electron?.invoke("channel:wechatPersonalQrPreview", source, delayMs) as { image?: string; format?: string; error?: string } | undefined
        if (!result?.image || result.error) {
          continue
        }

        const preview = await buildWeChatQrScreenshotPreview(result.image, result.format)
        fallbackDataUrl = preview.dataUrl
        if (!preview.shouldRetry) {
          break
        }
      }

      if (!fallbackDataUrl) {
        return
      }

      setQrPreviewFallback({ source, dataUrl: fallbackDataUrl })
    } catch {
      return
    } finally {
      setQrPreviewResolvingSource((current) => current === source ? "" : current)
    }
  }, [normalizedWeChatQrSource, qrPreviewFallback, qrPreviewResolvingSource])

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-primary/15 bg-primary/5 p-3">
        <div>
          <div className="text-sm font-medium text-foreground">Direct QR binding</div>
          <Hint>Use the built-in WeChat QR login flow. A verification code is only needed if the runtime explicitly requests it.</Hint>
        </div>
        <Button size="sm" onClick={handleOpenBindDialog} disabled={isBinding}>{isBinding ? "Binding..." : bindButtonLabel}</Button>
      </div>
      {channel.wechatPersonalBindingStatus === "bound" && !normalizedWeChatQrSource ? <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/5 px-3 py-3 text-xs text-emerald-700">WeChat is already bound. Use Rebind WeChat to request a fresh QR code.</div> : channel.wechatPersonalQrStatus === "scaned" ? <div className="rounded-xl border border-primary/20 bg-primary/5 px-3 py-3 text-xs text-foreground">QR code scanned. Waiting for confirmation in WeChat.</div> : channel.wechatPersonalQrStatus === "need_verifycode" ? <div className="rounded-xl border border-primary/20 bg-primary/5 px-3 py-3 text-xs text-foreground">WeChat requested a verification code. Enter the digits shown on the device below.</div> : <div className="rounded-xl border border-dashed px-3 py-5 text-xs text-muted-foreground">Start or rebind WeChat to open the QR code dialog.</div>}

      {showVerification ? (
        <div className="grid gap-3 rounded-xl border p-3 md:grid-cols-[minmax(0,1fr)_auto]">
          <Field label="Verification code">
            <CompactInput value={verificationCode} onChange={(event) => onVerificationCodeChange(event.target.value)} placeholder="Enter code from bridge or device" />
          </Field>
          <div className="flex items-end">
            <Button size="sm" onClick={onConfirmBinding} disabled={isBinding || verificationCode.trim().length < 4}>{isBinding ? "Verifying..." : "Confirm binding"}</Button>
          </div>
        </div>
      ) : null}

      <Dialog open={isQrDialogVisible} onOpenChange={setIsQrDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Scan to bind</DialogTitle>
          </DialogHeader>
          {shouldWaitForFreshQr ? (
            <div className="flex min-h-80 items-center justify-center rounded-xl border bg-muted/10 text-sm text-muted-foreground">Generating a fresh QR code...</div>
          ) : qrImageSource ? (
            <div className="space-y-2">
              <div className="relative overflow-hidden rounded-xl border bg-white p-3">
                {(!qrImageLoaded || qrPreviewResolvingSource === normalizedWeChatQrSource) ? <div className="absolute inset-3 flex items-center justify-center rounded-lg bg-white/90"><span className="h-8 w-8 animate-spin rounded-full border-2 border-primary/30 border-t-primary" /></div> : null}
                <img src={qrImageSource} alt="WeChat personal QR code" onLoad={() => setQrImageLoaded(true)} onError={() => { void handleQrPreviewError() }} className="mx-auto aspect-square w-full max-w-md object-contain" />
              </div>
              <div className={qrStatusClassName}>{qrStatusMessage}</div>
            </div>
          ) : <div className="flex min-h-80 items-center justify-center rounded-xl border bg-muted/10 text-sm text-muted-foreground">Waiting for QR code...</div>}
        </DialogContent>
      </Dialog>
    </div>
  )
}