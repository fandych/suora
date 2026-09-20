import dns from "node:dns/promises"
import type { LookupOneOptions } from "node:dns"
import type { RequestOptions } from "node:http"
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

function parseHttpUrl(value: string | URL) {
  let url: URL
  try {
    url = value instanceof URL ? new URL(value.toString()) : new URL(value)
  } catch {
    throw new Error("Invalid URL.")
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Only HTTP and HTTPS URLs are allowed.")
  }

  const hostname = url.hostname.toLowerCase().replace(/^\[|\]$/g, "")
  return { url, hostname }
}

function createPinnedLookup(address: string, family: number) {
  return ((
    _hostname: string,
    _options: LookupOneOptions,
    callback: (error: NodeJS.ErrnoException | null, address: string, family: number) => void,
  ) => callback(null, address, family)) as NonNullable<RequestOptions["lookup"]>
}

export async function resolveSafeHttpTarget(
  value: string | URL,
  options?: { allowLocalNetwork?: boolean; skipDnsResolution?: boolean },
) {
  const { url, hostname } = parseHttpUrl(value)
  if (options?.allowLocalNetwork) {
    return { url }
  }

  // Only reject when the hostname is a blocked name or a literal private IP.
  // Domain names are classified after DNS resolution below.
  if (BLOCKED_HOSTNAMES.has(hostname) || (net.isIP(hostname) !== 0 && isPrivateAddress(hostname))) {
    throw new Error("Private and local network URLs are not allowed.")
  }

  if (options?.skipDnsResolution) {
    return { url }
  }

  const ipFamily = net.isIP(hostname)
  if (ipFamily !== 0) {
    return { url, lookup: createPinnedLookup(hostname, ipFamily) }
  }

  try {
    const records = await dns.lookup(hostname, { all: true, verbatim: true })
    if (records.length === 0 || records.some((record) => isPrivateAddress(record.address))) {
      throw new Error("Private and local network URLs are not allowed.")
    }
    const [selected] = records
    return { url, lookup: createPinnedLookup(selected.address, selected.family) }
  } catch (error) {
    if (error instanceof Error && error.message.includes("Private and local")) {
      throw error
    }
    throw new Error("Unable to resolve the target URL.", { cause: error })
  }
}

export async function assertSafeHttpUrl(value: string | URL, options?: { allowLocalNetwork?: boolean; skipDnsResolution?: boolean }) {
  return (await resolveSafeHttpTarget(value, options)).url
}