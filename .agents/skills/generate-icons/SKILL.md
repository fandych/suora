---
name: generate-icons
description: Extract SVG icons from a local @iconify/json package and convert them to PNG at 1x, 2x, and 3x resolutions. Use this skill when generating app icons, tab bar icons, or any icon assets from Iconify icon sets.
---

# Icon Generation Guidelines

## Prerequisites

- Node.js v16 or later
- Required npm packages:

```bash
npm install sharp @iconify/json
```

## Project Structure

```
project/
├── extract-icons-offline.js  # SVG extraction script
├── svg-to-png.js             # PNG conversion script
├── package.json
├── icons-svg/                # Output: extracted SVG files
│   └── metadata.json         # Icon metadata
└── icons-png/                # Output: converted PNG files
```

## Configuration

Both scripts share the same three configuration objects. **Keep them identical — they are duplicated by design (no shared config file).**

| Object | Purpose |
|--------|---------|
| `icons` | Maps output filename → Iconify `collection:icon-name` |
| `colorMap` | Per-icon fill color; `default` is the fallback |
| `sizeMap` | Base size in px at 1x; `default` is the fallback |

Example:

```js
const icons = {
  'home.svg':     'material-symbols:home-outline',
  'settings.svg': 'mdi:cog-outline',
  'user.svg':     'lucide:user',
};

const colorMap = {
  'home.svg':     '#999999',
  'settings.svg': '#333333',
  'default':      '#666666',
};

const sizeMap = {
  'home.svg':     81,
  'settings.svg': 48,
  'default':      48,
};
```

## Scripts

### extract-icons-offline.js

Extracts SVG icons from the local Iconify JSON package and generates `metadata.json`.

```js
const fs = require('fs');
const path = require('path');

const ICONIFY_PATH = './node_modules/@iconify/json/json';
const OUTPUT_DIR = './icons-svg';

const icons = {
  'home.svg': 'material-symbols:home-outline',
  // Add your icons here
};

const colorMap = {
  'home.svg': '#999999',
  'default':  '#666666',
};

const sizeMap = {
  'home.svg': 81,
  'default':  48,
};

// Cache for loaded icon collections
const iconCollections = {};

function loadIconCollection(collectionName) {
  if (iconCollections[collectionName]) {
    return iconCollections[collectionName];
  }

  const jsonPath = path.join(ICONIFY_PATH, `${collectionName}.json`);

  if (!fs.existsSync(jsonPath)) {
    throw new Error(`Icon collection not found: ${jsonPath}`);
  }

  const data = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
  iconCollections[collectionName] = data;
  console.log(`📦 Loaded collection: ${collectionName}`);

  return data;
}

function extractIconSvg(collection, iconName) {
  const icon = collection.icons[iconName];

  if (!icon) {
    // Try alternative naming conventions (excluding the already-checked original)
    const altNames = [
      `${iconName}-outline`,
      iconName.replace('-outline', ''),
      iconName.replace(/-/g, '_'),
    ];

    for (const name of altNames) {
      if (collection.icons[name]) {
        return extractIconSvg(collection, name);
      }
    }

    const available = Object.keys(collection.icons).slice(0, 10).join(', ');
    throw new Error(`Icon "${iconName}" not found. Available: ${available}...`);
  }

  const width = icon.width || collection.width || 24;
  const height = icon.height || collection.height || 24;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${icon.body}</svg>`;
}

function generateMetadata() {
  const metadata = {};

  for (const filename of Object.keys(icons)) {
    const baseName = filename.replace('.svg', '');
    metadata[baseName] = {
      color:   colorMap[filename] || colorMap.default,
      size:    sizeMap[filename]  || sizeMap.default,
      iconify: icons[filename],
    };
  }

  const metadataPath = path.join(OUTPUT_DIR, 'metadata.json');
  fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));
  console.log(`\n📝 Metadata saved to: ${metadataPath}`);
}

function extractAll() {
  console.log('🚀 Extracting icons from local Iconify package...\n');
  console.log(`📊 Total icons: ${Object.keys(icons).length}\n`);

  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  let successCount = 0;
  let failCount = 0;
  const errors = [];

  for (const [filename, iconFullName] of Object.entries(icons)) {
    try {
      const [collectionName, iconName] = iconFullName.split(':');
      const collection = loadIconCollection(collectionName);
      const svg = extractIconSvg(collection, iconName);

      const outputPath = path.join(OUTPUT_DIR, filename);
      fs.writeFileSync(outputPath, svg);

      console.log(`✅ ${filename.padEnd(35)} <- ${iconFullName}`);
      successCount++;
    } catch (error) {
      console.error(`❌ ${filename.padEnd(35)} - ${error.message}`);
      errors.push({ filename, iconFullName, error: error.message });
      failCount++;
    }
  }

  console.log('\n' + '='.repeat(70));
  console.log('✨ Extraction completed!');
  console.log(`📁 SVG files saved to: ${OUTPUT_DIR}`);
  console.log(`✅ Success: ${successCount} icons`);
  console.log(`❌ Failed: ${failCount} icons`);
  console.log('='.repeat(70));

  if (errors.length > 0) {
    console.log('\n❌ Failed icons:');
    errors.forEach((e) => console.log(`   - ${e.filename}: ${e.error}`));
  }

  generateMetadata();
}

extractAll();
```

### svg-to-png.js

Converts extracted SVG icons to PNG at 1x, 2x, and 3x resolutions.

```js
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const INPUT_DIR = './icons-svg';
const OUTPUT_DIR = './icons-png';

// Must match extract-icons-offline.js configuration
const colorMap = {
  'home.svg': '#999999',
  'default':  '#666666',
};

const sizeMap = {
  'home.svg': 81,
  'default':  48,
};

async function convertSvgToPng(svgPath, pngPath, color, size) {
  try {
    let svgContent = fs.readFileSync(svgPath, 'utf-8');

    svgContent = svgContent.replace(/currentColor/g, color);
    svgContent = svgContent.replace(/fill="[^"]*"/g, `fill="${color}"`);
    svgContent = svgContent.replace(/stroke="[^"]*"/g, `stroke="${color}"`);

    const svgBuffer = Buffer.from(svgContent);
    const base = pngPath.slice(0, -4); // strip .png suffix

    await sharp(svgBuffer).resize(size,     size    ).png().toFile(`${base}.png`);
    await sharp(svgBuffer).resize(size * 2, size * 2).png().toFile(`${base}@2x.png`);
    await sharp(svgBuffer).resize(size * 3, size * 3).png().toFile(`${base}@3x.png`);

    console.log(`✅ ${path.basename(pngPath).padEnd(30)} ${size}x${size}px (1x/2x/3x)`);
  } catch (error) {
    console.error(`❌ Failed: ${path.basename(pngPath)} - ${error.message}`);
  }
}

async function convertAll() {
  console.log('🎨 Converting SVG to PNG...\n');

  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  const files = fs.readdirSync(INPUT_DIR).filter((f) => f.endsWith('.svg'));
  console.log(`📊 Total files: ${files.length}\n`);

  for (const file of files) {
    const color = colorMap[file] || colorMap.default;
    const size  = sizeMap[file]  || sizeMap.default;
    const svgPath = path.join(INPUT_DIR, file);
    const pngPath = path.join(OUTPUT_DIR, file.replace('.svg', '.png'));

    await convertSvgToPng(svgPath, pngPath, color, size);
  }

  console.log('\n' + '='.repeat(60));
  console.log('✨ Conversion completed!');
  console.log(`📁 PNG files saved to: ${OUTPUT_DIR}`);
  console.log(`📦 Generated: 1x, 2x, 3x versions for each icon`);
  console.log('='.repeat(60));
}

convertAll();
```

## package.json

```json
{
  "name": "icon-generator",
  "version": "1.0.0",
  "description": "Generate SVG and PNG icons from Iconify icon sets",
  "scripts": {
    "extract":  "node extract-icons-offline.js",
    "convert":  "node svg-to-png.js",
    "generate": "npm run extract && npm run convert",
    "clean":    "rimraf icons-svg icons-png"
  },
  "dependencies": {
    "sharp":         "^0.33.0",
    "@iconify/json": "^2.2.422"
  },
  "devDependencies": {
    "rimraf": "^5.0.0"
  }
}
```

> **Note:** `@iconify/json` is a runtime dependency (accessed via the filesystem at `./node_modules/@iconify/json/json`). `rimraf` provides cross-platform `clean` support on Windows, macOS, and Linux.

## Usage

1. **Configure icons**: Update `icons`, `colorMap`, and `sizeMap` identically in both scripts
2. **Extract SVGs**: `npm run extract`
3. **Convert to PNG**: `npm run convert`
4. **Or run both**: `npm run generate`
5. **Clean output**: `npm run clean`

## Finding Icons

Browse available icons at [Iconify Icon Sets](https://icon-sets.iconify.design/). Use the format `collection:icon-name` (e.g., `mdi:home`, `lucide:settings`).
