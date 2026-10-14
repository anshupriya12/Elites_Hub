// Generates the original SVG illustrations used by the demo listings (public/images/demo/<slug>.svg).
// Run with: node init/generateDemoImages.js   (writes local files only; no database or network access)
// The 16 illustrations of the first demo version (see legacyDemo.js) are kept as committed files and are not regenerated.
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
const tree = (x, base, r) => `<rect x="${x - 5}" y="${base - r}" width="10" height="${r + 10}" fill="#6b4226"/><circle cx="${x}" cy="${base - r - 10}" r="${r}" fill="#4f9d58"/>`;

const scenes = {
  villa: ([, , a, g]) => `
    <rect y="430" width="${W}" height="${H - 430}" fill="${g}"/>
    <rect x="200" y="300" width="380" height="135" fill="#fffaf0"/>
    <rect x="180" y="282" width="420" height="20" fill="${a}"/>
    <rect x="260" y="330" width="90" height="105" fill="#bfe3f2" opacity=".9"/><rect x="430" y="330" width="110" height="60" fill="#bfe3f2" opacity=".9"/>
    <rect x="370" y="360" width="46" height="75" fill="${a}"/>
    <rect x="110" y="455" width="280" height="40" rx="8" fill="#5bc0de"/>
    ${palm(660, 470, 190)}${palm(110, 440, 140)}`,
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
  bungalow: ([, , a, g]) => `
    <rect y="440" width="${W}" height="${H - 440}" fill="${g}"/>
    <rect x="230" y="320" width="340" height="140" fill="#fff4e0"/><polygon points="205,324 400,215 595,324" fill="${a}"/>
    <rect x="368" y="372" width="64" height="88" fill="#6b4226"/>
    ${windows(260, 350, 1, 1, 70, 56, 0, 0, "#bfe3f2")}${windows(470, 350, 1, 1, 70, 56, 0, 0, "#bfe3f2")}
    <rect x="80" y="470" width="640" height="10" fill="#ffffffaa"/>
    ${tree(130, 470, 56)}${tree(690, 470, 44)}`,
  apartment: ([, , a, g]) => `
    <rect y="470" width="${W}" height="${H - 470}" fill="${g}"/>
    <rect x="80" y="320" width="150" height="150" fill="#d9d2c3"/>${windows(100, 340, 3, 3, 26, 28, 42, 42, "#bfe3f2")}
    <rect x="260" y="150" width="300" height="320" fill="#f4efe6"/>
    ${[0, 1, 2, 3, 4].map((r) => [0, 1, 2].map((c) => `<rect x="${285 + c * 90}" y="${175 + r * 58}" width="56" height="34" fill="#bfe3f2"/><rect x="${280 + c * 90}" y="${209 + r * 58}" width="66" height="8" fill="${a}"/>`).join("")).join("")}
    <rect x="385" y="425" width="50" height="45" fill="${a}"/>
    <rect x="590" y="380" width="130" height="90" fill="#d9d2c3"/>${windows(608, 395, 3, 2, 26, 24, 38, 36, "#bfe3f2")}
    ${tree(570, 470, 30)}`,
  townhouse: ([, , a, g]) => {
    const homes = [[170, 230, "#f6d6c8"], [330, 180, "#fff4e0"], [490, 250, "#d7e8d3"]];
    return `<rect y="470" width="${W}" height="${H - 470}" fill="${g}"/>` + homes.map(([x, top, fill], i) =>
      `<rect x="${x}" y="${top}" width="150" height="${470 - top}" fill="${fill}"/><polygon points="${x - 8},${top + 2} ${x + 75},${top - 55} ${x + 158},${top + 2}" fill="${i === 1 ? a : "#7a4b2a"}"/>` +
      windows(x + 22, top + 30, 2, Math.floor((470 - top - 110) / 60), 40, 36, 66, 60, "#bfe3f2") +
      `<rect x="${x + 55}" y="${430}" width="40" height="40" fill="${a}"/>`).join("") + `${tree(110, 470, 36)}${tree(690, 470, 40)}`;
  },
  colonial: ([, , a, g]) => `
    <rect y="470" width="${W}" height="${H - 470}" fill="${g}"/>
    <rect x="130" y="290" width="540" height="185" fill="#f3ead2"/>
    <polygon points="110,292 400,200 690,292" fill="${a}"/><polygon points="330,290 400,235 470,290" fill="#f3ead2"/>
    ${[170, 240, 310, 480, 550, 620].map((x) => `<rect x="${x}" y="300" width="18" height="170" fill="#fffaf0"/>`).join("")}
    ${windows(205, 330, 1, 1, 50, 70, 0, 0, "#7a9ab0")}${windows(325, 330, 1, 1, 50, 70, 0, 0, "#7a9ab0")}${windows(425, 330, 1, 1, 50, 70, 0, 0, "#7a9ab0")}${windows(545, 330, 1, 1, 50, 70, 0, 0, "#7a9ab0")}
    <rect x="370" y="390" width="60" height="85" fill="#4a2c1a"/><rect x="340" y="470" width="120" height="10" fill="#d8d0bd"/>
    ${tree(80, 470, 40)}${tree(730, 470, 44)}`,
  penthouse: ([, , a, g]) => `
    <rect y="470" width="${W}" height="${H - 470}" fill="${g}"/>
    <rect x="60" y="330" width="130" height="140" fill="#6b7396"/><rect x="620" y="300" width="130" height="170" fill="#6b7396"/>
    <rect x="290" y="150" width="220" height="320" fill="#e9edf7"/>${windows(310, 190, 4, 6, 26, 30, 48, 44, "#9ec5e3")}
    <rect x="262" y="128" width="276" height="22" fill="${a}"/>
    <rect x="320" y="108" width="100" height="22" rx="3" fill="#5bc0de"/>
    <line x1="270" y1="128" x2="270" y2="98" stroke="#ffffff" stroke-width="4"/><line x1="530" y1="128" x2="530" y2="98" stroke="#ffffff" stroke-width="4"/><line x1="270" y1="98" x2="530" y2="98" stroke="#ffffff" stroke-width="4"/>
    <path d="M450 108 a28 20 0 0 1 56 0z" fill="#e76f51"/><rect x="477" y="108" width="3" height="20" fill="#555"/>
    <rect x="375" y="430" width="50" height="40" fill="${a}"/>`,
  farmhouse: ([, , a, g]) => `
    <rect y="360" width="${W}" height="${H - 360}" fill="${g}"/>
    <rect y="500" width="${W}" height="100" fill="#8cc067"/><rect y="440" width="${W}" height="30" fill="#a6cf7c" opacity=".7"/>
    <rect x="240" y="350" width="260" height="110" fill="#fff1dc"/><polygon points="220,352 370,262 520,352" fill="${a}"/>
    <rect x="350" y="395" width="44" height="65" fill="#6b4226"/>${windows(265, 380, 1, 1, 48, 40, 0, 0, "#bfe3f2")}${windows(425, 380, 1, 1, 48, 40, 0, 0, "#bfe3f2")}
    <rect x="560" y="330" width="46" height="130" fill="#e0d6c3"/><path d="M556 330 a27 20 0 0 1 54 0z" fill="#a39d8f"/>
    ${[100, 140, 180, 640, 680, 720].map((x) => `<rect x="${x}" y="445" width="6" height="40" fill="#8b6b43"/>`).join("")}<rect x="95" y="455" width="95" height="5" fill="#8b6b43"/><rect x="635" y="455" width="95" height="5" fill="#8b6b43"/>
    ${tree(140, 430, 44)}${tree(700, 420, 36)}`,
};

const svgFor = (d) => {
  const [top, bottom] = d.palette;
  const label = `SAMPLE ILLUSTRATION  -  ${d.location}`.replace(/&/g, "and");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="Illustration of ${d.title}">
  <defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${top}"/><stop offset="1" stop-color="${bottom}"/></linearGradient></defs>
  <rect width="${W}" height="${H}" fill="url(#sky)"/>
  <circle cx="${d.style === "tower" || d.style === "penthouse" ? 690 : 110}" cy="110" r="46" fill="#fff6c9" opacity=".9"/>
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
