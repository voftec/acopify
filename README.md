# Acopify

Open-source web application built with Firebase Hosting and Firebase Realtime Database.

## Tech Stack

- **Hosting:** Firebase Hosting
- **Database:** Firebase Realtime Database
- **Frontend:** HTML, CSS (Tailwind CSS via CDN), vanilla JavaScript
- **Icons:** Lucide Icons

## Project Structure

```
Acopify/
├── public/                  # Firebase Hosting root
│   ├── index.html           # Main entry point
│   ├── assets/
│   │   ├── css/
│   │   │   └── styles.css   # Custom styles
│   │   ├── js/
│   │   │   ├── app.js       # Main application logic
│   │   │   └── firebase-init.js  # Firebase initialization
│   │   └── img/             # Static images
│   └── 404.html             # Custom 404 page
├── firebase.json            # Firebase project configuration
├── .firebaserc              # Firebase project aliases
├── rtdb.rules.json          # Realtime Database security rules
└── .gitignore
```

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v18+)
- [Firebase CLI](https://firebase.google.com/docs/cli) (`npm install -g firebase-tools`)

### Setup

1. Clone the repository:
   ```bash
   git clone https://github.com/voftec/Acopify.git
   cd Acopify
   ```

2. Log in to Firebase:
   ```bash
   firebase login
   ```

3. Start the local development server:
   ```bash
   firebase serve
   ```

4. Open `http://localhost:5000` in your browser.

### Deployment

```bash
firebase deploy
```

## Firebase Configuration

Before deploying, update `public/assets/js/firebase-init.js` with your Firebase project credentials. You can find these in the [Firebase Console](https://console.firebase.google.com/) under Project Settings.

## License

MIT
