const mongoose = require("mongoose");
const Schema = mongoose.Schema;
const passportLocalMongoose = require("passport-local-mongoose");

const userSchema = new Schema({
  email: {
    type: String,
    required: true,
  },
  // Google account id (the stable "sub" claim). Absent for users who only use a username and password.
  googleId: {
    type: String,
    unique: true,
    sparse: true,
  },
});

userSchema.plugin(passportLocalMongoose);
const User = mongoose.model("User", userSchema);
module.exports = User;
