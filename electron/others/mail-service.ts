import nodemailer from "nodemailer"
import type { Attachment } from "nodemailer/lib/mailer"

import type { PreferenceSettings } from "@/data/domain/preference-settings"
import { getPreferenceSettingsSnapshot } from "@electron/others/preferences"
import { appState } from "@electron/others/app-state"

export type MailProfile = {
  host: string
  port: number
  username: string
  password: string
  fromAddress: string
  fromName: string
  useTls: boolean
  source: "channel" | "preference"
}

export type SendMailInput = {
  profile: MailProfile
  toAddress: string
  subject: string
  content: string
  html?: string
  attachments?: MailAttachment[]
}

export type MailAttachment = {
  filename?: string
  content?: string | Buffer
  dataBase64?: string
  path?: string
  href?: string
  contentType?: string
  cid?: string
  encoding?: "base64" | "hex" | "binary" | "quoted-printable"
}

export type SendMailResult = {
  success: boolean
  error?: string
}

function resolvePreferenceMailProfile(preferences: PreferenceSettings): MailProfile | null {
  if (!preferences.mailServiceEnabled) {
    return null
  }

  if (!preferences.mailServerHost || !preferences.mailServerPort || !preferences.mailServerUsername || !preferences.mailServerPassword || !preferences.mailServerFrom) {
    return null
  }

  return {
    host: preferences.mailServerHost,
    port: preferences.mailServerPort,
    username: preferences.mailServerUsername,
    password: preferences.mailServerPassword,
    fromAddress: preferences.mailServerFrom,
    fromName: "SUORA",
    useTls: preferences.mailServerTls,
    source: "preference",
  }
}

export function getSystemMailProfile() {
  return resolvePreferenceMailProfile(getPreferenceSettingsSnapshot())
}

export async function sendMail({ profile, toAddress, subject, content, html, attachments }: SendMailInput): Promise<SendMailResult> {
  if (!profile.host || !profile.username || !profile.password || !profile.fromAddress) {
    return { success: false, error: "Missing SMTP configuration" }
  }

  const preferences = getPreferenceSettingsSnapshot()
  const ignoreSsl = preferences.ignoreSslErrors === true || appState.currentProxySettings.ignoreSslErrors === true
  const transporter = nodemailer.createTransport({
    host: profile.host,
    port: profile.port,
    secure: profile.useTls,
    auth: { user: profile.username, pass: profile.password },
    connectionTimeout: 30_000,
    greetingTimeout: 30_000,
    socketTimeout: 30_000,
    tls: { rejectUnauthorized: !ignoreSsl },
  })

  try {
    await transporter.sendMail({
      from: profile.fromName ? `"${profile.fromName}" <${profile.fromAddress}>` : profile.fromAddress,
      to: toAddress,
      subject,
      text: content,
      ...(html ? { html } : {}),
      attachments: attachments?.map(toNodemailerAttachment),
    })
    transporter.close()
    return { success: true }
  } catch (error) {
    transporter.close()
    return { success: false, error: error instanceof Error ? error.message : String(error) }
  }
}

function toNodemailerAttachment(attachment: MailAttachment): Attachment {
  const content = resolveAttachmentContent(attachment)
  if (!content && !attachment.path && !attachment.href) {
    throw new Error(`Attachment '${attachment.filename || "unnamed"}' has no content, path, or URL.`)
  }
  return {
    filename: attachment.filename,
    content,
    path: attachment.path || attachment.href,
    contentType: attachment.contentType,
    cid: attachment.cid,
    encoding: attachment.encoding,
  }
}

function resolveAttachmentContent(attachment: MailAttachment) {
  if (attachment.dataBase64) return Buffer.from(stripDataUrlPrefix(attachment.dataBase64), "base64")
  if (typeof attachment.content === "string" && attachment.content.startsWith("data:")) {
    return Buffer.from(stripDataUrlPrefix(attachment.content), "base64")
  }
  return attachment.content
}

function stripDataUrlPrefix(value: string) {
  const commaIndex = value.indexOf(",")
  return commaIndex >= 0 ? value.slice(commaIndex + 1) : value
}