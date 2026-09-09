import { useCallback, useEffect, useRef, useState } from "react"
import { useParams } from "react-router"

import { Badge } from "@/components/ui/badge"
import { subscribeToDataChanges } from "@/data/repositories/data-events"
import { showToast } from "@/lib/ui-toast"
import { useAsyncResource } from "@/hooks/use-async-resource"
import {
  bindChannel,
  confirmWeChatPersonalBinding,
  getChannel,
  saveChannel,
  unbindChannel,
  waitForWeChatPersonalBinding,
} from "@/data/repositories/channel-repository"
import { listAvailableAgents } from "@/data/repositories/agent-repository"
import { listConfiguredModelProviders } from "@/data/repositories/model-config-repository"
import { ChannelLogoBadge } from "@/views/channels/components/channel-logo-badge"
import PageHeader from "@/views/components/page-header"
import { ErrorCard, LoadingCard } from "@/views/components/resource-state"
import { ChannelEditorForm } from "@/views/channels/components/channel-editor-form"
import { getChannelBindingLabel, getChannelBindingVariant, getChannelStatusLabel, getChannelStatusVariant } from "@/views/channels/components/channel-utils"
import type { ChannelDetail } from "@/data/domain/models"

const ChannelDetailPage = () => {
  const { channelId } = useParams<{ channelId: string }>()
  const { data, error, isLoading, reload, setData } = useAsyncResource(() => getChannel(channelId ?? ""), [channelId])
  const { data: agentsData } = useAsyncResource(() => listAvailableAgents(), [])
  const { data: providersData } = useAsyncResource(() => listConfiguredModelProviders(), [])
  const [draft, setDraft] = useState<ChannelDetail | null>(null)
  const [wechatVerificationCode, setWechatVerificationCode] = useState("")
  const [showWechatVerification, setShowWechatVerification] = useState(false)
  const [isBinding, setIsBinding] = useState(false)
  const [isSavingGeneral, setIsSavingGeneral] = useState(false)
  const [isSavingConfiguration, setIsSavingConfiguration] = useState(false)
  const [isUnbinding, setIsUnbinding] = useState(false)
  const activeWeChatMonitorSessionRef = useRef<string | null>(null)
  const agents = agentsData ?? []
  const providers = providersData ?? []

  const updateDraft = useCallback((next: ChannelDetail) => {
    setData(next)
    setDraft(next)
    setShowWechatVerification(isVerificationPromptRequired(next))
  }, [setData])

  useEffect(() => {
    if (data) {
      setDraft(data)
      setShowWechatVerification(isVerificationPromptRequired(data))
    }
  }, [data])

  useEffect(() => {
    return subscribeToDataChanges((route) => {
      if (route === "/channels" && channelId) {
        void getChannel(channelId)
          .then((next) => {
            updateDraft(next)
          })
          .catch(() => undefined)
      }
    })
  }, [channelId, updateDraft])

  const persistDraft = async (nextDraft: ChannelDetail) => {
    const next = await saveChannel(nextDraft)
    setData(next)
    setDraft(next)
  }

  const handleSave = async () => {
    if (!draft) {
      return
    }

    await persistDraft(draft)
    showToast({ title: "Channel saved", description: "Channel settings were persisted.", type: "success", timeout: 2000 })
  }

  const handleSaveGeneral = async () => {
    if (!draft) {
      return
    }

    setIsSavingGeneral(true)
    try {
      await handleSave()
    } finally {
      setIsSavingGeneral(false)
    }
  }

  const handleSaveConfiguration = async () => {
    if (!draft) {
      return
    }

    setIsSavingConfiguration(true)
    try {
      await handleSave()
    } finally {
      setIsSavingConfiguration(false)
    }
  }

  const handleUnbind = async () => {
    if (!draft) {
      return
    }

    setIsUnbinding(true)
    try {
      const next = await unbindChannel(draft)
      activeWeChatMonitorSessionRef.current = null
      setWechatVerificationCode("")
      updateDraft(next)
      showToast({ title: "Channel unbound", description: "The current channel binding was removed.", type: "success", timeout: 2500 })
    } finally {
      setIsUnbinding(false)
    }
  }

  const monitorWeChatBinding = async (initialDetail: ChannelDetail, verificationCode?: string) => {
    const monitorSessionKey = initialDetail.channel.wechatPersonalSessionKey
    if (!monitorSessionKey) {
      return
    }

    activeWeChatMonitorSessionRef.current = monitorSessionKey
    let current = initialDetail
    let hasShownScannedMessage = current.channel.wechatPersonalQrStatus === "scaned"
    let nextVerificationCode = verificationCode

    while (activeWeChatMonitorSessionRef.current === monitorSessionKey) {
      const waitResult = await waitForWeChatPersonalBinding(current, nextVerificationCode, nextVerificationCode ? 60_000 : 35_000)
      current = waitResult.detail
      updateDraft(current)
      nextVerificationCode = undefined

      if (waitResult.status === "connected") {
        activeWeChatMonitorSessionRef.current = null
        setWechatVerificationCode("")
        showToast({ title: "WeChat connected", description: waitResult.message || "Personal WeChat binding completed.", type: "success", timeout: 3000 })
        return
      }

      if (waitResult.status === "already_bound") {
        activeWeChatMonitorSessionRef.current = null
        showToast({ title: "Already bound", description: waitResult.message || "This WeChat account is already bound.", type: "info", timeout: 3000 })
        return
      }

      if (waitResult.status === "need_verifycode") {
        activeWeChatMonitorSessionRef.current = null
        showToast({ title: "Verification required", description: waitResult.message || "Enter the digits shown in WeChat to continue.", type: "info", timeout: 3000 })
        return
      }

      if (waitResult.status === "scaned") {
        if (!hasShownScannedMessage) {
          hasShownScannedMessage = true
          showToast({ title: "QR scanned", description: waitResult.message || "Waiting for confirmation in WeChat.", type: "info", timeout: 2500 })
        }
        await new Promise((resolve) => setTimeout(resolve, 1200))
        continue
      }

      if (waitResult.status === "timeout") {
        continue
      }

      if (waitResult.status === "expired") {
        showToast({ title: "QR refreshed", description: waitResult.message || "The QR code expired and was refreshed.", type: "info", timeout: 3000 })
        continue
      }

      activeWeChatMonitorSessionRef.current = null
      showToast({ title: "WeChat binding failed", description: waitResult.message || "The QR login session could not be completed.", type: "error", timeout: 3000 })
      return
    }
  }

  const handleBind = async () => {
    if (!draft) {
      return
    }

    setIsBinding(true)
    try {
      const next = await bindChannel(draft)
      updateDraft(next)
      const latestMessage = next.runtime.debugLog[0]?.text

      if (next.channel.platform === "wechat_personal") {
        const started = Boolean(next.channel.wechatPersonalSessionKey && next.channel.wechatPersonalQrCodeUrl)
        showToast({
          title: started ? "QR binding started" : "QR binding failed",
          description: latestMessage || (started ? "Scan the QR code and complete verification if prompted." : "The runtime did not return a usable QR code."),
          type: started ? "success" : "error",
          timeout: 3000,
        })

        if (started && next.channel.wechatPersonalSessionKey) {
          void monitorWeChatBinding(next)
        }

        return
      }

      const bound = next.channel.bindingState === "connected"
      showToast({
        title: bound ? "Channel bound" : "Channel binding failed",
        description: latestMessage || (bound ? "Channel credentials were validated and the endpoint is ready." : "Check the required provider fields and try again."),
        type: bound ? "success" : "error",
        timeout: 3000,
      })
    } finally {
      setIsBinding(false)
    }
  }

  const handleConfirmWeChatBinding = async () => {
    if (!draft || draft.channel.platform !== "wechat_personal") {
      return
    }

    setIsBinding(true)
    try {
      const next = await confirmWeChatPersonalBinding(draft, wechatVerificationCode)
      updateDraft(next)
      const latestMessage = next.runtime.debugLog[0]?.text
      if (next.channel.wechatPersonalBindingStatus === "bound") {
        setWechatVerificationCode("")
        showToast({ title: "WeChat connected", description: "Personal WeChat bridge binding completed.", type: "success", timeout: 2500 })
        return
      }

      if (next.channel.wechatPersonalSessionKey && next.channel.wechatPersonalQrStatus === "scaned") {
        void monitorWeChatBinding(next)
        return
      }

      showToast({
        title: next.channel.wechatPersonalBindingStatus === "pending" ? "Verification required" : "WeChat binding failed",
        description: latestMessage || (next.channel.wechatPersonalBindingStatus === "pending" ? "Enter the verification code shown on the device to continue." : "The QR login session could not be completed."),
        type: next.channel.wechatPersonalBindingStatus === "pending" ? "info" : "error",
        timeout: 3000,
      })
    } finally {
      setIsBinding(false)
    }
  }

  return (
    <div className="flex min-h-full flex-col bg-background">
      <PageHeader
        title={draft?.channel.title || "Channel"}
        leading={draft ? <ChannelLogoBadge channel={draft.channel} className="size-9" iconClassName="size-4.5" /> : null}
        actions={draft ? (
          <>
            <Badge variant={getChannelStatusVariant(draft.channel.status)}>{getChannelStatusLabel(draft.channel.status)}</Badge>
            <Badge variant={getChannelBindingVariant(draft.channel.bindingState)}>{getChannelBindingLabel(draft.channel.bindingState)}</Badge>
          </>
        ) : null}
      />
      <div className="min-h-0 flex-1 overflow-y-auto p-6">
        <div className="w-full">
          {isLoading ? <LoadingCard title="Loading channel..." /> : null}
          {error ? <ErrorCard error={error} onRetry={reload} /> : null}
          {!isLoading && !error && draft ? (
            <ChannelEditorForm
              channel={draft.channel}
              agents={agents}
              providers={providers}
              messageRecords={draft.runtime.messages}
              showWechatVerification={showWechatVerification}
              onChange={(channel) => {
                const next = { ...draft, channel }
                setDraft(next)
                setShowWechatVerification(isVerificationPromptRequired(next))
              }}
              onSaveGeneral={() => void handleSaveGeneral()}
              onSaveConfiguration={() => void handleSaveConfiguration()}
              onBind={() => void handleBind()}
              onUnbind={() => void handleUnbind()}
              onConfirmWeChatBinding={() => void handleConfirmWeChatBinding()}
              wechatVerificationCode={wechatVerificationCode}
              onWechatVerificationCodeChange={setWechatVerificationCode}
              isBinding={isBinding}
              isSavingGeneral={isSavingGeneral}
              isSavingConfiguration={isSavingConfiguration}
              isUnbinding={isUnbinding}
            />
          ) : null}
        </div>
      </div>
    </div>
  )
}

function isVerificationPromptRequired(detail: ChannelDetail) {
  return detail.channel.platform === "wechat_personal" && detail.channel.wechatPersonalQrStatus === "need_verifycode"
}

export default ChannelDetailPage