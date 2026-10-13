const Joi = require("joi");

module.exports.listingSchema = Joi.object({
    listing: Joi.object({
    title: Joi.string().trim().max(100).required(),
    description: Joi.string().trim().max(2000).required(),
    location: Joi.string().trim().max(100).required(),
    country: Joi.string().trim().max(60).required(),
    // Must be > 0 so every listing can be booked (the booking flow rejects non-positive prices).
    price: Joi.number().greater(0).max(100000).required(),
    image: Joi.string().allow("", null),
  }).required(),
});

module.exports.bookingSchema = Joi.object({
    booking: Joi.object({
    checkIn: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).required(),
    checkOut: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).required(),
    guests: Joi.number().integer().min(1).max(20).required(),
    }).required(),
});

module.exports.reviewSchema = Joi.object({
    review: Joi.object({
    rating: Joi.number().required().min(1).max(5),
    comment: Joi.string().required(),
    }).required(),
});
