# EcoTrack — Community Waste Management System

A full-stack community waste management application for Bugema, Busiika, Namulonge, Kiwenda and Kiziri.

## Included features

- Resident self-registration and sign-in
- Secure password hashing with bcryptjs
- JWT-based authentication
- One-time first-administrator setup
- Administrator, Community Officer and Resident roles
- Server-side authorization for every protected API
- Waste report create, read, update and delete operations
- Search and status/community filtering
- Collection status tracking
- Administrator creation and activation/deactivation of community officers
- MongoDB database using Mongoose
- Analytics dashboard by status, community, waste type and month
- Collection team management by community, with activation/deactivation
- Collection scheduling with team assignment and status tracking
- In-app notifications and read/unread tracking
- Waste report photo uploads (JPG, PNG, WEBP; 5 MB limit)
- PDF and Excel exports for administrators and officers
- Administrator activity audit log

## Requirements

- Node.js LTS
- MongoDB Community Server running locally, or a MongoDB URI
- VS Code (recommended)

## Installation on Windows

1. Extract this ZIP file.
2. Open the extracted `community_waste_management_complete` folder in VS Code.
3. Open a terminal and run:

   ```powershell
   cd backend
   npm.cmd install
   ```

4. Copy `backend/.env.example` to `backend/.env`.
5. Open `.env` and set your own private values:

   ```env
   PORT=5000
   MONGODB_URI=mongodb://127.0.0.1:27017/community_waste_management
   JWT_SECRET=PASTE_A_RANDOM_SECRET_OF_AT_LEAST_32_CHARACTERS
   SETUP_KEY=CHOOSE_A_PRIVATE_ONE_TIME_SETUP_KEY
   ```

   Generate a strong JWT secret in PowerShell:

   ```powershell
   node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
   ```

   Do not share your `.env` file or publish it.

6. Ensure MongoDB Server is running.
7. Start the backend from the `backend` folder:

   ```powershell
   npm.cmd run dev
   ```

8. Open `http://localhost:5000/#setup` to create the first administrator.
9. Enter the setup key exactly as written in `.env`.
10. After the administrator has been created, remove the `SETUP_KEY` line from `.env` and restart the backend.
11. Sign in at `http://localhost:5000`.

## Roles

### Administrator
- View all community reports
- Create community officer accounts and assign a community
- Enable or disable user accounts
- Edit and delete reports
- Update collection status

### Community Officer
- View reports in the assigned community
- Create reports for the assigned community
- Update collection status and report descriptions

### Resident
- Register an account for one community
- Submit waste reports
- View only reports they submitted
- Edit or delete their own reports while status is Pending
- Track collection status

Public registration always creates a Resident. It cannot create administrator or officer accounts.

## Database

Database name: `community_waste_management`

Collections:
- `users`
- `wastereports`

Existing `wastereports` documents are retained. Old reports that do not have a `submittedBy` field remain visible to administrators and community officers, but not to resident accounts.

## API endpoints

- `GET /api/health`
- `GET /api/communities`
- `POST /api/auth/setup-admin`
- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/auth/me`
- `GET /api/users` (administrator)
- `POST /api/users/officers` (administrator)
- `PATCH /api/users/:id` (administrator)
- `GET /api/reports`
- `POST /api/reports`
- `GET /api/reports/:id`
- `PUT /api/reports/:id`
- `DELETE /api/reports/:id`

Protected endpoints require `Authorization: Bearer <token>`.

## Important

This is a learning/local project. Before public deployment, configure HTTPS, rate limiting, restrictive CORS, secure token storage, backups, audit logs and production secrets management. Do not blindly run `npm audit fix --force`. Uploaded images are stored in `backend/uploads`; back up this folder together with MongoDB. Schedule data, notifications and audit logs are stored in MongoDB collections.

## Upgrade modules added in this edition

- Analytics summary with report totals by status, community, waste category and recent month.
- Collection schedule creation and status tracking. Administrators can schedule across communities; officers are restricted to their assigned community.
- In-app notifications with read/unread controls. Report status updates notify the report owner.
- Optional waste photographs. Accepted formats: JPG, PNG and WEBP; maximum 5 MB. Files are stored under `backend/uploads`.
- PDF and Excel report exports for administrators and community officers, scoped to their permissions.
- Administrator-only activity log for report and schedule changes.

## Updating an existing EcoTrack installation safely

1. Stop the existing server with `Ctrl+C`.
2. Keep the old project folder as a backup. Do not delete it.
3. Back up the MongoDB database `community_waste_management` before upgrading. If MongoDB Database Tools are installed, run `mongodump --db community_waste_management --out C:\\EcoTrackBackup` in PowerShell.
4. Extract this upgraded ZIP into a NEW folder and open its inner project folder in VS Code.
5. Copy your existing private `backend/.env` into the new project's `backend` folder. Do not upload or share this file.
6. In the new project's `backend` terminal, run `npm.cmd install`. This edition adds `multer`, `pdfkit` and `exceljs`, so additional packages must download.
7. Start MongoDB, then run `npm.cmd run dev`.
8. Open `http://localhost:5000` and sign in with your existing administrator account.

The MongoDB connection string in `.env` should remain pointed at the existing `community_waste_management` database. Existing users and waste reports are not intentionally deleted or reset. New collections for collection teams, schedules, notifications and activity logs are created automatically when first used. Do not run the first-administrator setup again if an administrator already exists.

If npm reports a network timeout, retry `npm.cmd install` after checking the internet connection. Do not copy `node_modules` from the old project and do not run `npm audit fix --force` as part of this upgrade.
