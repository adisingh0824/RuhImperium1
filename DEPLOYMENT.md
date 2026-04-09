# Ruh Imperium Deployment

This project is ready to deploy on Railway or Render with MongoDB Atlas.

## Required environment variables

```env
AUTH_SECRET=your-long-random-secret
ADMIN_EMAIL=your-admin-email@example.com
RAZORPAY_KEY_ID=your_razorpay_key_id
RAZORPAY_KEY_SECRET=your_razorpay_key_secret
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/?retryWrites=true&w=majority
MONGODB_DB_NAME=ruhImperium
```

## Railway

1. Push this project to GitHub.
2. Create a new Railway project from the GitHub repo.
3. Add the environment variables above.
4. Railway will use `npm start`.
5. Verify:
   - `/api/health`
   - `/api/config`

## Render

1. Push this project to GitHub.
2. Create a new Web Service on Render from the repo.
3. Render will detect `render.yaml`, or configure:
   - Build command: `npm install`
   - Start command: `npm start`
4. Add the environment variables above.
5. Verify:
   - `/api/health`
   - `/api/config`

## MongoDB Atlas

1. Create a cluster.
2. Create a database user.
3. Allow your deployment platform in Network Access.
   - For quick setup, you can temporarily allow `0.0.0.0/0`.
4. Copy the connection string and put it into `MONGODB_URI`.

## Notes

- If `MONGODB_URI` is set, MongoDB becomes the primary database.
- If MongoDB is not set, the app falls back to Supabase or SQLite.
- For production, keep Razorpay keys and MongoDB credentials only in platform environment variables, not in Git.
