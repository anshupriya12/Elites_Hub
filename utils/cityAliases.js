// Explicit city aliases for search. A search term is matched against these lists AFTER normalization (case,
// spaces, punctuation, accents). There is deliberately no fuzzy matching: a term either is one of the listed
// spellings of a city or it is searched as plain text, so unrelated places can never be pulled in.
const cities = [
  { name: "Delhi", aliases: ["Delhi", "New Delhi", "Dilli", "Deli", "Dehli"] },
  { name: "Mumbai", aliases: ["Mumbai", "Bombay", "Mumbay", "Mumabi"] },
  { name: "Kolkata", aliases: ["Kolkata", "Calcutta", "Kolkatta", "Kolkota", "Culcutta"] },
  { name: "Bengaluru", aliases: ["Bengaluru", "Bangalore", "Bengalooru", "Bangaluru", "Banglore", "Banglaore", "Bangalor", "Bengalore"] },
  { name: "Chennai", aliases: ["Chennai", "Madras", "Chenai", "Chennnai", "Chenni"] },
  { name: "Hyderabad", aliases: ["Hyderabad", "Hydrabad", "Hyderbad", "Hyderabd", "Haidarabad"] },
  { name: "Ahmedabad", aliases: ["Ahmedabad", "Ahmadabad", "Amdavad", "Ahemdabad", "Ahmedbad", "Ahmdabad"] },
  { name: "Surat", aliases: ["Surat", "Suart"] },
  { name: "Pune", aliases: ["Pune", "Poona", "Puna"] },
  { name: "Jaipur", aliases: ["Jaipur", "Jaypur", "Jaipure", "Jeypore", "Pink City"] },
];

// lower-case, strip accents and punctuation, collapse whitespace
const normalize = (text) =>
  String(text || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const index = new Map();
for (const city of cities) for (const alias of city.aliases) index.set(normalize(alias), city);

// Returns { name, aliases } when the term (or one comma-separated part of it, e.g. "Bangalore, India") is a known
// spelling of a supported city; otherwise null.
const resolveCity = (term) => {
  const whole = index.get(normalize(term));
  if (whole) return whole;
  if (String(term).includes(",")) {
    for (const part of String(term).split(",")) {
      const hit = index.get(normalize(part));
      if (hit) return hit;
    }
  }
  return null;
};

// The canonical city a stored location belongs to (used to vary the homepage), or null when it is not a known city.
const cityOfLocation = (location) => {
  const n = ` ${normalize(location)} `;
  for (const city of cities) {
    if (city.aliases.some((a) => n.includes(` ${normalize(a)} `))) return city.name;
  }
  return null;
};

module.exports = { cities, normalize, resolveCity, cityOfLocation };
