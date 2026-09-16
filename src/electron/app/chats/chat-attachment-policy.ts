export const MAX_CHAT_ATTACHMENT_BYTES = 10 * 1024 * 1024
export const MAX_CHAT_ATTACHMENTS = 5
export const MAX_CHAT_ATTACHMENT_TOTAL_BYTES = 25 * 1024 * 1024

const allowedMediaTypes = ["image/", "text/", "application/pdf", "application/json"]

export function validateChatAttachments(
  attachments: Array<{ name: string; mediaType: string; data: string; sizeBytes?: number }>,
) {
  if (attachments.length > MAX_CHAT_ATTACHMENTS) throw new Error(`You can attach up to ${MAX_CHAT_ATTACHMENTS} files.`)
  let totalBytes = 0
  for (const attachment of attachments) {
    const sizeBytes = attachment.sizeBytes ?? getDataUrlSize(attachment.data)
    if (sizeBytes > MAX_CHAT_ATTACHMENT_BYTES) throw new Error(`${attachment.name} exceeds the 10 MB attachment limit.`)
    if (!allowedMediaTypes.some((type) => attachment.mediaType.startsWith(type)))
      throw new Error(`${attachment.name} has an unsupported attachment type.`)
    if (!attachment.data.startsWith("data:"))
      throw new Error(`${attachment.name} must use a data URL attachment payload.`)
    totalBytes += sizeBytes
  }
  if (totalBytes > MAX_CHAT_ATTACHMENT_TOTAL_BYTES) throw new Error("The total attachment size cannot exceed 25 MB.")
}

function getDataUrlSize(data: string) {
  const separator = data.indexOf(",")
  if (separator === -1) return 0
  const payload = data.slice(separator + 1)
  return Math.floor((payload.length * 3) / 4)
}
