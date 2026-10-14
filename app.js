if (process.env.NODE_ENV != "production") {
  require("dotenv").config();
}
require("./passport")

const express = require("express");
const app = express();
const mongoose = require("mongoose");
const path = require("path");
const methodOverride = require("method-override");
const ejsMate = require("ejs-mate");
const ExpressError = require("./utils/ExpressError.js");
const session = require("express-session");
const MongoStore = require("connect-mongo");
const flash = require("connect-flash");
const passport = require("passport");
const LocalStrategy = require("passport-local");
const User = require("./models/user.js");
const listingRouter = require("./routes/listing.js");
const reviewRouter = require("./routes/review.js");
const userRouter = require("./routes/user.js");
const bookingRouter = require("./routes/booking.js");
const googleRouter = require("./routes/google.js");
const listingController = require("./controllers/listing.js");
const compression = require('compression');

const dbUrl = process.env.ATLASDB_URL;
if (!dbUrl) {
  console.error(
    "ATLASDB_URL is not set. Add your MongoDB connection string to .env (see .env.example)."
  );
  process.exit(1);
}

main()
  .then(() => {
    console.log("Connected to DB");
  })
  .catch((err) => {
    console.error(err);
  });

async function main() {
  await mongoose.connect(dbUrl);
}

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(express.urlencoded({ extended: true }));
app.use(methodOverride("_method"));
app.engine("ejs", ejsMate);
app.use(express.static(path.join(__dirname, "/public")));
const cacheController = require('express-cache-controller');

const store = MongoStore.create({
  mongoUrl: dbUrl,
  crypto: {
    secret: process.env.SECRET,
  },
  touchAfter: 24 * 3600,
});

store.on("error", (err) => {
  console.log("ERROR in MONGO SESSION STORE", err);
});

const sessionOptions = {
  store,
  secret: process.env.SECRET,
  resave: false,
  saveUninitialized: true,
  cookie: {
    expires: Date.now() + 7 * 24 * 60 * 60 * 1000,
    maxAge: 7 * 24 * 60 * 60 * 1000,
    httpOnly: true,
  },
};

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "homepage.html"));
});

app.use(session(sessionOptions));
app.use(flash());
app.use(compression());
app.use(passport.initialize());
app.use(passport.session());
passport.use(new LocalStrategy(User.authenticate()));
// Session serialization (user _id only) is configured in passport.js and shared by local and Google logins.

app.use((req, res, next) => {
  res.locals.success = req.flash("success");
  res.locals.error = req.flash("error");
  res.locals.currUser = req.user;
  next();
});


app.use("/listings", listingRouter);
app.use("/listings/:id/reviews", reviewRouter);
app.use("/", bookingRouter);
app.use("/", userRouter);

app.get("/success", listingController.index);

app.set('cacheAge', 86400); // Cache static assets for 24 hours
app.use(cacheController({
  maxAge: app.get('cacheAge'),
  stripExtensions: ['.html', '.css', '.js'],
}));

app.get("/failed", (req, res) => {
    res.render("errors", { message: "Sign-in failed. Please try again." });
});

// /google and /google/callback (the redirect URI registered with Google)
app.use("/", googleRouter);


app.all("*", (req, res, next) => {
  next(new ExpressError(404, "Page not Found!"));
});

app.use((err, req, res, next) => {
  let { statusCode = 500, message = "Something went Wrong!" } = err;
  res.status(statusCode).render("errors.ejs", { message });
});

app.listen(8080, () => {
  console.log("server is listening to port 8080");
});
