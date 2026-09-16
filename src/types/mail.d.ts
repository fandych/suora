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

export type SendMailInput = {
  profile: MailProfile
  toAddress: string
  subject: string
  content: string
  html?: string
  attachments?: MailAttachment[]
}

export type SendMailResult = {
  success: boolean
  error?: string
}

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
