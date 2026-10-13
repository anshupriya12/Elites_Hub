const Listing = require("../models/listing.js");
const ExpressError = require("../utils/ExpressError.js");
const { deleteUploadedImage } = require("../cloudConfig.js");
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

module.exports.index = async (req, res) => {
  const allListings = await Listing.find({});
  res.render("listings/index.ejs", { allListings });
};


module.exports.renderNewForm = (req, res) => {
  res.render("listings/new.ejs");
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
  res.render("listings/show.ejs", { listing });
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
  res.render("listings/edit.ejs", { listing, originalImageUrl });
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
  req.flash("success", "Listing Updated");
  res.redirect(`/listings/${id}`);
};

module.exports.destroyListing = async (req, res) => {
  let { id } = req.params;
  await Listing.findByIdAndDelete(id);
  req.flash("success", "Listing Deleted");
  res.redirect("/listings");
};
