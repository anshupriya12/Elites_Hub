// Sample properties for demonstration: 10 cities x 5 properties = 50. They are fictional. They are NOT real
// properties, NOT verified, NOT available for booking and NOT real offers. Every record is marked isDemo and carries a
// stable demoKey so seeding can be repeated safely. Coordinates are approximate locality centres ([longitude, latitude]).
// Images are original generated illustrations (see generateDemoImages.js), never scraped photos.
const NOTICE = "SAMPLE LISTING for demonstration only - not a real property, not available for booking, and not an actual offer.";

// sky top, sky bottom, ground colour for each city's illustrations
const cities = [
  { slug: "delhi", name: "Delhi", theme: ["#ffe0b5", "#f4a6a0", "#c9b79c"] },
  { slug: "mumbai", name: "Mumbai", theme: ["#9fb7e8", "#f7d6e0", "#7f8fa6"] },
  { slug: "kolkata", name: "Kolkata", theme: ["#f3d9b1", "#d6c4e8", "#bfa58a"] },
  { slug: "bengaluru", name: "Bengaluru", theme: ["#c9e8ff", "#e9f7d4", "#9bd37a"] },
  { slug: "chennai", name: "Chennai", theme: ["#ffd8a8", "#ffb3a7", "#d4a373"] },
  { slug: "hyderabad", name: "Hyderabad", theme: ["#b5d6ff", "#e6e6fa", "#c8d5b9"] },
  { slug: "ahmedabad", name: "Ahmedabad", theme: ["#ffe6a7", "#ffc9a0", "#d8c3a5"] },
  { slug: "surat", name: "Surat", theme: ["#bfe9ff", "#fff1c9", "#a8d5ba"] },
  { slug: "pune", name: "Pune", theme: ["#d0f4de", "#fcf6bd", "#a7c957"] },
  { slug: "jaipur", name: "Jaipur", theme: ["#ffcfa8", "#ff9b8a", "#e7b98a"] },
];

const ACCENTS = ["#e76f51", "#2a9d8f", "#7b2cbf", "#c1440e", "#1d3557"];

// [illustration style, title, description, locality, price per night (INR), longitude, latitude]
const rows = {
  delhi: [
    ["apartment", "Sunlit 2BHK Apartment near Connaught Place", "A bright two-bedroom apartment a short walk from the central market, with a modular kitchen and easy metro access.", "Connaught Place", 9500, 77.2167, 28.6315],
    ["townhouse", "Hauz Khas Village Designer Townhouse", "A three-level townhouse with a rooftop terrace in a lively, cafe-filled neighbourhood.", "Hauz Khas", 14000, 77.196, 28.5494],
    ["colonial", "Vasant Vihar Colonial-style Bungalow", "A tall-ceilinged bungalow with a shaded lawn on a quiet, tree-lined street.", "Vasant Vihar", 22000, 77.1583, 28.5593],
    ["tower", "Saket Studio Suite by the Mall", "A compact, well-lit studio suite suited to short work trips, with a desk and fast wifi.", "Saket", 5200, 77.209, 28.5245],
    ["apartment", "Dwarka Family Flat with Balcony Garden", "A spacious three-bedroom family flat with a green balcony, close to the airport corridor.", "Dwarka", 6800, 77.046, 28.5921],
  ],
  mumbai: [
    ["tower", "Bandra West Sea-View Apartment", "A high-floor apartment with sea glimpses, close to cafes, bookshops and the promenade.", "Bandra West", 16000, 72.8362, 19.0596],
    ["penthouse", "Juhu Beach-side Penthouse Terrace", "A top-floor penthouse with a private terrace, a short walk from the beach.", "Juhu", 24000, 72.8265, 19.1075],
    ["apartment", "Powai Lakeside 1BHK Retreat", "A calm one-bedroom retreat overlooking the lake, with a gym and garden in the complex.", "Powai", 7500, 72.9051, 19.1176],
    ["colonial", "Colaba Heritage Flat near the Gateway", "A high-ceilinged flat in a heritage-style building, walkable to the waterfront and museums.", "Colaba", 12500, 72.8147, 18.9067],
    ["tower", "Andheri East Business Stay Suite", "A practical suite near the business district and the metro, ideal for work visits.", "Andheri East", 6200, 72.8697, 19.1136],
  ],
  kolkata: [
    ["colonial", "Park Street Colonial Residence", "A colonial-era style residence with tall windows and a shaded veranda near the old restaurants.", "Park Street", 8800, 88.3519, 22.5527],
    ["apartment", "Salt Lake Garden-view Apartment", "A quiet apartment facing a leafy park, with a reading nook and a covered parking space.", "Salt Lake", 5400, 88.415, 22.5867],
    ["bungalow", "Ballygunge Courtyard House", "A traditional courtyard house with a green interior and a relaxed neighbourhood feel.", "Ballygunge", 9200, 88.365, 22.527],
    ["tower", "New Town Skyline Studio", "A modern studio on a high floor with city views, close to the tech parks.", "New Town", 4800, 88.465, 22.58],
    ["townhouse", "Alipore Heritage Townhouse", "A restored townhouse with period details on a quiet, tree-lined road.", "Alipore", 11000, 88.331, 22.5326],
  ],
  bengaluru: [
    ["bungalow", "Indiranagar Garden Bungalow", "A quiet bungalow with a leafy garden in one of the city's liveliest neighbourhoods.", "Indiranagar", 9000, 77.6408, 12.9784],
    ["apartment", "Koramangala Startup-district Loft Apartment", "A bright loft-style apartment with a work corner, surrounded by cafes and co-working spaces.", "Koramangala", 6500, 77.627, 12.9352],
    ["villa", "Whitefield Contemporary Villa with Pool", "A modern villa with a private pool and a landscaped garden, suited to groups and families.", "Whitefield", 15000, 77.75, 12.9698],
    ["tower", "HSR Layout Smart Studio", "A compact smart-home studio with keyless entry and a fully equipped kitchenette.", "HSR Layout", 4200, 77.641, 12.9116],
    ["townhouse", "Jayanagar Heritage-style Townhouse", "A three-bedroom townhouse with a terrace garden in a well-established residential area.", "Jayanagar", 7800, 77.583, 12.925],
  ],
  chennai: [
    ["bungalow", "Anna Nagar Courtyard Home", "A traditional courtyard-style home on a calm residential street.", "Anna Nagar", 6200, 80.209, 13.085],
    ["apartment", "T. Nagar Shopping-district Apartment", "A comfortable two-bedroom apartment steps from the main shopping streets.", "T. Nagar", 5600, 80.2341, 13.0418],
    ["colonial", "Adyar Riverside Colonial Home", "A spacious colonial-style home with a veranda near the river and quiet lanes.", "Adyar", 10500, 80.2565, 13.0063],
    ["villa", "ECR Beachfront Villa near Neelankarai", "A breezy villa a short walk from the coast road, with a sit-out and an outdoor shower.", "Neelankarai", 18000, 80.257, 12.949],
    ["townhouse", "Mylapore Temple-view Townhouse", "A narrow, tall townhouse with a rooftop view of the temple towers.", "Mylapore", 7200, 80.2707, 13.0368],
  ],
  hyderabad: [
    ["villa", "Banjara Hills Modern Villa", "A contemporary villa with large windows, a terrace and covered parking.", "Banjara Hills", 14500, 78.4483, 17.4126],
    ["bungalow", "Jubilee Hills Garden Bungalow", "A spacious bungalow with a lawn and mature trees in a quiet lane.", "Jubilee Hills", 16000, 78.407, 17.4326],
    ["tower", "HITEC City Executive Apartment", "A serviced-style apartment near the tech campuses, with a gym and a pool in the building.", "HITEC City", 7000, 78.3772, 17.4435],
    ["apartment", "Gachibowli Tech-corridor Flat", "A practical two-bedroom flat with a balcony, close to offices and the metro.", "Gachibowli", 5800, 78.3489, 17.4401],
    ["townhouse", "Secunderabad Cantonment Townhouse", "A tidy townhouse with a small courtyard in a green, orderly neighbourhood.", "Secunderabad", 6400, 78.4983, 17.4399],
  ],
  ahmedabad: [
    ["apartment", "Navrangpura Central Apartment", "A well-connected apartment near the university area, cafes and the riverfront.", "Navrangpura", 4800, 72.561, 23.039],
    ["villa", "Bodakdev Villa with Private Garden", "A comfortable villa with a private garden, suited to families and small groups.", "Bodakdev", 12000, 72.51, 23.04],
    ["haveli", "Old City Pol House Heritage Stay", "A heritage-style house in a traditional walled lane, with carved wooden details.", "Old City", 6000, 72.587, 23.0258],
    ["penthouse", "Satellite Rooftop-pool Apartment", "A top-floor apartment with a shared rooftop pool and evening city views.", "Satellite", 7500, 72.529, 23.03],
    ["farmhouse", "Sarkhej Farmhouse Retreat", "A quiet farmhouse with open fields and a veranda, a short drive from the city.", "Sarkhej", 9800, 72.501, 22.983],
  ],
  surat: [
    ["apartment", "Adajan Riverfront Apartment", "A bright apartment near the river promenade, with a balcony and covered parking.", "Adajan", 4500, 72.793, 21.195],
    ["villa", "Vesu Luxury Villa", "A spacious, modern villa with a lawn and a seating pavilion.", "Vesu", 11500, 72.771, 21.145],
    ["tower", "City Light Business Suite", "A tidy business suite in a central location, close to markets and the station.", "City Light", 4000, 72.79, 21.17],
    ["bungalow", "Piplod Family Bungalow", "A family bungalow with a garden and several bedrooms in a calm residential area.", "Piplod", 6800, 72.78, 21.15],
    ["farmhouse", "Dumas Beach Farmhouse", "A breezy farmhouse with a garden and sit-outs, a short drive from the shore.", "Dumas", 8500, 72.704, 21.085],
  ],
  pune: [
    ["bungalow", "Koregaon Park Garden Bungalow", "A relaxed bungalow near tree-lined streets, cafes and parks.", "Koregaon Park", 8200, 73.893, 18.5362],
    ["apartment", "Kalyani Nagar Riverside Apartment", "A modern apartment close to the river, restaurants and the airport road.", "Kalyani Nagar", 5800, 73.903, 18.546],
    ["villa", "Aundh Hillside Villa", "A bright villa near a hillside park, with a terrace and a small lawn.", "Aundh", 12500, 73.807, 18.558],
    ["tower", "Baner Tech-park Studio", "A compact studio near the tech parks, with a work desk and a kitchenette.", "Baner", 4300, 73.786, 18.559],
    ["farmhouse", "Mulshi Lake-view Farmhouse", "A quiet farmhouse above the lake with open views and a large veranda.", "Mulshi", 10500, 73.516, 18.518],
  ],
  jaipur: [
    ["haveli", "Amer Road Heritage Haveli Stay", "A heritage-style haveli with a courtyard, inspired by the old city's architecture.", "Amer Road", 9500, 75.8513, 26.9855],
    ["colonial", "C-Scheme Colonial Bungalow", "A bungalow with columns and a shaded porch in a central, leafy locality.", "C-Scheme", 8800, 75.8, 26.906],
    ["apartment", "Malviya Nagar Modern Apartment", "A neat two-bedroom apartment close to the main market and cafes.", "Malviya Nagar", 4600, 75.812, 26.856],
    ["villa", "Vaishali Nagar Villa with Courtyard", "A comfortable villa with an inner courtyard and a rooftop sit-out.", "Vaishali Nagar", 11000, 75.74, 26.91],
    ["townhouse", "Civil Lines Garden Townhouse", "A townhouse with a small garden in a calm, central part of the city.", "Civil Lines", 7000, 75.79, 26.93],
  ],
};

const pad = (n) => String(n).padStart(2, "0");

// One entry per property, ordered so each round covers every city (the newest records then span many cities).
const demoListings = [];
for (let n = 0; n < 5; n++) {
  for (const city of cities) {
    const [style, title, blurb, locality, price, lng, lat] = rows[city.slug][n];
    demoListings.push({
      slug: `${city.slug}-${pad(n + 1)}`,
      citySlug: city.slug,
      city: city.name,
      style,
      palette: [city.theme[0], city.theme[1], ACCENTS[n % ACCENTS.length], city.theme[2]],
      title: `${title} (Sample)`,
      blurb,
      location: `${locality}, ${city.name}`,
      price,
      coordinates: [lng, lat],
    });
  }
}

// Listing documents exactly as stored. No `owner` is set on purpose: demo listings belong to nobody, so no user
// can edit or delete them. `demoKey` is the stable upsert key.
const buildDemoDocs = () =>
  demoListings.map((d) => ({
    demoKey: `demo-${d.slug}`,
    isDemo: true,
    title: d.title,
    description: `${NOTICE} ${d.blurb}`,
    price: d.price,
    location: d.location,
    country: "India",
    image: { url: `/images/demo/${d.slug}.svg`, filename: `demo/${d.slug}` },
    geometry: { type: "Point", coordinates: d.coordinates },
  }));

module.exports = { cities, demoListings, buildDemoDocs, NOTICE };
