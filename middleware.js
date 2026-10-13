const Listing = require("./models/listing");
const Review = require("./models/review");
const ExpressError = require("./utils/ExpressError.js");
const { listingSchema, reviewSchema } = require("./schema.js");
const { deleteUploadedImage } = require("./cloudConfig.js");

module.exports.isLoggedIn = (req, res, next) => {
  if (!req.isAuthenticated()) {
    req.session.redirectUrl = req.originalUrl;
    req.flash("error", "Log in to add new listings");
    return res.redirect("/login");
  }
  next();
};

// For fetch/JSON endpoints: answer 401 JSON instead of redirecting to the login page.
module.exports.isLoggedInJson = (req, res, next) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: "Please log in to continue." });
  }
  next();
};

module.exports.saveRedirectUrl = (req, res, next) => {
  if (req.session.redirectUrl) {
    res.locals.redirectUrl = req.session.redirectUrl;
  }
  next();
};

const isValidId = (id) => /^[0-9a-fA-F]{24}$/.test(id);

module.exports.isOwner = async (req, res, next) => {
  try {
    let { id } = req.params;
    let listing = isValidId(id) ? await Listing.findById(id) : null;
    if (!listing) {
      req.flash("error", "Listing does not exist!");
      return res.redirect("/listings");
    }
    // A listing with no owner can't be edited/deleted by anyone until its data is repaired.
    if (!listing.owner || !listing.owner.equals(res.locals.currUser._id)) {
      req.flash("error", "Only the owner can edit/delete the listing");
      return res.redirect(`/listings/${id}`);
    }
    next();
  } catch (err) {
    next(err);
  }
};

module.exports.validateListing = async (req, res, next) => {
  let { error, value } = listingSchema.validate(req.body);
  if (error) {
    // The image may already be on Cloudinary (multer runs first); remove it since the listing is rejected.
    await deleteUploadedImage(req.file);
    let errMsg = error.details.map((el) => el.message).join(",");
    return next(new ExpressError(400, errMsg));
  }
  // Use the validated values: text is trimmed and the price is a number. Images only come from the upload.
  delete value.listing.image;
  req.body = value;
  next();
};

module.exports.validateReview = (req, res, next) => {
  let { error } = reviewSchema.validate(req.body);
  if (error) {
    let errMsg = error.details.map((el) => el.message).join(",");
    throw new ExpressError(400, errMsg);
  } else {
    next();
  }
};

module.exports.isReviewAuthor = async (req, res, next) => {
  try {
    let { id, reviewId } = req.params;
    let review = isValidId(reviewId) ? await Review.findById(reviewId) : null;
    if (!review) {
      req.flash("error", "Review does not exist!");
      return res.redirect(isValidId(id) ? `/listings/${id}` : "/listings");
    }
    if (!review.author || !review.author.equals(res.locals.currUser._id)) {
      req.flash("error", "Only the author can delete the review");
      return res.redirect(`/listings/${id}`);
    }
    next();
  } catch (err) {
    next(err);
  }
};
