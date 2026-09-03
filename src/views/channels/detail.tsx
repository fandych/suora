import { useEffect, useState } from "react"
import { useParams } from "react-router"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { showToast } from "@/lib/app-toast"
import { useAsyncResource } from "@/hooks/use-async-resource"
import {
  bindChannel,
  confirmWeChatPersonalBinding,
  getChannel,
  saveChannel,
} from "@/data/repositories/channel-repository"
import { listAvailableAgents } from "@/data/repositories/agent-repository"
import PageHeader from "@/views/components/page-header"
import { ErrorCard, LoadingCard } from "@/views/components/resource-state"
import { ChannelEditorForm } from "@/views/channels/components/channel-editor-form"
import { getChannelBindingLabel, getChannelBindingVariant, getChannelStatusLabel, getChannelStatusVariant } from "@/views/channels/components/channel-utils"
import type { ChannelDetail } from "@/data/domain/models"

const ChannelDetailPage = () => {
  const { channelId } = useParams<{ channelId: string }>()
  const { data, error, isLoading, reload, setData } = useAsyncResource(() => getChannel(channelId ?? ""), [channelId])
  const { data: agentsData } = useAsyncResource(() => listAvailableAgents(), [])
  const [draft, setDraft] = useState<ChannelDetail | null>(null)
  const [wechatVerificationCode, setWechatVerificationCode] = useState("")
  const [isBinding, setIsBinding] = useState(false)
  const agents = agentsData ?? []

  useEffect(() => {
    if (data) {
      setDraft(data)
    }
  }, [data])

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

  const handleBind = async () => {
    if (!draft) {
      return
    }

    setIsBinding(true)
    try {
      const next = await bindChannel(draft)
      setData(next)
      setDraft(next)
      showToast({
        title: draft.channel.platform === "wechat_personal" ? "QR binding started" : "Channel bound",
        description: draft.channel.platform === "wechat_personal"
          ? "Scan the QR code and complete verification if prompted."
          : "Channel credentials were validated and the endpoint is ready.",
        type: "success",
        timeout: 2500,
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
      setData(next)
      setDraft(next)
      if (next.channel.wechatPersonalBindingStatus === "bound") {
        setWechatVerificationCode("")
        showToast({ title: "WeChat connected", description: "Personal WeChat bridge binding completed.", type: "success", timeout: 2500 })
      }
    } finally {
      setIsBinding(false)
    }
  }

  return (
    <div className="flex min-h-full flex-col bg-background">
      <PageHeader
        title={draft?.channel.title || "Channel"}
        actions={draft ? (
          <>
            <Badge variant={getChannelStatusVariant(draft.channel.status)}>{getChannelStatusLabel(draft.channel.status)}</Badge>
            <Badge variant={getChannelBindingVariant(draft.channel.bindingState)}>{getChannelBindingLabel(draft.channel.bindingState)}</Badge>
            <Button size="sm" onClick={() => void handleSave()}>Save channel</Button>
          </>
        ) : null}
      />
      <div className="flex-1 p-6">
        <div className="mx-auto max-w-5xl">
          {isLoading ? <LoadingCard title="Loading channel..." /> : null}
          {error ? <ErrorCard error={error} onRetry={reload} /> : null}
          {!isLoading && !error && draft ? (
            <ChannelEditorForm
              channel={draft.channel}
              agents={agents}
              onChange={(channel) => setDraft({ ...draft, channel })}
              onSave={() => void handleSave()}
              onBind={() => void handleBind()}
              onConfirmWeChatBinding={() => void handleConfirmWeChatBinding()}
              wechatVerificationCode={wechatVerificationCode}
              onWechatVerificationCodeChange={setWechatVerificationCode}
              isBinding={isBinding}
            />
          ) : null}
        </div>
      </div>
    </div>
  )
}

export default ChannelDetailPage