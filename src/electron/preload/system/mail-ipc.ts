import { ipcMain } from "electron"
import { getSystemMailProfile, sendMail, type MailAttachment } from "@/electron/app/channels/mail-service"
import { ensureWorkspace } from "@/electron/infrastructure/workspace-service"
import { mailPayloadSchema, parseIpcInput } from "@/electron/preload/system/ipc-input-schemas"

export function registerMailIpc() {
  ipcMain.handle("mail:send", async (_event, value: unknown) => {
    const payload = parseIpcInput(mailPayloadSchema, value)
    await ensureWorkspace()
    const profile = getSystemMailProfile()
    if (!profile) return { success: false, error: "Global mail service is not configured." }
    return sendMail({
      profile,
      toAddress: payload.to,
      subject: payload.subject,
      content: payload.content,
      html: payload.html,
      attachments: payload.attachments as MailAttachment[] | undefined,
    })
  })
}
