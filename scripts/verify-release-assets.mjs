const REQUIRED_MANIFESTS = ["latest.yml", "latest-linux.yml", "latest-mac.yml"]

function getRequiredEnv(name) {
  const value = process.env[name]?.trim()
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`)
  }
  return value
}

function buildHeaders(token) {
  const headers = {
    Accept: "application/vnd.github+json",
    "User-Agent": "suora-release-verifier",
  }

  if (token) {
    headers.Authorization = `Bearer ${token}`
  }

  return headers
}

async function fetchJson(url, headers) {
  const response = await fetch(url, { headers })
  if (!response.ok) {
    throw new Error(`Request failed for ${url}: ${response.status} ${response.statusText}`)
  }
  return response.json()
}

async function fetchText(url, headers) {
  const response = await fetch(url, { headers })
  if (!response.ok) {
    throw new Error(`Request failed for ${url}: ${response.status} ${response.statusText}`)
  }
  return response.text()
}

function looksLikeUpdaterManifest(text) {
  return /^\s*version:\s+/m.test(text) && /^\s*path:\s+/m.test(text)
}

function normalizeYamlScalar(rawValue) {
  const value = rawValue.trim()
  if (!value) return ""

  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    return value.slice(1, -1)
  }

  return value
}

function extractManifestReferences(manifestText) {
  const references = new Set()
  const patterns = [/^\s*-\s+url:\s+(.+)$/gm, /^\s*path:\s+(.+)$/gm]

  for (const pattern of patterns) {
    for (const match of manifestText.matchAll(pattern)) {
      const value = normalizeYamlScalar(match[1] || "")
      if (value) references.add(value)
    }
  }

  return [...references]
}

async function main() {
  const repository = getRequiredEnv("GITHUB_REPOSITORY")
  const tag = process.env.RELEASE_TAG?.trim() || process.env.GITHUB_REF_NAME?.trim()
  if (!tag) {
    throw new Error("Missing release tag. Set RELEASE_TAG or GITHUB_REF_NAME.")
  }

  const token = process.env.GITHUB_TOKEN?.trim() || process.env.GH_TOKEN?.trim() || ""
  const release = await fetchJson(`https://api.github.com/repos/${repository}/releases/tags/${encodeURIComponent(tag)}`, buildHeaders(token))
  const assets = Array.isArray(release.assets) ? release.assets : []
  const assetsByName = new Map(assets.map((asset) => [asset.name, asset]))
  const assetNames = new Set(assetsByName.keys())
  const errors = []

  for (const manifestName of REQUIRED_MANIFESTS) {
    if (!assetsByName.has(manifestName)) {
      errors.push(`Missing updater manifest asset \"${manifestName}\" on release ${tag}.`)
    }
  }

  for (const manifestName of REQUIRED_MANIFESTS) {
    const manifestAsset = assetsByName.get(manifestName)
    if (!manifestAsset?.browser_download_url) continue

    const manifestText = await fetchText(manifestAsset.browser_download_url, buildHeaders(token))
    if (!looksLikeUpdaterManifest(manifestText)) {
      errors.push(`Release asset \"${manifestName}\" is not a valid updater manifest.`)
      continue
    }

    const references = extractManifestReferences(manifestText)
    const missingAssets = references.filter((reference) => !assetNames.has(reference))
    if (missingAssets.length > 0) {
      errors.push(`Updater manifest \"${manifestName}\" references missing release asset(s): ${missingAssets.join(", ")}.`)
    }
  }

  if (errors.length > 0) {
    for (const error of errors) {
      console.error(error)
    }
    process.exitCode = 1
    return
  }

  console.log(`Verified updater manifests for ${repository}@${tag}.`)
}

await main()