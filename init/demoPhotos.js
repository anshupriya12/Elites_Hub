// Photographs for the 50 sample properties. All are free-to-use photos from Unsplash (https://unsplash.com/license): the
// licence allows free commercial and non-commercial use with no permission or attribution required. Credits are kept
// here anyway. Photos were chosen from uploads made before 2023 (genuine photography, not AI/rendered images) and matched
// to each listing type. They are ILLUSTRATIVE ONLY and do not show the (fictional) sample properties.
//
// The files live in public/images/properties/<slug>.jpg (900x675, ~100 KB each) and are committed to the repository,
// so nothing is hotlinked at run time. To re-create them: node init/downloadDemoPhotos.js
const LICENSE = "Unsplash License";
const LICENSE_URL = "https://unsplash.com/license";

const photos = {
  "delhi-01": { unsplashId: "1554995207-c18c203602cb", photographer: "Kara Eads", alt: "Bright living room with a tan sofa, plants and large windows" },
  "delhi-02": { unsplashId: "1605297507265-a46432d9c44d", photographer: "Mark Tryapichnikov", alt: "Modern townhouse with a glass and gold-panel facade" },
  "delhi-03": { unsplashId: "1594348352429-159508d48c57", photographer: "I Do Nothing But Love", alt: "White colonial-style house with columns and a green lawn" },
  "delhi-04": { unsplashId: "1531835551805-16d864c8d311", photographer: "Sonnie Hiles", alt: "Compact studio bedroom with a black platform bed and white linen" },
  "delhi-05": { unsplashId: "1580041065738-e72023775cdc", photographer: "allPhoto Bangkok", alt: "Apartment block with balconies beside a landscaped pool and trees" },
  "mumbai-01": { unsplashId: "1523192193543-6e7296d960e4", photographer: "CHUTTERSNAP", alt: "High-rise residential towers rising above the city" },
  "mumbai-02": { unsplashId: "1626279484248-59d4cc4ab19f", photographer: "Tetiana Shevereva", alt: "Rooftop terrace with a table and chairs looking out to the sea" },
  "mumbai-03": { unsplashId: "1613575831056-0acd5da8f085", photographer: "Med Badr  Chemmaoui", alt: "Sunlit living room with a work desk by a large window" },
  "mumbai-04": { unsplashId: "1630474677146-68ec8e5e1b74", photographer: "Galen Crout", alt: "Heritage-style building with white arches and a shaded veranda" },
  "mumbai-05": { unsplashId: "1619989652700-9984844cb0ea", photographer: "Eduardo Freire", alt: "Neutral living room with sofas and sheer curtains" },
  "kolkata-01": { unsplashId: "1667489012950-b0c4524da308", photographer: "Diane Picchiottino", alt: "Old brick residence with iron balconies and tall windows" },
  "kolkata-02": { unsplashId: "1612637968894-660373e23b03", photographer: "Isaac Quesada", alt: "Brown and white apartment buildings around a green garden" },
  "kolkata-03": { unsplashId: "1556998641-f9523143131c", photographer: "Xavier von Erlach", alt: "Period house with shuttered windows set in a garden" },
  "kolkata-04": { unsplashId: "1612853117692-5dd289602ce0", photographer: "R M", alt: "Brown residential towers with rows of balconies" },
  "kolkata-05": { unsplashId: "1601651593921-b425ce157884", photographer: "Clay LeConey", alt: "Row of brownstone townhouses with tall windows" },
  "bengaluru-01": { unsplashId: "1642667670006-6b3059ccf96d", photographer: "Anoop Surendran", alt: "White bungalow with a tiled roof and a flowering garden" },
  "bengaluru-02": { unsplashId: "1606074280798-2dabb75ce10c", photographer: "Davide Colonna", alt: "Loft-style living room with a spiral staircase and tall windows" },
  "bengaluru-03": { unsplashId: "1613977257365-aaae5a9817ff", photographer: "John Fornander", alt: "Modern white villa with a swimming pool and palm trees" },
  "bengaluru-04": { unsplashId: "1638454795595-0a0abf68614d", photographer: "Lotus Design N Print", alt: "Modern living space with colourful wall art and a sofa" },
  "bengaluru-05": { unsplashId: "1430285561322-7808604715df", photographer: "Terrah Holly", alt: "Brick townhouses with dark gabled roofs" },
  "chennai-01": { unsplashId: "1561026554-29d9815d4f3d", photographer: "James Day", alt: "Two-storey beige house with arched windows and palm trees" },
  "chennai-02": { unsplashId: "1560185009-5bf9f2849488", photographer: "Francesca Tosolini", alt: "Living room with wooden floors, armchairs and plants" },
  "chennai-03": { unsplashId: "1667489010858-4854d84a220d", photographer: "Diane Picchiottino", alt: "Colonial-style house with wooden shutters and a veranda staircase" },
  "chennai-04": { unsplashId: "1543489822-c49534f3271f", photographer: "big.tiny.belly", alt: "Infinity pool overlooking the sea at a coastal villa" },
  "chennai-05": { unsplashId: "1576375801517-45814f908aa4", photographer: "the Bialons", alt: "Narrow brown townhouses with balconies on a city street" },
  "hyderabad-01": { unsplashId: "1613977257592-4871e5fcd7c4", photographer: "John Fornander", alt: "Contemporary white villa with a swimming pool" },
  "hyderabad-02": { unsplashId: "1632152683081-28923830268d", photographer: "Stefan K", alt: "Large white bungalow with a red roof on a green hill" },
  "hyderabad-03": { unsplashId: "1609731169878-93aecfda8779", photographer: "Galen Crout", alt: "Tall white residential tower against a cloudy sky" },
  "hyderabad-04": { unsplashId: "1565363887715-8884629e09ee", photographer: "Mika Baumeister", alt: "White apartment building with teal balconies" },
  "hyderabad-05": { unsplashId: "1625283518755-6047df2fb180", photographer: "Simi Iluyomade", alt: "Modern townhouses with garages and balconies" },
  "ahmedabad-01": { unsplashId: "1619994121345-b61cd610c5a6", photographer: "Hebert Marchesi", alt: "White apartment building with balconies" },
  "ahmedabad-02": { unsplashId: "1635108201018-94bbbfac4a79", photographer: "Point3D Commercial Imaging Ltd.", alt: "Backyard with a swimming pool beside a villa" },
  "ahmedabad-03": { unsplashId: "1600192130168-6ecaca06a03d", photographer: "Damini", alt: "Traditional house facade with carved red wooden windows" },
  "ahmedabad-04": { unsplashId: "1493246318656-5bfd4cfb29b8", photographer: "garrett parker", alt: "Rooftop terrace with seating and a city skyline at sunset" },
  "ahmedabad-05": { unsplashId: "1543372165-23cb16764356", photographer: "Camylla Battani", alt: "Rustic farmhouse veranda with wooden beams" },
  "surat-01": { unsplashId: "1638973140785-3b918e290682", photographer: "Jason Grant", alt: "Red brick apartment building beside a riverside walkway" },
  "surat-02": { unsplashId: "1600596542815-ffad4c1539a9", photographer: "Frames For Your Heart", alt: "Modern white villa with a pool and terrace" },
  "surat-03": { unsplashId: "1522708323590-d24dbb6b0267", photographer: "deborah cortelazzi", alt: "Compact furnished room with a dining table and armchairs" },
  "surat-04": { unsplashId: "1623171170667-3906bae07de9", photographer: "Lissete Laverde", alt: "Family home with a lawn and mature trees" },
  "surat-05": { unsplashId: "1600210491892-03d54c0aaf87", photographer: "Collov Home Design", alt: "Bright farmhouse living room with arched windows and wooden beams" },
  "pune-01": { unsplashId: "1571939228382-b2f2b585ce15", photographer: "Ksenia Balandina", alt: "White house surrounded by trees and a manicured garden" },
  "pune-02": { unsplashId: "1580041029617-861657e9f349", photographer: "allPhoto Bangkok", alt: "Apartment buildings with a tree in the foreground" },
  "pune-03": { unsplashId: "1565731761817-6bdc8e7d9f34", photographer: "Eve Ji", alt: "Hillside house with a pool overlooking green countryside" },
  "pune-04": { unsplashId: "1615874959474-d609969a20ed", photographer: "Spacejoy", alt: "Studio bedroom with a bed, plants and framed art" },
  "pune-05": { unsplashId: "1609824442071-fdda02ae5f7d", photographer: "Bram Wouters", alt: "Red-roofed farmhouse in green fields" },
  "jaipur-01": { unsplashId: "1622225641765-8c8ef0dcb678", photographer: "Maninder Sidhu", alt: "Red and pink heritage haveli facade with carved balconies" },
  "jaipur-02": { unsplashId: "1617141372324-a37d164e08ae", photographer: "Y S", alt: "White and pink colonial-style house with a tower" },
  "jaipur-03": { unsplashId: "1481479763098-d8fda86b4bf9", photographer: "Raul Petri", alt: "Modern apartment building with wood-toned balconies" },
  "jaipur-04": { unsplashId: "1532323544230-7191fd51bc1b", photographer: "Hutomo Abrianto", alt: "Sunlit porch with wicker chairs and blue doors" },
  "jaipur-05": { unsplashId: "1625283518295-22f95787174e", photographer: "Simi Iluyomade", alt: "Brown and white townhouses with a fence and garden" },
};

const urlFor = (slug) => `/images/properties/${slug}.jpg`;

module.exports = { photos, urlFor, LICENSE, LICENSE_URL };
