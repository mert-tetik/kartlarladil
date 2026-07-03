import sharp from 'sharp';
import path from 'path';

const source = 'C:/Users/CASPER/Downloads/logo2.png';
const baseDir = 'com.foxiesdeck/app/src/main/res';
const sizes = {
  'mipmap-mdpi': 48,
  'mipmap-hdpi': 72,
  'mipmap-xhdpi': 96,
  'mipmap-xxhdpi': 144,
  'mipmap-xxxhdpi': 192,
};

for (const [dir, size] of Object.entries(sizes)) {
  const out = path.join(baseDir, dir, 'ic_launcher.png');
  await sharp(source)
    .resize(size, size, { fit: 'cover' })
    .png()
    .toFile(out);
  console.log(`Generated ${out} (${size}x${size})`);
}
