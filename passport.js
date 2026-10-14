const passport = require("passport");
const crypto = require("crypto");
const GoogleStrategy = require("passport-google-oauth2").Strategy;
const User = require("./models/user.js");

const isValidId = (id) => typeof id === "string" && /^[0-9a-fA-F]{24}$/.test(id);

// Sessions store only the user's _id. The user is loaded again on every request (password hash and salt
// are never selected), so req.user is always a real User document, for local and Google logins alike.
passport.serializeUser((user, done) => {
    done(null, String(user._id));
});

passport.deserializeUser(async (id, done) => {
    try {
        // Anything that is not an id (for example a session written by an older version) means "not logged in".
        if (!isValidId(id)) return done(null, false);
        const user = await User.findById(id);
        done(null, user || false);
    } catch (err) {
        done(err);
    }
});

const normalizeEmail = (email) => String(email || "").trim().toLowerCase();

// Public username for a new Google user: first name plus a random number, so it stays unique without
// exposing the email address.
const usernameFromProfile = (profile) => {
    const first =
        (profile.name && profile.name.givenName) || String(profile.displayName || "").split(" ")[0];
    const base = String(first || "").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 16) || "traveler";
    return `${base}${crypto.randomInt(1000, 10000)}`;
};

const fail = (done, message) => done(null, false, { message });

// Finds or creates the User for a Google identity.
//  - A returning Google user is matched by Google id.
//  - A user who is already logged in with a username/password can link their Google id (only googleId is set;
//    password, username and email are never touched).
//  - Otherwise a new account is created. An existing account with the same email is NOT linked automatically,
//    because local signup does not verify email ownership; the owner must log in first and link explicitly.
const verifyGoogle = async (req, accessToken, refreshToken, profile, done) => {
    try {
        const googleId = profile && profile.id ? String(profile.id) : "";
        if (!googleId) return fail(done, "Google sign-in failed. Please try again.");

        const current = req.user && req.user._id ? req.user : null;
        const linked = await User.findOne({ googleId });
        if (linked) {
            if (current && String(current._id) !== String(linked._id)) {
                return fail(done, "That Google account is already linked to a different Elites Hub account.");
            }
            return done(null, linked);
        }

        if (current) {
            const updated = await User.findOneAndUpdate(
                { _id: current._id, googleId: { $in: [null] } },
                { $set: { googleId } },
                { new: true }
            );
            if (!updated) {
                return fail(done, "Your account is already linked to a different Google account.");
            }
            return done(null, updated);
        }

        const email = normalizeEmail(
            profile.email || (profile.emails && profile.emails[0] && profile.emails[0].value)
        );
        const verified = profile.email_verified === true || profile.email_verified === "true";
        if (!email || !verified) {
            return fail(done, "Your Google account does not have a verified email address.");
        }
        const existing = await User.findOne({ email }).collation({ locale: "en", strength: 2 });
        if (existing) {
            return fail(
                done,
                "An account with this email already exists. Log in with your username and password first, " +
                    "then choose Login with Google on the login page to link your Google account."
            );
        }

        for (let attempt = 0; attempt < 5; attempt++) {
            try {
                const user = new User({ email, username: usernameFromProfile(profile), googleId });
                await user.save();
                return done(null, user);
            } catch (err) {
                if (!err || err.code !== 11000) throw err;
                const keys = Object.keys(err.keyPattern || err.keyValue || {});
                if (keys.includes("googleId")) {
                    // Two sign-ins raced; use the account the other request created.
                    const again = await User.findOne({ googleId });
                    if (again) return done(null, again);
                }
                // Otherwise the generated username was taken: try again with a new number.
            }
        }
        return fail(done, "We could not create your account. Please try again.");
    } catch (err) {
        done(err);
    }
};

// Only register Google login when credentials are configured, so the app can start without them.
const googleEnabled = Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
if (googleEnabled) {
    passport.use(new GoogleStrategy({
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: "/google/callback",
        passReqToCallback: true
    }, verifyGoogle));
} else {
    console.warn("Google OAuth credentials not set - Google login disabled.");
}

module.exports = { googleEnabled };
