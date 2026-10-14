// Sample properties for demonstration. They are NOT real properties and NOT real offers; every record is marked
// isDemo and carries a stable demoKey so seeding can be repeated safely. Coordinates are approximate city/locality
// centres ([longitude, latitude]). Images are original generated illustrations (see generateDemoImages.js).
const NOTICE = "SAMPLE LISTING for demonstration only - not a real property, not available for booking, and not an actual offer.";

// style: which illustration to draw; palette: [sky top, sky bottom, accent, ground]
const demoListings = [
  { slug: "candolim-beach-villa", style: "villa", palette: ["#ffd9a0", "#8fd3e8", "#e76f51", "#f2d7a1"], title: "Candolim Beach Villa (Sample)", blurb: "A bright beachfront villa with a pool deck, a short walk from the sand.", location: "Candolim, Goa", price: 8500, coordinates: [73.7627, 15.518] },
  { slug: "bandra-sea-view-apartment", style: "tower", palette: ["#9fb7e8", "#e8d5f2", "#1d3557", "#3a3f58"], title: "Bandra Sea-View Apartment (Sample)", blurb: "A high-floor apartment overlooking the Arabian Sea, close to cafes and the promenade.", location: "Bandra West, Mumbai", price: 12000, coordinates: [72.8362, 19.0596] },
  { slug: "central-delhi-studio-suite", style: "tower", palette: ["#ffe0b5", "#f4a6a0", "#6d597a", "#4a4458"], title: "Central Delhi Studio Suite (Sample)", blurb: "A compact studio suite near Connaught Place with easy metro access.", location: "Connaught Place, New Delhi", price: 9000, coordinates: [77.2167, 28.6315] },
  { slug: "indiranagar-garden-bungalow", style: "bungalow", palette: ["#c9e8ff", "#e9f7d4", "#2a9d8f", "#9bd37a"], title: "Indiranagar Garden Bungalow (Sample)", blurb: "A quiet bungalow with a leafy garden in one of the city's liveliest neighbourhoods.", location: "Indiranagar, Bengaluru", price: 6500, coordinates: [77.6408, 12.9784] },
  { slug: "pink-city-haveli-stay", style: "haveli", palette: ["#ffcfa8", "#ff9b8a", "#c1440e", "#e7b98a"], title: "Pink City Haveli Stay (Sample)", blurb: "A heritage-style haveli courtyard stay inspired by Jaipur's old city.", location: "Amer Road, Jaipur", price: 7500, coordinates: [75.8513, 26.9855] },
  { slug: "udaipur-lakeview-haveli", style: "haveli", palette: ["#ffe6a7", "#b8d8f0", "#8d6e63", "#d8c3a5"], title: "Udaipur Lakeview Haveli (Sample)", blurb: "A palace-style haveli with rooftop views across the lake.", location: "Lake Pichola, Udaipur", price: 11000, coordinates: [73.68, 24.5764] },
  { slug: "backwater-houseboat-retreat", style: "houseboat", palette: ["#ffeaa7", "#a8e6cf", "#2d6a4f", "#3a86a8"], title: "Backwater Houseboat Retreat (Sample)", blurb: "A traditional-style houseboat drifting through calm Kerala backwaters.", location: "Alappuzha, Kerala", price: 9500, coordinates: [76.3388, 9.4981] },
  { slug: "shimla-pine-cottage", style: "hills", palette: ["#cfe3ff", "#f1f6ff", "#8b5e3c", "#5b8c5a"], title: "Shimla Pine Cottage (Sample)", blurb: "A cosy wooden cottage among pine trees with mountain views.", location: "Mall Road, Shimla", price: 5500, coordinates: [77.1734, 31.1048] },
  { slug: "rishikesh-riverside-cabin", style: "hills", palette: ["#ffe3c2", "#bde0fe", "#1b4332", "#74a57f"], title: "Rishikesh Riverside Cabin (Sample)", blurb: "A simple riverside cabin close to yoga studios and walking trails.", location: "Tapovan, Rishikesh", price: 4500, coordinates: [78.2676, 30.0869] },
  { slug: "chennai-courtyard-home", style: "bungalow", palette: ["#ffd8a8", "#ffb3a7", "#7b2cbf", "#d4a373"], title: "Chennai Courtyard Home (Sample)", blurb: "A traditional courtyard-style home in a calm residential street.", location: "Anna Nagar, Chennai", price: 5000, coordinates: [80.209, 13.085] },
  { slug: "banjara-hills-modern-villa", style: "villa", palette: ["#b5d6ff", "#e6e6fa", "#264653", "#c8d5b9"], title: "Banjara Hills Modern Villa (Sample)", blurb: "A contemporary villa with large windows, a terrace and parking.", location: "Banjara Hills, Hyderabad", price: 7000, coordinates: [78.4483, 17.4126] },
  { slug: "koregaon-park-bungalow", style: "bungalow", palette: ["#d0f4de", "#fcf6bd", "#e07a5f", "#a7c957"], title: "Koregaon Park Bungalow (Sample)", blurb: "A relaxed bungalow near tree-lined streets, cafes and parks.", location: "Koregaon Park, Pune", price: 6000, coordinates: [73.893, 18.5362] },
  { slug: "kolkata-heritage-residence", style: "haveli", palette: ["#f3d9b1", "#d6c4e8", "#7f4f24", "#bfa58a"], title: "Kolkata Heritage Residence (Sample)", blurb: "A colonial-era style residence with tall windows and a shaded veranda.", location: "Park Street, Kolkata", price: 5200, coordinates: [88.3519, 22.5527] },
  { slug: "varanasi-ghat-side-stay", style: "haveli", palette: ["#ffd29d", "#ffe8cc", "#9c6644", "#7aa0b8"], title: "Varanasi Ghat-side Heritage Stay (Sample)", blurb: "A heritage-style stay a short walk from the riverfront ghats.", location: "Assi Ghat, Varanasi", price: 4200, coordinates: [83.0064, 25.2877] },
  { slug: "darjeeling-tea-estate-cottage", style: "hills", palette: ["#dfe7fd", "#cdeac0", "#e5989b", "#6a994e"], title: "Darjeeling Tea-Estate Cottage (Sample)", blurb: "A tea-estate style cottage with sweeping hill views.", location: "Darjeeling, West Bengal", price: 5800, coordinates: [88.2627, 27.041] },
  { slug: "jaisalmer-fort-view-haveli", style: "haveli", palette: ["#ffe29a", "#ffb673", "#b5651d", "#e6c58f"], title: "Jaisalmer Fort-view Haveli (Sample)", blurb: "A sandstone-style haveli with a rooftop terrace facing the old fort.", location: "Jaisalmer, Rajasthan", price: 6800, coordinates: [70.9083, 26.9157] },
];

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

module.exports = { demoListings, buildDemoDocs, NOTICE };
