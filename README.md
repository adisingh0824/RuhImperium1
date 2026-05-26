# Ruh Imperium 🌸

Indian fragrance e-commerce store — pure attars, modern fragrances, and Kannauj perfumery. 

This project is restructured into a clean, simple, standard frontend + backend folder structure:
- **`frontend/`**: Vanilla HTML/JS/CSS SPA served via Vite.
- **`backend/`**: Express API server written in clean ES Module JavaScript.

---

## Folder Structure 📂

```
RuhImperium/
├── frontend/             # Static HTML/CSS/JS frontend
│   ├── index.html        # Main SPA HTML Entry
│   ├── vite.config.js    # Vite configuration with API Proxying
│   ├── package.json      # Frontend scripts & dependencies
│   └── public/           # Public assets (images, app.js, styles)
│
├── backend/              # Node.js Express API Backend
│   ├── index.js          # Backend entry point
│   ├── app.js            # Express app configuration
│   ├── package.json      # Express scripts & dependencies
│   ├── database/         # Contains catalog database (products.js)
│   ├── data/             # Local SQLite databases (ruh-imperium.sqlite)
│   ├── routes/           # API routes (ruh-imperium.js, health.js)
│   └── lib/              # Utility libraries (logger.js)
```

---

## Getting Started 🚀

### 1. Run the Backend Server
Navigate to the `backend/` folder, install dependencies, and start the development server:

```bash
cd backend
pnpm install     # or npm install
pnpm run dev     # or npm run dev (starts on port 3000)
```

### 2. Run the Frontend App
Navigate to the `frontend/` folder, install dependencies, and start the Vite dev server:

```bash
cd frontend
pnpm install     # or npm install
pnpm run dev     # or npm run dev (starts on port 19502)
```

Now open [http://localhost:19502](http://localhost:19502) in your browser! Vite automatically proxies all `/api/*` calls to the backend on `http://localhost:3000`.

---

## Technologies & Stack 🛠️

- **Frontend**: Vanilla HTML5, CSS3 (Glassmorphism & premium aesthetics), vanilla ES6 JavaScript, PWA Service Worker.
- **Backend**: Node.js, Express, Pino (Structured Logging), Nodemailer (SMTP notifications).
- **Database**: SQLite (built-in Node `DatabaseSync`), with optional MongoDB or Supabase integrations.
- **Payments**: Razorpay gateway.
- **AI scent assistant**: OpenAI GPT integration (with local fallback).
