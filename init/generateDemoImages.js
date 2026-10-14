// Generates the original SVG illustrations used by the demo listings (public/images/demo/*.svg).
// Run with: node init/generateDemoImages.js   (writes local files only; no database or network access)
const fs = require("fs");
const path = require("path");
const { demoListings } = require("./demoListings.js");

const W = 800;
const H = 600;

const windows = (x, y, cols, rows, w, h, gx, gy, fill) => {
  let out = "";
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) out += `<rect x="${x + c * gx}" y="${y + r * gy}" width="${w}" height="${h}" rx="2" fill="${fill}"/>`;
  return out;
};
const palm = (x, base, h) => `<path d="M${x} ${base} Q${x + 8} ${base - h / 2} ${x + 2} ${base - h}" stroke="#6b4f2a" stroke-width="9" fill="none" stroke-linecap="round"/>` +
  [-70, -35, 0, 35, 70].map((a) => `<path d="M${x + 2} ${base - h} q${a} -40 ${a * 1.6} ${10 + Math.abs(a) / 3}" stroke="#2d6a4f" stroke-width="10" fill="none" stroke-linecap="round"/>`).join("");
const pine = (x, base, s) => `<polygon points="${x},${base - 90 * s} ${x - 28 * s},${base - 30 * s} ${x + 28 * s},${base - 30 * s}" fill="#2f6f4f"/><polygon points="${x},${base - 60 * s} ${x - 36 * s},${base} ${x + 36 * s},${base}" fill="#3a8560"/><rect x="${x - 4 * s}" y="${base}" width="${8 * s}" height="${16 * s}" fill="#5b3a29"/>`;

const scenes = {
  villa: ([, , a, g]) => `
    <rect y="430" width="${W}" height="${H - 430}" fill="${g}"/>
    <rect y="395" width="${W}" height="45" fill="#3a9bc1" opacity=".85"/>
    <path d="M0 410 q50 -12 100 0 t100 0 t100 0 t100 0 t100 0 t100 0 t100 0 t100 0" stroke="#fff" stroke-width="3" fill="none" opacity=".7"/>
    <rect x="200" y="300" width="380" height="135" fill="#fffaf0"/>
    <rect x="180" y="282" width="420" height="20" fill="${a}"/>
    <rect x="260" y="330" width="90" height="105" fill="#bfe3f2" opacity=".9"/><rect x="430" y="330" width="110" height="60" fill="#bfe3f2" opacity=".9"/>
    <rect x="370" y="360" width="46" height="75" fill="${a}"/>
    <rect x="120" y="455" width="260" height="38" rx="8" fill="#5bc0de"/>
    ${palm(660, 470, 190)}${palm(110, 470, 140)}`,
  tower: ([, , a, g]) => {
    const b = [[60, 300, 110], [190, 220, 130], [340, 130, 160], [520, 250, 120], [650, 320, 100]];
    return `<rect y="470" width="${W}" height="${H - 470}" fill="${g}"/>` + b.map(([x, y, w], i) =>
      `<rect x="${x}" y="${y}" width="${w}" height="${470 - y}" fill="${i === 2 ? a : "#5c6288"}"/>` +
      windows(x + 14, y + 16, Math.floor((w - 20) / 26), Math.floor((470 - y - 30) / 34), 14, 18, 26, 34, i === 2 ? "#ffe8a3" : "#d9def5")).join("") +
      `<rect x="372" y="430" width="36" height="40" fill="#ffe8a3"/>`;
  },
  haveli: ([, , a, g]) => `
    <rect y="470" width="${W}" height="${H - 470}" fill="${g}"/>
    <rect x="160" y="250" width="480" height="225" fill="${a}"/>
    <rect x="140" y="236" width="520" height="18" fill="#00000022"/>
    <path d="M330 330 a70 70 0 0 1 140 0 v145 h-140z" fill="#2b1d12"/>
    ${[200, 260, 500, 560].map((x) => `<path d="M${x} 330 a22 22 0 0 1 44 0 v50 h-44z" fill="#2b1d12" opacity=".85"/>`).join("")}
    ${[170, 400, 620].map((x) => `<path d="M${x - 40} 250 a40 40 0 0 1 80 0z" fill="${a}"/><rect x="${x - 3}" y="190" width="6" height="22" fill="#00000055"/>`).join("")}
    <path d="M340 250 a60 60 0 0 1 120 0z" fill="#00000022"/>`,
  hills: ([, , a, g]) => `
    <polygon points="0,420 180,200 330,420" fill="#a7b8d6"/><polygon points="220,420 450,150 700,420" fill="#8fa3c7"/>
    <polygon points="450,150 410,205 450,190 490,215" fill="#fff" opacity=".85"/>
    <polygon points="500,420 680,230 800,330 800,420" fill="#b9c8e2"/>
    <rect y="400" width="${W}" height="${H - 400}" fill="${g}"/>
    <rect x="290" y="390" width="190" height="105" fill="${a}"/><polygon points="270,392 385,310 500,392" fill="#4a2c1a"/><rect x="440" y="330" width="22" height="40" fill="#4a2c1a"/>
    <rect x="360" y="425" width="46" height="70" fill="#2b1d12"/><rect x="305" y="415" width="40" height="34" fill="#ffe8a3"/><rect x="425" y="415" width="40" height="34" fill="#ffe8a3"/>
    ${pine(120, 500, 1.2)}${pine(205, 515, 0.9)}${pine(600, 505, 1.3)}${pine(690, 520, 0.9)}`,
  houseboat: ([, , a, g]) => `
    <rect y="360" width="${W}" height="${H - 360}" fill="${g}"/>
    <path d="M0 400 q50 -12 100 0 t100 0 t100 0 t100 0 t100 0 t100 0 t100 0 t100 0" stroke="#fff" stroke-width="3" fill="none" opacity=".6"/>
    <rect y="330" width="${W}" height="40" fill="#5e9c4d"/>
    ${palm(90, 350, 170)}${palm(710, 350, 190)}
    <path d="M170 440 h460 l-40 50 h-380z" fill="#7a4b2a"/>
    <rect x="215" y="385" width="370" height="58" fill="#f5e6c8"/>
    <path d="M195 388 q205 -75 410 0z" fill="${a}"/>
    ${windows(240, 400, 6, 1, 38, 26, 54, 0, "#9ed0e6")}`,
  bungalow: ([, , a, g]) => `
    <rect y="440" width="${W}" height="${H - 440}" fill="${g}"/>
    <rect x="230" y="320" width="340" height="140" fill="#fff4e0"/><polygon points="205,324 400,215 595,324" fill="${a}"/>
    <rect x="368" y="372" width="64" height="88" fill="#6b4226"/>
    ${windows(260, 350, 1, 1, 70, 56, 0, 0, "#bfe3f2")}${windows(470, 350, 1, 1, 70, 56, 0, 0, "#bfe3f2")}
    <rect x="80" y="470" width="640" height="10" fill="#ffffffaa"/>
    <circle cx="130" cy="360" r="62" fill="#4f9d58"/><rect x="124" y="400" width="12" height="70" fill="#6b4226"/>
    <circle cx="690" cy="380" r="48" fill="#5aad63"/><rect x="685" y="410" width="10" height="60" fill="#6b4226"/>`,
};

const svgFor = (d) => {
  const [top, bottom] = d.palette;
  const label = `SAMPLE ILLUSTRATION  -  ${d.location}`.replace(/&/g, "and");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="Illustration of ${d.title}">
  <defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${top}"/><stop offset="1" stop-color="${bottom}"/></linearGradient></defs>
  <rect width="${W}" height="${H}" fill="url(#sky)"/>
  <circle cx="${d.style === "tower" ? 690 : 110}" cy="110" r="46" fill="#fff6c9" opacity=".9"/>
  ${scenes[d.style](d.palette)}
  <rect y="${H - 56}" width="${W}" height="56" fill="#000" opacity=".5"/>
  <text x="24" y="${H - 20}" font-family="Arial, Helvetica, sans-serif" font-size="22" fill="#fff" letter-spacing="1">${label}</text>
</svg>
`;
};

const outDir = path.join(__dirname, "..", "public", "images", "demo");
fs.mkdirSync(outDir, { recursive: true });
for (const d of demoListings) fs.writeFileSync(path.join(outDir, `${d.slug}.svg`), svgFor(d));
console.log(`Wrote ${demoListings.length} illustrations to ${path.relative(process.cwd(), outDir)}`);
