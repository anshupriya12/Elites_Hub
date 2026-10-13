const express = require("express");
const router = express.Router();
const wrapAsync = require("../utils/wrapAsync.js");
const Listing = require("../models/listing.js");
const { isLoggedIn, isOwner, validateListing } = require("../middleware.js");
const listingController = require("../controllers/listing.js");
const multer = require("multer");
const { storage } = require("../cloudConfig.js");
const ExpressError = require("../utils/ExpressError.js");

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp"];
const IMAGE_ERROR = "Please upload a PNG, JPG or WebP image up to 5 MB.";

// Rejects non-images before anything is sent to Cloudinary.
const upload = multer({
  storage,
  limits: { fileSize: MAX_IMAGE_BYTES, files: 1 },
  fileFilter: (req, file, cb) => {
    if (ALLOWED_IMAGE_TYPES.includes(file.mimetype)) {
      return cb(null, true);
    }
    cb(new ExpressError(400, IMAGE_ERROR));
  },
});

// Wraps multer so its errors (for example "file too large") become normal 400 responses.
const uploadImage = (req, res, next) => {
  upload.single("listing[image]")(req, res, (err) => {
    if (!err) return next();
    if (err instanceof multer.MulterError) {
      return next(new ExpressError(400, IMAGE_ERROR));
    }
    next(err);
  });
};

router
  .route("/")
  .get(wrapAsync(listingController.index))
  .post(
    isLoggedIn,
    uploadImage,
    validateListing,
    wrapAsync(listingController.createListing)
  );

  

// new route
router.get("/new", isLoggedIn, listingController.renderNewForm);

router
  .route("/:id")
  .get(wrapAsync(listingController.showListing))
  .put(
    isLoggedIn,
    isOwner,
    uploadImage,
    validateListing,
    wrapAsync(listingController.updateListing)
  )
  .delete(isLoggedIn, isOwner, wrapAsync(listingController.destroyListing));

//edit route
router.get(
  "/:id/edit",
  isLoggedIn,
  isOwner,
  wrapAsync(listingController.renderEditForm)
);

module.exports = router;
