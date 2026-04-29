const textEncoder = new TextEncoder()

export async function sha256Text(text: string): Promise<string> {
  const data = textEncoder.encode(text)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(hashBuffer)).map((byte) => byte.toString(16).padStart(2, '0')).join('')
}
