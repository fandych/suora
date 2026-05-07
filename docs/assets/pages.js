const pageLanguage = document.documentElement.lang && document.documentElement.lang.trim()
  ? document.documentElement.lang.trim()
  : 'en'

const releaseDateFormatter = new Intl.DateTimeFormat(pageLanguage, {
  dateStyle: 'medium',
})

function text(id, value) {
  const node = document.getElementById(id)
  if (node && value) {
    node.textContent = value
  }
}

function href(id, value) {
  const node = document.getElementById(id)
  if (node && value) {
    node.href = value
  }
}

function assignPlatformAsset(slot, asset) {
  if (!asset) {
    return
  }

  href(`download-${slot}`, asset.browser_download_url)
  text(`download-${slot}-name`, asset.name)
}

function mapPlatformAssets(assets) {
  const byMatch = (matcher) => assets.find(matcher)
  assignPlatformAsset('windows-setup', byMatch((asset) => asset.name.toLowerCase().endsWith('.exe') && asset.name.toLowerCase().includes('setup')))
  assignPlatformAsset('windows-portable', byMatch((asset) => asset.name.toLowerCase().endsWith('.exe') && !asset.name.toLowerCase().includes('setup')))
  assignPlatformAsset('macos-dmg', byMatch((asset) => asset.name.toLowerCase().endsWith('.dmg')))
  assignPlatformAsset('macos-zip', byMatch((asset) => asset.name.toLowerCase().endsWith('.zip')))
  assignPlatformAsset('linux-appimage', byMatch((asset) => asset.name.toLowerCase().endsWith('.appimage')))
  assignPlatformAsset('linux-deb', byMatch((asset) => asset.name.toLowerCase().endsWith('.deb')))
  assignPlatformAsset('linux-rpm', byMatch((asset) => asset.name.toLowerCase().endsWith('.rpm')))
}

async function hydrateLatestRelease() {
  const releaseLinks = document.querySelectorAll('[data-latest-release-link="true"]')
  const releaseLive = document.body.dataset.releaseLive
  const releaseFallback = document.body.dataset.releaseFallback
  const releaseLabelPrefix = document.body.dataset.releaseLabelPrefix || 'Open'
  const releaseSummaryPrefix = document.body.dataset.releaseSummaryPrefix || 'Download the latest packages from'
  const assetSingular = document.body.dataset.assetSingular || 'file'
  const assetPlural = document.body.dataset.assetPlural || 'files'
  const releaseDateFallback = document.body.dataset.releaseDateFallback || 'Unknown'

  try {
    const response = await fetch('https://api.github.com/repos/fandych/suora/releases/latest', {
      headers: {
        Accept: 'application/vnd.github+json',
      },
    })

    if (!response.ok) {
      throw new Error(`GitHub release request failed with ${response.status}`)
    }

    const latestRelease = await response.json()
    const publishedAt = latestRelease.published_at || latestRelease.created_at
    const assetCount = Array.isArray(latestRelease.assets) ? latestRelease.assets.length : 0
    const releaseUrl = latestRelease.html_url || 'https://github.com/fandych/suora/releases/latest'
    const tagName = latestRelease.tag_name || 'latest'

    text('latest-release-tag', tagName)
    text('latest-release-date', publishedAt ? releaseDateFormatter.format(new Date(publishedAt)) : releaseDateFallback)
    text('latest-release-assets', `${assetCount} ${assetCount === 1 ? assetSingular : assetPlural}`)
    text('latest-release-link-label', `${releaseLabelPrefix} ${tagName}`)
    text('release-summary-copy', `${releaseSummaryPrefix} ${tagName}.`)
    text('latest-release-status', releaseLive)

    releaseLinks.forEach((link) => {
      link.href = releaseUrl
    })

    if (Array.isArray(latestRelease.assets)) {
      mapPlatformAssets(latestRelease.assets)
    }
  } catch (error) {
    text('latest-release-status', releaseFallback)
    console.error(error)
  }
}

hydrateLatestRelease()
