// Sample listings from the FIRST version of the demo data (16 properties, several outside the ten-city scope).
// The seed script only REPORTS these if it finds them in the database; it never edits or deletes them.
// Their illustrations remain in public/images/demo so any copies already in a database keep working.
const legacySlugs = [
  ["candolim-beach-villa", "Candolim, Goa"], ["bandra-sea-view-apartment", "Bandra West, Mumbai"], ["central-delhi-studio-suite", "Connaught Place, New Delhi"],
  ["indiranagar-garden-bungalow", "Indiranagar, Bengaluru"], ["pink-city-haveli-stay", "Amer Road, Jaipur"], ["udaipur-lakeview-haveli", "Lake Pichola, Udaipur"],
  ["backwater-houseboat-retreat", "Alappuzha, Kerala"], ["shimla-pine-cottage", "Mall Road, Shimla"], ["rishikesh-riverside-cabin", "Tapovan, Rishikesh"],
  ["chennai-courtyard-home", "Anna Nagar, Chennai"], ["banjara-hills-modern-villa", "Banjara Hills, Hyderabad"], ["koregaon-park-bungalow", "Koregaon Park, Pune"],
  ["kolkata-heritage-residence", "Park Street, Kolkata"], ["varanasi-ghat-side-stay", "Assi Ghat, Varanasi"], ["darjeeling-tea-estate-cottage", "Darjeeling, West Bengal"],
  ["jaisalmer-fort-view-haveli", "Jaisalmer, Rajasthan"],
];

const legacyDemoListings = legacySlugs.map(([slug, location]) => ({ slug, demoKey: `demo-${slug}`, location }));
const legacyDemoKeys = legacyDemoListings.map((d) => d.demoKey);

module.exports = { legacyDemoListings, legacyDemoKeys };
