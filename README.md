# Elites Hub

A full-stack property-listing web application for India. Visitors can browse and search properties, owners can list and manage their own properties, and signed-in users can book a stay and pay in Razorpay **test mode**. Built with Node.js, Express, EJS and MongoDB.

## Live Demo

**[https://elites-hub-f6nu.onrender.com/](https://elites-hub-f6nu.onrender.com/)**

Hosted on Render. If the service has been idle, the first request may take a little longer to respond.

> The 50 properties shown on the home and listing pages are **fictional sample listings** with illustrative stock photos. They are clearly labelled "Sample" and cannot be booked, edited or deleted.

## Project Demo

**Live website:** [https://elites-hub-f6nu.onrender.com/](https://elites-hub-f6nu.onrender.com/)

**Showcase video** (42 seconds):

https://github.com/user-attachments/assets/74fc74f1-85fa-41f7-8ac1-0015c0115eca

Full-quality MP4 stored in this repository: [Watch Elites Hub Showcase](assets/Elites_Hub_Showcase.mp4) (about 17 MB).

The video walks through the Elites Hub workflow: browsing and searching properties, signing in, the listing form and owner controls (Edit and Delete), a second account opening a listing and starting a booking, and the Razorpay Checkout in test mode. It is built from real screenshots of the deployed application. The player above uses a lighter 9 MB web copy of the same video, because GitHub limits attached videos to 10 MB.

## Table of Contents

- [Project Demo](#project-demo)
- [Key Features](#key-features)
- [Technology Stack](#technology-stack)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [Running the App](#running-the-app)
- [Database and Sample Data](#database-and-sample-data)
- [Testing](#testing)
- [Routes](#routes)
- [Deployment](#deployment)
- [Security Notes and Known Limitations](#security-notes-and-known-limitations)
- [Contributing](#contributing)

## Key Features

**Browsing and search**
- Home page with featured properties and a search box.
- Property listing page with city search (`q`), minimum and maximum price filters, a result count, active-filter chips and a friendly empty state.
- Search understands common city spellings (for example Bangalore/Bengaluru, Bombay/Mumbai) through an explicit alias list. There is no fuzzy matching.
- Property detail page with photo, description, price in INR, owner, reviews and a map.

**Accounts**
- Sign up, log in and log out with username and password (Passport Local, with hashed passwords via `passport-local-mongoose`).
- Optional "Login with Google" (Google OAuth 2.0), enabled only when Google credentials are configured.
- Sessions are stored in MongoDB.

**Property management**
- Signed-in users can create, edit and delete their own listings, including a photo upload.
- Ownership is enforced on the server: only a listing's owner can edit or delete it.
- Input is validated on the server with Joi. Image uploads are limited to one PNG, JPEG or WebP file of up to 5 MB.
- Listing addresses are geocoded with Mapbox for the map.

**Reviews**
- Signed-in users can add a 1-5 star review with a comment and delete their own reviews.

**Booking and payment (test mode only)**
- Signed-in users can book a real (non-sample) listing by choosing check-in and check-out dates and the number of guests (stays are limited to 30 nights).
- Payment uses Razorpay Checkout. The server creates the order, verifies the payment signature (HMAC-SHA256) and only then marks the booking as paid.
- The app only accepts Razorpay keys that start with `rzp_test_` and refuses live keys, so no real money is ever charged.
- Sample listings cannot be booked, enforced on the server as well as in the UI.
- A booking confirmation page is shown after payment.

**Interface**
- Shared responsive layout, header and footer, breadcrumbs and back links on every page, with a custom 404/error page.
- Accessibility work: skip link, landmarks, visible keyboard focus and reduced-motion support.

## Technology Stack

| Area | Technology |
| --- | --- |
| Runtime and server | Node.js, Express 4 |
| Templating | EJS with `ejs-mate` layouts |
| Database | MongoDB (MongoDB Atlas) with Mongoose 7 |
| Sessions | `express-session` with `connect-mongo`, `connect-flash` |
| Authentication | Passport (`passport-local`, `passport-local-mongoose`, `passport-google-oauth2`) |
| Validation | Joi |
| File uploads | Multer with `multer-storage-cloudinary` and Cloudinary |
| Maps | Mapbox (`@mapbox/mapbox-sdk` for geocoding, Mapbox GL JS in the browser) |
| Payments | Razorpay (test mode) |
| Misc | `method-override`, `compression`, `dotenv` |
| Front end | Bootstrap-based layout with a custom CSS design system and plain JavaScript |
| Testing | Node's built-in test runner (`node --test`) |

## Project Structure

```
.
├── app.js                 # Express app: config, sessions, middleware, routes, error handling
├── cloudConfig.js         # Cloudinary storage configuration for uploads
├── middleware.js          # Auth, ownership, validation and review-author checks
├── passport.js            # Local and Google passport strategies
├── schema.js              # Joi validation schemas
├── controllers/           # Request handlers (listing, user, review, booking)
├── models/                # Mongoose models (Listing, User, Review, Booking)
├── routes/                # Express routers (home, listing, review, user, booking, google)
├── utils/                 # Helpers: booking maths, city aliases, property images, errors
├── views/                 # EJS templates (layouts, includes, listings, users, booking pages)
├── public/                # Static files: css/, js/, images/ (including sample property photos)
├── init/                  # Sample-data scripts and photo manifest
├── tests/                 # Automated tests
└── package.json
```

Sample-data scripts live in `init/`:

- `seedDemo.js` - the safe sample-data seed (see [Database and Sample Data](#database-and-sample-data)).
- `demoListings.js`, `demoPhotos.js`, `legacyDemo.js` - the sample listing data and photo manifest.
- `downloadDemoPhotos.js` - re-downloads the sample photos.
- `index.js` - an older seed script that deletes data. It refuses to run unless `ALLOW_DB_SEED=true` and a `SEED_OWNER_ID` are set. Do not run it against a database you care about.

## Getting Started

### Prerequisites

- **Node.js 18 or newer** (`package.json` pins `18.17.1` in `engines`; the project was developed and tested on Node 20).
- **npm**
- A **MongoDB Atlas** cluster (or another MongoDB connection string)
- Optional, depending on which features you want to use: a Cloudinary account, a Mapbox public token, a Google OAuth client, and Razorpay **test** keys.

### Installation

```bash
git clone https://github.com/anshupriya12/Elites_Hub.git
cd Elites_Hub
npm install
```

Create a `.env` file in the project root (it is ignored by Git) and fill in the values described below. A template is provided in `.env.example`.

## Environment Variables

Use placeholders like the ones below. **Never commit real values.**

```env
NODE_ENV=development
SECRET=YOUR_SESSION_SECRET
ATLASDB_URL=YOUR_MONGODB_URI

CLOUD_NAME=YOUR_CLOUDINARY_CLOUD_NAME
CLOUD_API_KEY=YOUR_CLOUDINARY_API_KEY
CLOUD_API_SECRET=YOUR_CLOUDINARY_API_SECRET

MAP_TOKEN=YOUR_MAPBOX_PUBLIC_TOKEN

GOOGLE_CLIENT_ID=YOUR_GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET=YOUR_GOOGLE_CLIENT_SECRET

RAZORPAY_KEY_ID=rzp_test_YOUR_TEST_KEY_ID
RAZORPAY_KEY_SECRET=YOUR_RAZORPAY_TEST_KEY_SECRET
```

| Variable | Purpose | Required |
| --- | --- | --- |
| `NODE_ENV` | When set to `production`, the app does not load a local `.env` file and uses the host's environment instead. | Yes on a host |
| `SECRET` | Secret used for sessions and the session store. Use a long random string. | Yes |
| `ATLASDB_URL` | MongoDB connection string. It must name the `elites_hub` database. | Yes |
| `CLOUD_NAME`, `CLOUD_API_KEY`, `CLOUD_API_SECRET` | Cloudinary credentials for listing image uploads. | For creating listings |
| `MAP_TOKEN` | Mapbox **public** token (starts with `pk.`) for geocoding and the map. | For creating listings and maps |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Enable "Login with Google". Leave unset to disable it. | Optional |
| `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET` | Razorpay **test-mode** keys. The key ID must start with `rzp_test_`. Leave unset to disable booking. | Optional |

For Google sign-in, register the redirect URI `http://localhost:8080/google/callback` locally (open the site as `localhost`, not `127.0.0.1`) and `https://YOUR_DOMAIN/google/callback` when deployed.

For MongoDB Atlas, allow your IP address under Network Access.

## Running the App

```bash
npm start
```

This runs `node app.js`. The server listens on **port 8080**, so open [http://localhost:8080](http://localhost:8080).

The home page, listings and detail pages work without logging in. Creating or editing listings, reviews and bookings require an account.

## Database and Sample Data

The app stores users, listings, reviews and bookings in MongoDB through Mongoose. Collections are created automatically on first use, and no migration step is needed.

`init/seedDemo.js` adds **50 clearly labelled, fictional sample properties** (5 each in Delhi, Mumbai, Kolkata, Bengaluru, Chennai, Hyderabad, Ahmedabad, Surat, Pune and Jaipur). They are not real or verified, and they cannot be booked, edited or deleted.

Safety checks built into the seed script:

- It only runs with an explicit opt-in (`ALLOW_DEMO_SEED=true`).
- It refuses to run unless the database named in `ATLASDB_URL` is exactly `elites_hub`.
- It never touches users or existing listings.
- It is safe to repeat: records are upserted by a stable `demoKey`.

```bash
# Preview only: connects to nothing and writes nothing
ALLOW_DEMO_SEED=true npm run seed:demo -- --dry-run

# Real run (writes to the database in ATLASDB_URL)
ALLOW_DEMO_SEED=true npm run seed:demo
```

On Windows PowerShell, set the variable first: `$env:ALLOW_DEMO_SEED = "true"`.

Sample records have no owner, which is why they cannot be edited or deleted through the app.

The sample photographs are licensed Unsplash images stored in `public/images/properties/`. They are illustrative only. Credits are in `init/PHOTO_CREDITS.md`.

## Testing

```bash
npm test
```

This runs the automated suite with Node's built-in test runner. At the time of writing it contains 185 tests that all pass. They cover validation, booking calculations and signature checks, listing creation and editing, search and city aliases, sample-data safety, navigation and link checking, and the design tokens. The tests do not call the real database, Cloudinary, Razorpay or Mapbox.

## Routes

| Route | Access | Description |
| --- | --- | --- |
| `GET /` | Public | Home page with featured properties |
| `GET /listings` | Public | All properties, with `?q=`, `?minPrice=` and `?maxPrice=` filters |
| `GET /listings/:id` | Public | Property details |
| `GET /listings/new`, `POST /listings` | Logged in | Create a listing |
| `GET /listings/:id/edit`, `PUT /listings/:id`, `DELETE /listings/:id` | Owner | Edit or delete a listing |
| `POST /listings/:id/reviews`, `DELETE /listings/:id/reviews/:reviewId` | Logged in / review author | Add or delete a review |
| `GET /listings/:id/book`, `POST /listings/:id/bookings` | Logged in | Start a booking (not for sample listings) |
| `GET /bookings/:bookingId` | Logged in | Booking confirmation |
| `GET /signup`, `GET /login`, `GET /logout` | Public | Account pages |
| `GET /google`, `GET /google/callback` | Public | Google sign-in |

## Deployment

The application is deployed on Render: **[https://elites-hub-f6nu.onrender.com/](https://elites-hub-f6nu.onrender.com/)**

General requirements for any Node.js host:

- Run it as a persistent Node.js web service with `npm install` as the build command and `npm start` as the start command.
- Set `NODE_ENV=production` and all the environment variables above in the host's dashboard. Do not upload a `.env` file.
- Allow the host's outbound IP address in MongoDB Atlas Network Access.
- Register `https://YOUR_DOMAIN/google/callback` in Google Cloud if you use Google sign-in.

## Security Notes and Known Limitations

- Secrets are read from environment variables and `.env` is excluded from Git. Never commit credentials.
- Passwords are salted and hashed; sessions use `httpOnly` cookies and are stored in MongoDB.
- Authorization (login, listing ownership, review authorship) and the sample-listing booking block are enforced on the server.
- Payments are **test mode only**. The app refuses live Razorpay keys, and a booking is marked paid only after the payment signature is verified on the server.
- The sample properties are fictional, and their photos are illustrative stock images.
- The server port is currently fixed at `8080` in `app.js` and is not read from a `PORT` variable. Hosts that assign their own port may need that changed.
- There is no `trust proxy` setting, so behind an HTTPS proxy Google sign-in may need extra configuration.
- Creating listings requires Cloudinary and Mapbox credentials; without them those flows will not work.
- Real transactions are out of scope: the project is a portfolio and learning application.

## Contributing

1. Fork the repository.
2. Create a branch: `git checkout -b my-feature-branch`.
3. Commit your changes: `git commit -m "Describe your change"`.
4. Push the branch: `git push origin my-feature-branch`.
5. Open a pull request.

In this repository, work is done on `development` and merged into `main` through a pull request.
