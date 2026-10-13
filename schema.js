const Joi = require("joi");

module.exports.listingSchema = Joi.object({
    listing: Joi.object({
    title: Joi.string().required(),
    description: Joi.string().required(),
    location: Joi.string().required(),
    country: Joi.string().required(),
    price: Joi.number().required().min(0),
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
