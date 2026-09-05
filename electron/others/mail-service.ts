import net from "node:net"
import tls from "node:tls"

import type { PreferenceSettings } from "@/data/domain/preference-settings"
import { getPreferenceSettingsSnapshot } from "@electron/others/preferences"

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

export async function sendMail({ profile, toAddress, subject, content }: SendMailInput): Promise<SendMailResult> {
  if (!profile.host || !profile.username || !profile.password || !profile.fromAddress) {
    return { success: false, error: "Missing SMTP configuration" }
  }

  return new Promise<SendMailResult>((resolve) => {
    let buffer = ""
    let step: "greeting" | "ehlo" | "auth_start" | "auth_user" | "auth_pass" | "from" | "to" | "data" | "body" = "greeting"
    const socket: net.Socket = profile.useTls
      ? tls.connect({ host: profile.host, port: profile.port, rejectUnauthorized: false })
      : net.createConnection({ host: profile.host, port: profile.port })

    const timeout = setTimeout(() => {
      socket.destroy()
      resolve({ success: false, error: "SMTP connection timeout" })
    }, 30_000)

    socket.setEncoding("utf8")
    socket.on("data", (data: string) => {
      buffer += data
      const lines = buffer.split("\r\n")
      buffer = lines.pop() || ""
      for (const line of lines) {
        if (!line) continue
        const code = Number.parseInt(line.slice(0, 3), 10)
        switch (step) {
          case "greeting":
            if (code === 220) {
              step = "ehlo"
              socket.write("EHLO localhost\r\n")
            }
            break
          case "ehlo":
            if (code === 250 && !line.startsWith("250-")) {
              step = "auth_start"
              socket.write("AUTH LOGIN\r\n")
            }
            break
          case "auth_start":
            if (code === 334) {
              step = "auth_user"
              socket.write(`${Buffer.from(profile.username).toString("base64")}\r\n`)
            }
            break
          case "auth_user":
            if (code === 334) {
              step = "auth_pass"
              socket.write(`${Buffer.from(profile.password).toString("base64")}\r\n`)
            }
            break
          case "auth_pass":
            if (code === 235) {
              step = "from"
              socket.write(`MAIL FROM:<${profile.fromAddress}>\r\n`)
            } else {
              clearTimeout(timeout)
              socket.destroy()
              resolve({ success: false, error: `SMTP auth failed: ${line}` })
            }
            break
          case "from":
            if (code === 250) {
              step = "to"
              socket.write(`RCPT TO:<${toAddress}>\r\n`)
            }
            break
          case "to":
            if (code === 250) {
              step = "data"
              socket.write("DATA\r\n")
            }
            break
          case "data":
            if (code === 354) {
              step = "body"
              socket.write([
                `From: "${profile.fromName}" <${profile.fromAddress}>`,
                `To: <${toAddress}>`,
                `Subject: ${subject}`,
                `Date: ${new Date().toUTCString()}`,
                "MIME-Version: 1.0",
                "Content-Type: text/plain; charset=UTF-8",
                "",
                content,
                ".",
                "",
              ].join("\r\n"))
            }
            break
          case "body":
            clearTimeout(timeout)
            socket.destroy()
            resolve(code === 250 ? { success: true } : { success: false, error: `SMTP send failed: ${line}` })
            break
        }
      }
    })

    socket.on("error", (error) => {
      clearTimeout(timeout)
      resolve({ success: false, error: error.message })
    })
  })
}