// Design-system checks computed from the real stylesheet: WCAG contrast of the colour tokens that carry text, and that
// every interactive control style defines hover/focus/disabled states. No browser needed.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const css = fs.readFileSync(path.join(__dirname, "..", "public", "css", "style.css"), "utf8");
const token = (name) => {
  const m = css.match(new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})`));
  assert.ok(m, `token --${name} exists`);
  return m[1];
};
const lum = (hex) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (a, b) => { const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x); return (hi + 0.05) / (lo + 0.05); };

test("text colours meet WCAG AA (4.5:1) on the surfaces they are used on", () => {
  const pairs = [
    ["eh-ink", "eh-surface", "headings on cards"],
    ["eh-text", "eh-bg", "body text on the page background"],
    ["eh-text", "eh-surface", "body text on cards"],
    ["eh-muted", "eh-surface", "muted text on cards"],
    ["eh-muted", "eh-bg", "muted text on the page background"],
    ["eh-primary", "eh-surface", "links and outline buttons on white"],
    ["eh-primary", "eh-bg", "links on the page background"],
    ["eh-primary", "eh-primary-soft", "active nav item"],
    ["eh-sample-text", "eh-sample-bg", "Sample listing badge and notice"],
    ["eh-danger", "eh-surface", "error text"],
  ];
  for (const [fg, bg, what] of pairs) {
    const r = ratio(token(fg), token(bg));
    assert.ok(r >= 4.5, `${what}: --${fg} on --${bg} is ${r.toFixed(2)}:1`);
  }
});

test("white text on the brand colour (primary buttons, hero) meets AA, and hover is darker, not lighter", () => {
  assert.ok(ratio("#ffffff", token("eh-primary")) >= 7, "white on primary");
  assert.ok(ratio("#ffffff", token("eh-primary-hover")) >= ratio("#ffffff", token("eh-primary")), "hover keeps or improves contrast");
  assert.ok(ratio(token("eh-primary"), "#ffffff") >= 7, "hero button text (primary on white)");
});

test("footer text and the keyboard focus ring are readable/visible", () => {
  assert.ok(ratio("#d3dbea", "#101c30") >= 7, "footer body text");
  assert.ok(ratio("#aab6cc", "#101c30") >= 4.5, "footer note text");
  assert.ok(ratio(token("eh-focus"), "#ffffff") >= 3, "focus ring on white (needs 3:1)");
  assert.ok(ratio(token("eh-focus"), token("eh-bg")) >= 3, "focus ring on the page background");
});

test("controls define hover, focus, disabled and error states", () => {
  assert.match(css, /\.btn-eh:hover/);
  assert.match(css, /\.btn-eh-outline:hover/);
  assert.match(css, /\.btn:disabled[\s\S]*cursor:\s*not-allowed/);
  assert.match(css, /:focus-visible\s*\{[^}]*outline:\s*3px solid var\(--eh-focus\)/);
  // Bootstrap's own .nav-link/.btn/.form-control focus styles are more specific than a bare :focus-visible rule.
  for (const sel of [".nav-link:focus-visible", ".btn:focus-visible", ".navbar-toggler:focus-visible", ".form-control:focus-visible", "a:focus-visible", "button:focus-visible"]) {
    assert.ok(css.includes(sel), `explicit focus style for ${sel}`);
  }
  assert.match(css, /\.form-check-input:focus-visible,[\s\S]*?\{[^}]*outline:\s*3px solid var\(--eh-focus\)[^}]*box-shadow:\s*none/);
  assert.match(css, /\.form-control:focus/);
  assert.match(css, /\.was-validated \.form-control:invalid/);
  assert.match(css, /\.invalid-feedback\s*\{[^}]*color:\s*var\(--eh-danger\)/);
  assert.match(css, /\.skip-link:focus/);
});

test("responsive rules: no fixed navbar height, container-friendly grid, mobile hero and form styles exist", () => {
  assert.ok(!/\.navbar\s*\{[^}]*height:\s*5rem/.test(css), "the old fixed navbar height is gone");
  assert.match(css, /--eh-nav-height/);
  assert.match(css, /@media \(max-width: 991\.98px\)/);
  assert.match(css, /@media \(max-width: 575\.98px\)[\s\S]*\.home-hero/);
  assert.match(css, /minmax\(min\(100%, 17\.5rem\), 1fr\)/);
});
