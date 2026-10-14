// Downloads the sample-property photographs listed in demoPhotos.js into public/images/properties/ as optimized
// 900x675 JPEGs. Files that already exist are skipped. This only writes local image files: no database access.
// Usage: node init/downloadDemoPhotos.js
const fs = require("fs");
const path = require("path");
const https = require("https");
const { photos } = require("./demoPhotos.js");

const outDir = path.join(__dirname, "..", "public", "images", "properties");
const MIN_BYTES = 20 * 1024;
const MAX_BYTES = 250 * 1024;

const download = (url) =>
  new Promise((resolve, reject) => {
    https
      .get(url, { headers: { "User-Agent": "Mozilla/5.0 (Elites Hub demo photo downloader)" } }, (res) => {
        if (res.statusCode !== 200) {
          res.resume();
          return reject(new Error(`HTTP ${res.statusCode}`));
        }
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => resolve(Buffer.concat(chunks)));
      })
      .on("error", reject);
  });

const isJpeg = (buf) => buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;

(async () => {
  fs.mkdirSync(outDir, { recursive: true });
  let added = 0, skipped = 0;
  const failed = [];
  for (const [slug, p] of Object.entries(photos)) {
    const file = path.join(outDir, `${slug}.jpg`);
    if (fs.existsSync(file)) { skipped++; continue; }
    try {
      const buf = await download(`https://images.unsplash.com/photo-${p.unsplashId}?w=900&h=675&fit=crop&q=62&fm=jpg`);
      if (!isJpeg(buf) || buf.length < MIN_BYTES || buf.length > MAX_BYTES) throw new Error(`unexpected file (${buf.length} bytes)`);
      fs.writeFileSync(file, buf);
      added++;
    } catch (err) {
      failed.push(`${slug}: ${err.message}`);
    }
  }
  console.log(`photos: ${added} downloaded, ${skipped} already present, ${failed.length} failed`);
  failed.forEach((f) => console.log("  FAILED " + f));
  process.exit(failed.length ? 1 : 0);
})();

