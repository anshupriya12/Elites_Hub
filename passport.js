const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth2").Strategy;

passport.serializeUser((user, done) => {
    done(null, user);
});

passport.deserializeUser((user, done) => {
    done(null, user);
});

// Only register Google login when credentials are configured, so the app can start without them.
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    passport.use(new GoogleStrategy({
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: "/google/callback",
        passReqToCallback: true
    }, function (request, accessToken, refreshToken, profile, done) {
        console.log(profile);
        return done(null, profile);
    }));
} else {
    console.warn("Google OAuth credentials not set - Google login disabled.");
}
