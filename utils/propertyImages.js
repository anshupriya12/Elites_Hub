// Chooses the picture (and alt text) to show for a listing.
//
// Sample listings seeded earlier store an illustration URL (/images/demo/<slug>.svg). They are shown with the matching
// photograph from init/demoPhotos.js instead, so existing database records need no migration. Listings uploaded by users
// are shown exactly as stored. Anything without a picture gets a neutral placeholder.
const { photos, urlFor } = require("../init/demoPhotos.js");

const PLACEHOLDER = "/images/placeholder-property.svg";
const DEMO_IMAGE = /^\/images\/(?:demo\/([a-z0-9-]+)\.svg|properties\/([a-z0-9-]+)\.jpg)$/;

const resolvePropertyImage = (listing) => {
  const stored = listing && listing.image && listing.image.url;
  const title = (listing && listing.title) || "Property";
  if (listing && listing.isDemo && stored) {
    const m = stored.match(DEMO_IMAGE);
    const slug = m && (m[1] || m[2]);
    if (slug && photos[slug]) {
      return {
        src: urlFor(slug),
        alt: `${photos[slug].alt}. Illustrative photo for the sample listing "${title}"; it does not show the actual property.`,
        credit: photos[slug].photographer,
        illustrative: true,
      };
    }
  }
  return { src: stored || PLACEHOLDER, alt: `Photo of ${title}`, credit: null, illustrative: Boolean(listing && listing.isDemo) };
};

module.exports = { resolvePropertyImage, PLACEHOLDER };
