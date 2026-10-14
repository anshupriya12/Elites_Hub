# Elites Hub

Elites Hub is a sophisticated web application that revolutionizes the way discerning travelers explore and book high-end vacation properties worldwide. Built with cutting-edge technologies and a user-centric approach, this platform offers an unparalleled experience for those seeking exceptional getaways.

## Features

- **Curated Collection of Luxury Properties**: Elites Hub showcases a meticulously curated collection of luxurious vacation properties, ranging from beachfront villas to historic castles. With detailed descriptions, high-resolution images, and comprehensive amenity listings, users can effortlessly explore and find their dream accommodation.

- **Secure User Authentication**: The application implements a robust authentication system, allowing users to sign up and log in securely. User data is handled with utmost care, ensuring privacy and protecting sensitive information.

- **Property Listing Management**: Authenticated users can create, update, and manage their property listings with ease. The application provides intuitive forms for entering listing details, uploading captivating images, and setting competitive prices.

- **Review and Rating System**: Guests can leave honest reviews and ratings for properties they've visited, providing valuable feedback to potential travelers. This transparent system fosters trust and helps users make informed decisions.

- **Seamless Payment Integration**: Elites Hub integrates with the Razorpay payment gateway, enabling users to securely complete transactions and book their dream vacations with confidence.

- **Responsive and User-Friendly Design**: The application boasts a modern and responsive design, ensuring an optimal user experience across various devices and screen sizes. The intuitive interface and seamless navigation enhance the overall user journey.

## Technologies Used

- Node.js
- Express.js
- MongoDB
- Mongoose
- Passport.js
- Cloudinary
- Razorpay
- EJS (Embedded JavaScript)

## Getting Started

To run the Elites Hub application locally, follow these steps:

1. Clone the repository: `git clone https://github.com/your-repo/elites-hub.git`
2. Install dependencies: `npm install`
3. Configure environment variables (e.g., database connection, API keys, etc.)
4. Start the development server: `npm start`
5. Open your web browser and navigate to `http://localhost:8080`

## Google sign-in (optional)

Google login is enabled only when `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are set in `.env` (see `.env.example`).

- In Google Cloud, create an OAuth client of type **Web application** and register the redirect URI
  `http://localhost:8080/google/callback` (open the site as `localhost`, not `127.0.0.1`).
- A new Google user gets an account created automatically. An existing username/password account is **not** linked
  automatically by email; log in with your password first, then choose "Login with Google" to link it.
- Run the automated tests with `npm test`.

## Contributing

Contributions are welcome! If you'd like to contribute to the Elites Hub project, please follow these steps:

1. Fork the repository
2. Create a new branch: `git checkout -b my-feature-branch`
3. Make your changes and commit them: `git commit -m 'Add my feature'`
4. Push to the branch: `git push origin my-feature-branch`
5. Submit a pull request

## Acknowledgements

We would like to extend our gratitude to the open-source community for the invaluable tools and libraries that made this project possible.
