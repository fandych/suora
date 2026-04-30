const fs = require('fs')
const path = require('path')

const ICONIFY_PATH = './node_modules/@iconify/json/json'
const OUTPUT_DIR = './icons-svg'

const icons = {
  'home.svg': 'material-symbols:home-outline',
}

const colorMap = {
  'home.svg': '#999999',
  default: '#666666',
}

const sizeMap = {
  'home.svg': 81,
  default: 48,
}

const iconCollections = {}

function loadIconCollection(collectionName) {
  if (iconCollections[collectionName]) return iconCollections[collectionName]

  const jsonPath = path.join(ICONIFY_PATH, `${collectionName}.json`)
  if (!fs.existsSync(jsonPath)) {
    throw new Error(`Icon collection not found: ${jsonPath}`)
  }

  const data = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'))
  iconCollections[collectionName] = data
  console.log(`Loaded collection: ${collectionName}`)
  return data
}

function extractIconSvg(collection, iconName) {
  const icon = collection.icons[iconName]
  if (!icon) {
    const altNames = [
      `${iconName}-outline`,
      iconName.replace('-outline', ''),
      iconName.replace(/-/g, '_'),
    ]

    for (const name of altNames) {
      if (name !== iconName && collection.icons[name]) {
        return extractIconSvg(collection, name)
      }
    }

    const available = Object.keys(collection.icons).slice(0, 10).join(', ')
    throw new Error(`Icon "${iconName}" not found. Available: ${available}...`)
  }

  const width = icon.width || collection.width || 24
  const height = icon.height || collection.height || 24
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${icon.body}</svg>`
}

function writeMetadata() {
  const metadata = {}
  for (const filename of Object.keys(icons)) {
    const baseName = filename.replace('.svg', '')
    metadata[baseName] = {
      color: colorMap[filename] || colorMap.default,
      size: sizeMap[filename] || sizeMap.default,
      iconify: icons[filename],
    }
  }

  fs.writeFileSync(path.join(OUTPUT_DIR, 'metadata.json'), JSON.stringify(metadata, null, 2))
}

function extractAll() {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true })

  let successCount = 0
  const errors = []

  for (const [filename, iconFullName] of Object.entries(icons)) {
    try {
      const [collectionName, iconName] = iconFullName.split(':')
      const collection = loadIconCollection(collectionName)
      const svg = extractIconSvg(collection, iconName)
      fs.writeFileSync(path.join(OUTPUT_DIR, filename), svg)
      console.log(`Extracted ${filename} <- ${iconFullName}`)
      successCount += 1
    } catch (error) {
      console.error(`Failed ${filename}: ${error.message}`)
      errors.push({ filename, iconFullName, error: error.message })
    }
  }

  writeMetadata()
  console.log(`Extraction complete: ${successCount} succeeded, ${errors.length} failed`)

  if (errors.length > 0) {
    process.exitCode = 1
  }
}

extractAll()
