const fs = require('fs')
const path = require('path')
const sharp = require('sharp')

const INPUT_DIR = './icons-svg'
const OUTPUT_DIR = './icons-png'

const colorMap = {
  'home.svg': '#999999',
  default: '#666666',
}

const sizeMap = {
  'home.svg': 81,
  default: 48,
}

async function convertSvgToPng(svgPath, pngPath, color, size) {
  let svgContent = fs.readFileSync(svgPath, 'utf-8')
  svgContent = svgContent.replace(/currentColor/g, color)
  svgContent = svgContent.replace(/fill="[^"]*"/g, `fill="${color}"`)
  svgContent = svgContent.replace(/stroke="[^"]*"/g, `stroke="${color}"`)

  const svgBuffer = Buffer.from(svgContent)
  const base = pngPath.slice(0, -4)

  await sharp(svgBuffer).resize(size, size).png().toFile(`${base}.png`)
  await sharp(svgBuffer).resize(size * 2, size * 2).png().toFile(`${base}@2x.png`)
  await sharp(svgBuffer).resize(size * 3, size * 3).png().toFile(`${base}@3x.png`)
}

async function convertAll() {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true })

  const files = fs.readdirSync(INPUT_DIR).filter((file) => file.endsWith('.svg'))
  for (const file of files) {
    const color = colorMap[file] || colorMap.default
    const size = sizeMap[file] || sizeMap.default
    const svgPath = path.join(INPUT_DIR, file)
    const pngPath = path.join(OUTPUT_DIR, file.replace('.svg', '.png'))
    await convertSvgToPng(svgPath, pngPath, color, size)
    console.log(`Converted ${file} at ${size}px, ${size * 2}px, and ${size * 3}px`)
  }

  console.log(`Conversion complete: ${files.length} icon(s)`)
}

convertAll().catch((error) => {
  console.error(error)
  process.exit(1)
})
