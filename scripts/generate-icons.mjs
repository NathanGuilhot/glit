import sharp from 'sharp'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const rootDir = path.resolve(__dirname, '..')

const svgPath = path.join(rootDir, 'assets/glit.svg')
const buildDir = path.join(rootDir, 'build')
const iconsetDir = path.join(buildDir, 'icon.iconset')

const BACKGROUND_COLOR = '#1a1a2e'
const SYMBOL_COLOR = '#ffffff'
const ICON_SIZE = 1024
const PADDING = 200
const CORNER_RADIUS = 180

const iconsetSizes = [
  { name: 'icon_16x16.png', size: 16 },
  { name: 'icon_16x16@2x.png', size: 32 },
  { name: 'icon_32x32.png', size: 32 },
  { name: 'icon_32x32@2x.png', size: 64 },
  { name: 'icon_64x64.png', size: 64 },
  { name: 'icon_64x64@2x.png', size: 128 },
  { name: 'icon_128x128.png', size: 128 },
  { name: 'icon_128x128@2x.png', size: 256 },
  { name: 'icon_256x256.png', size: 256 },
  { name: 'icon_256x256@2x.png', size: 512 },
  { name: 'icon_512x512.png', size: 512 },
  { name: 'icon_512x512@2x.png', size: 1024 },
]

async function applyRoundedCorners(inputBuffer, size) {
  const scale = size / ICON_SIZE
  const radius = Math.round(CORNER_RADIUS * scale)

  const maskSvg = `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
    <rect x="0" y="0" width="${size}" height="${size}" rx="${radius}" ry="${radius}" fill="white"/>
  </svg>`

  return await sharp(inputBuffer)
    .composite([{
      input: Buffer.from(maskSvg),
      blend: 'dest-in'
    }])
    .png()
    .toBuffer()
}

async function generateIcons() {
  if (!fs.existsSync(svgPath)) {
    console.error(`Error: ${svgPath} not found`)
    process.exit(1)
  }

  if (!fs.existsSync(buildDir)) {
    fs.mkdirSync(buildDir, { recursive: true })
  }

  if (!fs.existsSync(iconsetDir)) {
    fs.mkdirSync(iconsetDir, { recursive: true })
  }

  const svgContent = fs.readFileSync(svgPath, 'utf-8')

  const innerSize = ICON_SIZE - (PADDING * 2)
  const scale = innerSize / 12
  const offsetX = PADDING + (innerSize - 12 * scale) / 2
  const offsetY = PADDING + (innerSize - 12 * scale) / 2

  const finalSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${ICON_SIZE}" height="${ICON_SIZE}" viewBox="0 0 ${ICON_SIZE} ${ICON_SIZE}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#1a1a2e"/>
      <stop offset="50%" style="stop-color:#16213e"/>
      <stop offset="100%" style="stop-color:#0f3460"/>
    </linearGradient>
  </defs>
  <rect width="100%" height="100%" fill="url(#bg)"/>
  <g transform="translate(${offsetX}, ${offsetY}) scale(${scale})">
    <g transform="translate(-34.334658,-103.1347)">
      <path d="m 34.676386,109.11541 q 0,-0.30868 0.225999,-0.53468 0.225996,-0.226 0.540189,-0.226 0.314193,0 0.540192,0.226 0.225999,0.226 0.225999,0.54019 0,0.31971 -0.225999,0.54571 -0.220485,0.22048 -0.540192,0.22048 -0.325215,0 -0.545703,-0.22048 -0.220485,-0.22049 -0.220485,-0.55122 z m 3.483681,3.64354 q 0,-0.30868 0.225999,-0.53468 0.225999,-0.226 0.540192,-0.226 0.314193,0 0.540192,0.226 0.225999,0.226 0.225999,0.54019 0,0.3197 -0.225999,0.5457 -0.220488,0.22049 -0.540192,0.22049 -0.325218,0 -0.545703,-0.22049 -0.220488,-0.22048 -0.220488,-0.55121 z m 6.151568,-8.02019 q 0.68902,0 1.185113,0.50161 0.496094,0.49609 0.496094,1.19613 0,0.70556 -0.501605,1.20717 -0.496094,0.49609 -1.20165,0.49609 -0.705556,0 -1.207161,-0.49609 -0.496097,-0.50161 -0.496097,-1.20165 0,-0.7221 0.501608,-1.20717 0.501605,-0.49609 1.223698,-0.49609 z m -0.01103,0.84887 q -0.380339,0 -0.644925,0.24805 -0.259069,0.24805 -0.259069,0.61185 0,0.38585 0.264583,0.65594 0.264583,0.2701 0.628385,0.2701 0.374828,0 0.628386,-0.2701 0.264583,-0.27009 0.264583,-0.65594 0,-0.35829 -0.259072,-0.60634 -0.253558,-0.25356 -0.622871,-0.25356 z" 
            fill="#ffffff" 
            opacity="0.847145"
            style="font-size:42.6667px;font-family:Futura"/>
    </g>
  </g>
</svg>`

  console.log('Generating master icon at 1024x1024...')
  
  const svgBuffer = Buffer.from(finalSvg)
  const masterPng = await sharp(svgBuffer)
    .resize(ICON_SIZE, ICON_SIZE)
    .png()
    .toBuffer()

  console.log('Generating iconset files...')
  for (const { name, size } of iconsetSizes) {
    const resizedBuffer = await sharp(masterPng)
      .resize(size, size)
      .png()
      .toBuffer()
    const roundedBuffer = await applyRoundedCorners(resizedBuffer, size)
    fs.writeFileSync(path.join(iconsetDir, name), roundedBuffer)
    console.log(`  Created ${name}`)
  }

  console.log('Generating icon.png (512x512)...')
  const iconPngBuffer = await sharp(masterPng)
    .resize(512, 512)
    .png()
    .toBuffer()
  const roundedIconBuffer = await applyRoundedCorners(iconPngBuffer, 512)
  fs.writeFileSync(path.join(buildDir, 'icon.png'), roundedIconBuffer)

  console.log('Generating icon.icns (macOS)...')
  if (process.platform === 'darwin') {
    const { execSync } = await import('child_process')
    try {
      execSync(`iconutil -c icns "${iconsetDir}" -o "${buildDir}/icon.icns"`, {
        stdio: 'inherit',
      })
      console.log('  Created icon.icns')
    } catch (error) {
      console.log('  iconutil not available, skipping .icns generation')
    }
  } else {
    console.log('  Skipping .icns (not macOS)')
  }

  console.log('\nIcon generation complete!')
  console.log(`  Output: ${buildDir}/icon.png`)
  console.log(`  Iconset: ${iconsetDir}/`)
}

generateIcons().catch((err) => {
  console.error('Error generating icons:', err)
  process.exit(1)
})
