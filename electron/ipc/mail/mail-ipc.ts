import { ipcMain } from "electron"
import { getSystemMailProfile, sendMail, type MailAttachment } from "@electron/others/mail-service"
import { ensureWorkspace } from "@electron/others/workspace"
import type { SendMailPayload } from "@electron/types"
export function registerMailIpc() { ipcMain.handle("mail:send", async (_event, payload: SendMailPayload) => { await ensureWorkspace(); const profile = getSystemMailProfile(); if (!profile) return { success: false, error: "Global mail service is not configured." }; return sendMail({ profile, toAddress: payload.to, subject: payload.subject, content: payload.content, html: payload.html, attachments: payload.attachments as MailAttachment[] | undefined }) }) }
