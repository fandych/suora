import dns from "node:dns/promises"
import net from "node:net"

const BLOCKED_HOSTNAMES = new Set(["localhost", "localhost.localdomain", "metadata.google.internal"])

function isPrivateAddress(address: string) {
  const version = net.isIP(address)
  if (version === 4) {
    const [a, b] = address.split(".").map(Number)
    return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168)
  }
  if (version === 6) {
    const normalized = address.toLowerCase()
    return normalized === "::1" || normalized === "::" || normalized.startsWith("fc") || normalized.startsWith("fd") || normalized.startsWith("fe80:")
  }
  return true
}

export async function assertSafeHttpUrl(value: string, options?: { allowLocalNetwork?: boolean }) {
  let url: URL
  try {
    url = new URL(value)
  } catch {
    throw new Error("Invalid URL.")
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Only HTTP and HTTPS URLs are allowed.")
  }

  const hostname = url.hostname.toLowerCase().replace(/^\[|\]$/g, "")
  if (options?.allowLocalNetwork) {
    return url
  }

  if (BLOCKED_HOSTNAMES.has(hostname) || isPrivateAddress(hostname)) {
    throw new Error("Private and local network URLs are not allowed.")
  }

  try {
    const records = await dns.lookup(hostname, { all: true, verbatim: true })
    if (records.length === 0 || records.some((record) => isPrivateAddress(record.address))) {
      throw new Error("Private and local network URLs are not allowed.")
    }
  } catch (error) {
    if (error instanceof Error && error.message.includes("Private and local")) {
      throw error
    }
    throw new Error("Unable to resolve the target URL.", { cause: error })
  }

  return url
}