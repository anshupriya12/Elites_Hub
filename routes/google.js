const express = require("express");
const router = express.Router();
const passport = require("passport");
const { googleEnabled } = require("../passport.js");

// Same paths as before: /google starts sign-in, /google/callback is the redirect URI registered with Google.
router.use(["/google", "/google/callback"], (req, res, next) => {
  if (!googleEnabled) {
    req.flash("error", "Google login is not configured.");
    return res.redirect("/login");
  }
  next();
});

router.get("/google", passport.authenticate("google", { scope: ["profile", "email"] }));

router.get(
  "/google/callback",
  passport.authenticate("google", { failureRedirect: "/login", failureFlash: true }),
  (req, res) => {
    res.redirect("/success");
  }
);

module.exports = router;
