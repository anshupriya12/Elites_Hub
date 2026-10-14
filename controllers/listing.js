const Listing = require("../models/listing.js");
const ExpressError = require("../utils/ExpressError.js");
const { cities, resolveCity, cityOfLocation } = require("../utils/cityAliases.js");
const { deleteUploadedImage } = require("../cloudConfig.js");
const { resolvePropertyImage } = require("../utils/propertyImages.js");
const mbxGeocoding = require("@mapbox/mapbox-sdk/services/geocoding");
const mapToken = process.env.MAP_TOKEN;
const isValidId = (id) => /^[0-9a-fA-F]{24}$/.test(id);
// The Mapbox client throws at creation without a token; only build it when MAP_TOKEN is set.
const geocodingClient = mapToken ? mbxGeocoding({ accessToken: mapToken }) : null;

// Returns the GeoJSON point for a place, or throws an ExpressError a user can act on.
const geocodeLocation = async (location, country) => {
  if (!geocodingClient) {
    throw new ExpressError(503, "Location lookup is not configured (MAP_TOKEN is missing).");
  }
  let response;
  try {
    response = await geocodingClient
      .forwardGeocode({
        query: `${location}, ${country}`,
        limit: 1,
      })
      .send();
  } catch (err) {
    console.error("Mapbox geocoding failed:", err && err.statusCode, err && err.message);
    throw new ExpressError(502, "We could not look up that location right now. Please try again.");
  }
  const features = response && response.body && response.body.features;
  if (!Array.isArray(features) || !features.length || !features[0].geometry) {
    throw new ExpressError(
      400,
      "We could not find that location. Please enter a valid city and country."
    );
  }
  return features[0].geometry;
};

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const MAX_FILTER_PRICE = 10000000;

// Reads a price filter from the query string: a number, null (not provided) or NaN (provided but invalid).
const readPrice = (value) => {
  if (typeof value !== "string" || value.trim() === "") return null;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 && n <= MAX_FILTER_PRICE ? n : NaN;
};

// Search by location/title and filter by price range. Query values that are not plain strings (for example
// ?q[$ne]=x) are ignored, and the search text is escaped, so it can never be used as a Mongo operator or regex.
module.exports.index = async (req, res) => {
  const q = typeof req.query.q === "string" ? req.query.q.trim().slice(0, 100) : "";
  let minPrice = readPrice(req.query.minPrice);
  let maxPrice = readPrice(req.query.maxPrice);
  const notices = [];
  if (Number.isNaN(minPrice)) { notices.push("The minimum price was not a valid number and was ignored."); minPrice = null; }
  if (Number.isNaN(maxPrice)) { notices.push("The maximum price was not a valid number and was ignored."); maxPrice = null; }

  const query = {};
  // A known city spelling (for example "Bangalore", "Banglaore" or "Bombay") is expanded to all listed spellings of
  // that city and matched as whole words. Anything else is searched as plain text. No fuzzy matching.
  const city = q ? resolveCity(q) : null;
  if (q) {
    const rx = city
      ? new RegExp(`\\b(?:${city.aliases.map(escapeRegex).join("|")})\\b`, "i")
      : new RegExp(escapeRegex(q), "i");
    query.$or = [{ location: rx }, { country: rx }, { title: rx }];
  }
  const invalidRange = minPrice !== null && maxPrice !== null && minPrice > maxPrice;
  if (invalidRange) {
    notices.push("The minimum price is higher than the maximum price, so nothing can match.");
  } else if (minPrice !== null || maxPrice !== null) {
    query.price = {};
    if (minPrice !== null) query.price.$gte = minPrice;
    if (maxPrice !== null) query.price.$lte = maxPrice;
  }

  const allListings = invalidRange ? [] : await Listing.find(query).sort({ _id: -1 });

  // Active filters, each with a link that removes just that filter.
  const params = {};
  if (q) params.q = q;
  if (minPrice !== null) params.minPrice = String(minPrice);
  if (maxPrice !== null) params.maxPrice = String(maxPrice);
  const without = (key) => {
    const rest = new URLSearchParams(Object.entries(params).filter(([k]) => k !== key)).toString();
    return rest ? `/listings?${rest}` : "/listings";
  };
  const inr = (n) => `₹${n.toLocaleString("en-IN")}`;
  const activeFilters = [];
  if (q) activeFilters.push({ label: `Location: ${q}`, removeUrl: without("q") });
  if (minPrice !== null) activeFilters.push({ label: `Min price: ${inr(minPrice)}`, removeUrl: without("minPrice") });
  if (maxPrice !== null) activeFilters.push({ label: `Max price: ${inr(maxPrice)}`, removeUrl: without("maxPrice") });

  // Popular-city links keep any price filter that is already applied.
  const popularCities = cities.map((c) => {
    const link = new URLSearchParams({ q: c.name });
    if (minPrice !== null) link.set("minPrice", String(minPrice));
    if (maxPrice !== null) link.set("maxPrice", String(maxPrice));
    return { name: c.name, url: `/listings?${link}` };
  });

  res.locals.searchQuery = q; // pre-fills the navbar search box
  res.render("listings/index.ejs", {
    pageTitle: q ? `Properties in ${city ? city.name : q}` : "Properties",
    allListings,
    filters: { q, minPrice: minPrice === null ? "" : minPrice, maxPrice: maxPrice === null ? "" : maxPrice },
    activeFilters,
    notices,
    searchCity: city && city.name.toLowerCase() !== q.toLowerCase() ? city.name : null,
    popularCities,
    photo: resolvePropertyImage,
  });
};

// Homepage: six featured properties taken from the newest ones, spread across different cities where possible.
module.exports.home = async (req, res) => {
  const recent = await Listing.find({}).sort({ _id: -1 }).limit(36);
  const featured = [];
  const seenCities = new Set();
  for (const listing of recent) {
    const key = cityOfLocation(listing.location) || String(listing.location || listing._id).toLowerCase();
    if (!seenCities.has(key)) {
      seenCities.add(key);
      featured.push(listing);
    }
    if (featured.length === 6) break;
  }
  for (const listing of recent) {
    if (featured.length === 6) break;
    if (!featured.includes(listing)) featured.push(listing);
  }
  const popularCities = cities.map((c) => ({ name: c.name, url: `/listings?q=${encodeURIComponent(c.name)}` }));
  res.render("home.ejs", { featured, popularCities, photo: resolvePropertyImage });
};


module.exports.renderNewForm = (req, res) => {
  res.render("listings/new.ejs", { pageTitle: "List your property" });
};

module.exports.showListing = async (req, res) => {
  let { id } = req.params;
  if (!isValidId(id)) {
    req.flash("error", "Listing does not exist!");
    return res.redirect("/listings");
  }
  // Only username is populated for users, so hash/salt are never loaded into the view.
  const listing = await Listing.findById(id)
    .populate({
      path: "reviews",
      populate: {
        path: "author",
        select: "username",
      },
    })
    .populate("owner", "username");
  if (!listing) {
    req.flash("error", "Listing does not exist!");
    return res.redirect("/listings");
  }
  res.render("listings/show.ejs", { listing, pageTitle: listing.title, photo: resolvePropertyImage, withMap: true });
};

module.exports.createListing = async (req, res, next) => {
  const uploaded = req.file;
  try {
    if (!uploaded) {
      throw new ExpressError(400, "Please upload an image for the listing.");
    }
    const { location, country } = req.body.listing;
    const geometry = await geocodeLocation(location, country);

    const newListing = new Listing(req.body.listing);
    newListing.owner = req.user._id;
    newListing.image = { url: uploaded.path, filename: uploaded.filename };
    newListing.geometry = geometry;
    await newListing.save();
  } catch (err) {
    // Nothing was saved, so the image uploaded for this request would be an orphan.
    await deleteUploadedImage(uploaded);
    throw err;
  }

  req.flash("success", "New Listing Created");
  res.redirect("/listings");
};

module.exports.renderEditForm = async (req, res) => {
  let { id } = req.params;
  const listing = isValidId(id) ? await Listing.findById(id) : null;
  if (!listing) {
    req.flash("error", "Listing does not exist!");
    return res.redirect("/listings");
  }

  let originalImageUrl =
    listing.image && listing.image.url
      ? listing.image.url.replace("/upload", "/upload/w_250")
      : "";
  res.render("listings/edit.ejs", { listing, originalImageUrl, pageTitle: `Edit ${listing.title}` });
};

module.exports.updateListing = async (req, res) => {
  let { id } = req.params;
  const uploaded = req.file;
  try {
    const listing = await Listing.findById(id);
    if (!listing) {
      throw new ExpressError(404, "Listing does not exist!");
    }
    const data = req.body.listing;

    // Geocode first so a failed lookup leaves the existing listing untouched.
    const hasGeometry =
      listing.geometry &&
      Array.isArray(listing.geometry.coordinates) &&
      listing.geometry.coordinates.length === 2;
    const placeChanged = data.location !== listing.location || data.country !== listing.country;
    const geometry =
      placeChanged || !hasGeometry ? await geocodeLocation(data.location, data.country) : null;

    listing.set(data);
    if (geometry) {
      listing.geometry = geometry;
    }
    if (uploaded) {
      listing.image = { url: uploaded.path, filename: uploaded.filename };
    }
    await listing.save({ validateModifiedOnly: true });
  } catch (err) {
    await deleteUploadedImage(uploaded);
    throw err;
  }
  req.flash("success", "Changes saved successfully.");
  res.redirect(`/listings/${id}`);
};

module.exports.destroyListing = async (req, res) => {
  let { id } = req.params;
  await Listing.findByIdAndDelete(id);
  req.flash("success", "Listing Deleted");
  res.redirect("/listings");
};
