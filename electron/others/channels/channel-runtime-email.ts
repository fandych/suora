import type { ChannelConfigRecord, EmailAction, EmailFilterRule } from "@/data/domain/models"
import { httpRequest } from "@electron/others/channels/channel-runtime-http"
import { getSystemMailProfile, sendMail, type MailAttachment, type MailProfile } from "@electron/others/mail-service"

export type ParsedEmail = {
  uid: number
  from: string
  fromName?: string
  to?: string
  cc?: string
  subject: string
  body: string
  date?: string
  hasAttachment: boolean
  messageId?: string
  attachments?: MailAttachment[]
}

function getChannelMailProfile(channel: ChannelConfigRecord): MailProfile | null {
  if (channel.emailUseGlobalMailService) {
    return getSystemMailProfile()
  }

  const host = channel.emailSmtpHost || channel.emailImapHost
  const port = channel.emailSmtpPort || 465
  const username = channel.emailSmtpUser || channel.emailImapUser
  const password = channel.emailSmtpPassword || channel.emailImapPassword
  const fromAddress = channel.emailFromAddress || channel.emailImapUser

  if (!host || !username || !password || !fromAddress) {
    return null
  }

  return {
    host,
    port,
    username,
    password,
    fromAddress,
    fromName: channel.emailFromName || "SUORA",
    useTls: channel.emailSmtpTls !== false,
    source: "channel",
  }
}

export async function sendEmailMessage(channel: ChannelConfigRecord, toAddress: string, subject: string, content: string) {
  const profile = getChannelMailProfile(channel)

  if (!profile) {
    return { success: false, error: channel.emailUseGlobalMailService ? "Missing global mail service configuration" : "Missing SMTP configuration" }
  }

  return sendMail({ profile, toAddress, subject, content })
}

export async function fetchNewEmails(channel: ChannelConfigRecord, lastSeenUid: number): Promise<ParsedEmail[]> {
  if (!channel.emailImapHost || !channel.emailImapUser || !channel.emailImapPassword) {
    return []
  }

  const host = channel.emailImapHost
  const port = channel.emailImapPort || 993
  const user = channel.emailImapUser
  const pass = channel.emailImapPassword
  const useTls = channel.emailImapTls !== false
  const mailbox = channel.emailImapMailbox || "INBOX"

  return new Promise((resolve, reject) => {
    let buffer = ""
    let commandTag = 0
    let state: "connecting" | "login" | "select" | "search" | "fetch" | "done" = "connecting"
    const emails: ParsedEmail[] = []
    let uidsToFetch: number[] = []
    let currentEmailData = ""
    let fetchingLiteral = false
    let literalBytesRemaining = 0
    const nextTag = () => `A${++commandTag}`
    const send = (command: string) => {
      const tag = nextTag()
      socket.write(`${tag} ${command}\r\n`)
    }
    const socket: net.Socket = useTls ? tls.connect({ host, port, rejectUnauthorized: false }) : net.createConnection({ host, port })
    const timeout = setTimeout(() => {
      socket.destroy()
      reject(new Error("IMAP connection timeout"))
    }, 30_000)

    socket.setEncoding("utf8")
    socket.on("data", (data: string) => {
      buffer += data
      processBuffer()
    })
    socket.on("error", (error) => {
      clearTimeout(timeout)
      reject(error)
    })
    socket.on("close", () => {
      clearTimeout(timeout)
      if (state !== "done") resolve(emails)
    })

    function processBuffer() {
      if (fetchingLiteral && literalBytesRemaining > 0) {
        const chunk = buffer.slice(0, literalBytesRemaining)
        currentEmailData += chunk
        buffer = buffer.slice(chunk.length)
        literalBytesRemaining -= chunk.length
        if (literalBytesRemaining <= 0) {
          fetchingLiteral = false
          const parsed = parseImapEmailData(currentEmailData, uidsToFetch[emails.length] || 0)
          if (parsed) emails.push(parsed)
          currentEmailData = ""
        }
        if (buffer.length > 0) processBuffer()
        return
      }

      const lines = buffer.split("\r\n")
      buffer = lines.pop() || ""
      for (const line of lines) handleLine(line)
    }

    function handleLine(line: string) {
      if (state === "connecting" && line.startsWith("* OK")) {
        state = "login"
        send(`LOGIN "${escapeImapString(user)}" "${escapeImapString(pass)}"`)
      } else if (state === "login" && /^A\d+ OK/.test(line)) {
        state = "select"
        send(`SELECT "${escapeImapString(mailbox)}"`)
      } else if (state === "login" && /^A\d+ (NO|BAD)/.test(line)) {
        socket.destroy()
        reject(new Error("IMAP login failed"))
      } else if (state === "select" && /^A\d+ OK/.test(line)) {
        state = "search"
        send(lastSeenUid > 0 ? `UID SEARCH UNSEEN UID ${lastSeenUid + 1}:*` : "UID SEARCH UNSEEN")
      } else if (state === "search" && line.startsWith("* SEARCH")) {
        uidsToFetch = line.replace("* SEARCH", "").trim().split(/\s+/).filter(Boolean).map(Number).filter((value) => value > 0)
      } else if (state === "search" && /^A\d+ OK/.test(line)) {
        if (uidsToFetch.length === 0) {
          state = "done"
          send("LOGOUT")
          setTimeout(() => {
            socket.destroy()
            resolve(emails)
          }, 500)
        } else {
          state = "fetch"
          const batch = uidsToFetch.slice(0, 20)
          uidsToFetch = batch
          send(`UID FETCH ${batch.join(",")} (UID RFC822.HEADER BODY[TEXT])`)
        }
      } else if (state === "fetch") {
        const literalMatch = line.match(/\{(\d+)\}\s*$/)
        if (literalMatch) {
          literalBytesRemaining = Number.parseInt(literalMatch[1], 10)
          fetchingLiteral = true
          currentEmailData = ""
          return
        }
        if (/^A\d+ OK/.test(line)) {
          state = "done"
          send("LOGOUT")
          setTimeout(() => {
            socket.destroy()
            resolve(emails)
          }, 500)
        }
      }
    }
  })
}

function escapeImapString(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')
}

function parseImapEmailData(raw: string, uid: number): ParsedEmail | null {
  try {
    const headerBodySplit = raw.indexOf("\r\n\r\n")
    const headers = headerBodySplit > 0 ? raw.slice(0, headerBodySplit) : raw
    const body = headerBodySplit > 0 ? raw.slice(headerBodySplit + 4) : ""
    const getHeader = (name: string) => {
      const regex = new RegExp(`^${name}:\\s*(.+?)$`, "mi")
      const match = headers.match(regex)
      return match ? match[1].trim() : ""
    }
    const from = getHeader("From")
    const fromMatch = from.match(/<([^>]+)>/)
    const fromEmail = fromMatch ? fromMatch[1] : from
    const fromNameMatch = from.match(/^"?([^"<]+)"?\s*</)
    const fromName = fromNameMatch ? fromNameMatch[1].trim() : undefined
    const attachments = parseEmailAttachments(raw)
    return {
      uid,
      from: fromEmail,
      fromName,
      to: getHeader("To"),
      cc: getHeader("Cc"),
      subject: decodeEmailSubject(getHeader("Subject")),
      body: body.trim().slice(0, 10_000),
      date: getHeader("Date"),
      hasAttachment: /Content-Disposition:\s*attachment/i.test(raw),
      messageId: getHeader("Message-ID"),
      attachments,
    }
  } catch {
    return null
  }
}

function parseEmailAttachments(raw: string): MailAttachment[] {
  const attachmentMatches = [...raw.matchAll(/Content-Disposition:\s*attachment;[^\r\n]*filename="?([^";\r\n]+)"?/gi)]
  return attachmentMatches.map((match) => ({ filename: match[1].trim() }))
}

function decodeEmailSubject(subject: string) {
  return subject.replace(/=\?([^?]+)\?([BQ])\?([^?]+)\?=/gi, (_match, _charset, encoding, text) => {
    if (String(encoding).toUpperCase() === "B") {
      return Buffer.from(String(text), "base64").toString("utf8")
    }
    return String(text).replace(/_/g, " ").replace(/=([0-9A-F]{2})/gi, (_inner, hex) => String.fromCharCode(Number.parseInt(hex, 16)))
  })
}

export function matchesEmailFilters(email: ParsedEmail, filters: EmailFilterRule[]) {
  const enabledFilters = filters.filter((item) => item.enabled)
  if (enabledFilters.length === 0) return true
  return enabledFilters.every((filter) => {
    let fieldValue: string
    switch (filter.field) {
      case "subject": fieldValue = email.subject || ""; break
      case "from": fieldValue = email.from || ""; break
      case "to": fieldValue = email.to || ""; break
      case "cc": fieldValue = email.cc || ""; break
      case "body": fieldValue = email.body || ""; break
      case "has_attachment": return email.hasAttachment
      default: return false
    }
    switch (filter.operator) {
      case "contains": return fieldValue.toLowerCase().includes(filter.value.toLowerCase())
      case "not_contains": return !fieldValue.toLowerCase().includes(filter.value.toLowerCase())
      case "equals": return fieldValue.toLowerCase() === filter.value.toLowerCase()
      case "starts_with": return fieldValue.toLowerCase().startsWith(filter.value.toLowerCase())
      case "ends_with": return fieldValue.toLowerCase().endsWith(filter.value.toLowerCase())
      case "regex":
        try { return new RegExp(filter.value, "i").test(fieldValue) } catch { return false }
      case "is_true": return true
      default: return false
    }
  })
}

export function formatEmailContent(email: ParsedEmail) {
  const parts: string[] = []
  parts.push(`**From:** ${email.fromName ? `${email.fromName} <${email.from}>` : email.from}`)
  if (email.to) parts.push(`**To:** ${email.to}`)
  parts.push(`**Subject:** ${email.subject}`)
  if (email.date) parts.push(`**Date:** ${email.date}`)
  parts.push("")
  parts.push(email.body)
  return parts.join("\n")
}

export async function executeEmailActions(channel: ChannelConfigRecord, email: ParsedEmail, actions: EmailAction[]) {
  for (const action of actions) {
    if (!action.enabled) continue
    try {
      switch (action.type) {
        case "forward":
          if (action.value) await sendEmailMessageWithAttachments(channel, action.value, `Fwd: ${email.subject}`, formatEmailContent(email), email.attachments || [])
          break
        case "webhook":
          if (action.value) {
            await httpRequest(action.value, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ from: email.from, fromName: email.fromName, subject: email.subject, body: email.body, date: email.date, channelId: channel.id, channelName: channel.title }),
            })
          }
          break
        case "auto_reply":
          if (!action.useAgent && action.value) {
            const replyContent = action.value.replace(/\{\{subject\}\}/g, email.subject || "").replace(/\{\{from\}\}/g, email.from || "").replace(/\{\{body\}\}/g, email.body || "")
            await sendEmailMessage(channel, email.from, `Re: ${email.subject}`, replyContent)
          }
          break
        default:
          break
      }
    } catch {
      continue
    }
  }
}

async function sendEmailMessageWithAttachments(channel: ChannelConfigRecord, toAddress: string, subject: string, content: string, attachments: MailAttachment[]) {
  const profile = channel.emailUseGlobalMailService ? getSystemMailProfile() : getChannelMailProfile(channel)
  if (!profile) return { success: false, error: "Missing mail configuration" }
  return sendMail({ profile, toAddress, subject, content, attachments })
}
