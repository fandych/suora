---
name: generate-icons
description: Generate app, tab bar, toolbar, or UI icon assets from local Iconify icon sets. Use this skill whenever the user needs SVG extraction from `@iconify/json`, PNG exports at 1x/2x/3x, icon asset automation, or consistent icon color/size generation, even if they only mention needing app icons or tab bar images.
---

# Generate Icons

Use this skill to extract SVG icons from a local `@iconify/json` package and convert them to PNG at 1x, 2x, and 3x resolutions.

## Workflow

1. Confirm the desired icon list, output filenames, colors, base sizes, and output directories.
2. Verify the project already has Node.js and the needed packages (`sharp` and `@iconify/json`) or ask before adding them.
3. Copy the bundled scripts into the working project or adapt existing project scripts:
   - `scripts/extract-icons-offline.js` extracts SVG files and writes `metadata.json`.
   - `scripts/svg-to-png.js` converts SVG files into PNG, `@2x`, and `@3x` outputs.
4. Keep the `icons`, `colorMap`, and `sizeMap` objects identical in both scripts unless you intentionally centralize configuration in the target project.
5. Run extraction before conversion, then inspect generated assets for missing icons, incorrect fills/strokes, or size mismatches.

## Configuration contract

| Object | Purpose |
| --- | --- |
| `icons` | Maps output filename to Iconify `collection:icon-name`. |
| `colorMap` | Maps output filename to fill/stroke color; `default` is the fallback. |
| `sizeMap` | Maps output filename to base 1x PNG size in pixels; `default` is the fallback. |

Example values:

```js
const icons = {
  'home.svg': 'material-symbols:home-outline',
  'settings.svg': 'mdi:cog-outline',
}

const colorMap = {
  'home.svg': '#999999',
  default: '#666666',
}

const sizeMap = {
  'home.svg': 81,
  default: 48,
}
```

## Package script template

Use this shape when the target project needs npm scripts:

```json
{
  "scripts": {
    "icons:extract": "node scripts/extract-icons-offline.js",
    "icons:convert": "node scripts/svg-to-png.js",
    "icons:generate": "npm run icons:extract && npm run icons:convert"
  },
  "dependencies": {
    "@iconify/json": "^2.2.422",
    "sharp": "^0.33.0"
  }
}
```

## Finding icons

Browse available names at <https://icon-sets.iconify.design/> and use the `collection:icon-name` format, such as `mdi:home` or `lucide:settings`.
