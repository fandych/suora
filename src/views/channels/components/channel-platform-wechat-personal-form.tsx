import { Button } from "@/components/ui/button"
import type { ChannelConfigRecord } from "@/data/domain/models"
import { CompactInput, Field, Hint } from "@/views/channels/components/channel-form-fields"

type ChannelPlatformWeChatPersonalFormProps = {
  channel: ChannelConfigRecord
  verificationCode: string
  onPatch: (patch: Partial<ChannelConfigRecord>) => void
  onVerificationCodeChange: (value: string) => void
  onConfirmBinding: () => void
  isBinding: boolean
}

export function ChannelPlatformWeChatPersonalForm({
  channel,
  verificationCode,
  onPatch,
  onVerificationCodeChange,
  onConfirmBinding,
  isBinding,
}: ChannelPlatformWeChatPersonalFormProps) {
  const showVerify = channel.wechatPersonalBindingStatus === "pending"

  return (
    <div className="space-y-3">
      <div className="grid gap-3 md:grid-cols-2">
        <Field label="Bridge webhook URL" className="md:col-span-2">
          <CompactInput value={channel.wechatPersonalWebhookUrl ?? ""} onChange={(event) => onPatch({ wechatPersonalWebhookUrl: event.target.value })} placeholder="https://bridge.example.com/send" />
        </Field>
        <Field label="Bridge auth token">
          <CompactInput value={channel.wechatPersonalAuthToken ?? ""} onChange={(event) => onPatch({ wechatPersonalAuthToken: event.target.value })} placeholder="Optional bearer token" />
        </Field>
        <Field label="Binding status">
          <CompactInput readOnly value={channel.wechatPersonalBindingStatus ?? "unbound"} />
        </Field>
        <Field label="Native bot token">
          <CompactInput value={channel.wechatPersonalBotToken ?? ""} onChange={(event) => onPatch({ wechatPersonalBotToken: event.target.value })} placeholder="Generated after QR binding" />
        </Field>
        <Field label="Native base URL">
          <CompactInput value={channel.wechatPersonalBaseUrl ?? ""} onChange={(event) => onPatch({ wechatPersonalBaseUrl: event.target.value })} placeholder="https://bridge.local.suora.test/..." />
        </Field>
        <Field label="Account ID">
          <CompactInput value={channel.wechatPersonalAccountId ?? ""} onChange={(event) => onPatch({ wechatPersonalAccountId: event.target.value })} placeholder="Bound account id" />
        </Field>
        <Field label="User ID">
          <CompactInput value={channel.wechatPersonalUserId ?? ""} onChange={(event) => onPatch({ wechatPersonalUserId: event.target.value })} placeholder="Last verified user id" />
        </Field>
      </div>

      {channel.wechatPersonalQrCodeUrl ? (
        <div className="space-y-2 rounded-xl border bg-muted/10 p-3">
          <div className="text-xs font-medium text-foreground">扫码绑定</div>
          <Hint>扫描二维码后，如果桥接侧要求验证码，再在下方输入验证码完成绑定。</Hint>
          <div className="overflow-hidden rounded-xl border bg-white p-3">
            <img src={channel.wechatPersonalQrCodeUrl} alt="WeChat personal QR code" className="mx-auto aspect-square w-full max-w-64 object-contain" />
          </div>
        </div>
      ) : null}

      {showVerify ? (
        <div className="grid gap-3 rounded-xl border p-3 md:grid-cols-[minmax(0,1fr)_auto]">
          <Field label="Verification code">
            <CompactInput value={verificationCode} onChange={(event) => onVerificationCodeChange(event.target.value)} placeholder="Enter code from bridge or device" />
          </Field>
          <div className="flex items-end">
            <Button size="sm" onClick={onConfirmBinding} disabled={isBinding || verificationCode.trim().length < 4}>{isBinding ? "Verifying..." : "Confirm binding"}</Button>
          </div>
        </div>
      ) : null}
    </div>
  )
}