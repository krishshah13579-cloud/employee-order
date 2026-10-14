# IQ TROUSERS — Garment Order Management System
> Production-ready wholesale garment ordering and management platform built with Next.js 15, Prisma ORM, and Tailwind CSS.

---

## 🚀 Features

- **Wholesale Order Desk**: Real-time multi-color set calculation (`Sets × Pieces`), mandatory size ratios (`30 to 38`, `28 to 36`), automatic 5% GST computation, and printable order vouchers.
- **Mandatory Employee Auth**: Sales representatives log in with their Name and Security PIN. No footer, no admin links on employee views.
- **Customer Directory**: Add new customers with Firm Name, GST/PAN, Phone, Contact Person, Shop Address, City, State, and Visiting Card photo upload.
- **Admin Management Panel**: Full CRUD for Products, Orders, Customers, Categories, Employees, and Company Profile (`/admin`).
- **Clean Slate Architecture**: Zero prior hardcoded entries. The cloud database starts completely fresh. Initial Master Admin setup is performed securely upon first launch.

---

## 🗄️ Database Setup (Vercel & Render)

For cloud deployment (Vercel / Render), use a cloud PostgreSQL database. Free instant options include:
- **[Neon Serverless Postgres](https://neon.tech)** (Recommended for Vercel)
- **[Supabase](https://supabase.com)**
- **[Render PostgreSQL](https://render.com)**

### Switch Prisma to PostgreSQL
Before deploying to Vercel/Render, switch Prisma schema provider to PostgreSQL:
```bash
npm run db:use-postgres
```
*(To switch back to SQLite for local development: `npm run db:use-sqlite`)*

Set your PostgreSQL connection string in `.env` or in Vercel/Render Environment Variables:
```env
DATABASE_URL="postgresql://username:password@ep-your-host.neon.tech/garment_orders?sslmode=require"
```

Push the database tables to your cloud database:
```bash
npx prisma db push
```

---

## 📤 Push to GitHub

1. Stage and commit your files:
```bash
git add .
git commit -m "Initial commit: Clean slate IQ Trousers garment order system"
```

2. Create a new repository on [GitHub](https://github.com/new).

3. Link and push to GitHub:
```bash
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git
git branch -M main
git push -u origin main
```

---

## ⚡ Deployment to Vercel

1. Log in to **[Vercel](https://vercel.com)** and click **"Add New Project"**.
2. Select your GitHub repository.
3. In **Environment Variables**, add:
   - **`DATABASE_URL`**: Your cloud PostgreSQL connection string (from Neon, Supabase, or Render).
4. In **Build Settings**:
   - Build Command: `npm run build` *(Prisma client generation is automated in package.json)*
5. Click **"Deploy"**.

---

## 🌐 Deployment to Render

1. Log in to **[Render](https://render.com)**.
2. (Optional) Create a free **PostgreSQL Database** on Render to get an internal/external database URL.
3. Click **"New +"** → **"Web Service"** → Select your GitHub repository.
4. Set the configuration:
   - **Environment**: `Node`
   - **Build Command**: `npm install && npm run build && npx prisma db push`
   - **Start Command**: `npm start`
5. In **Environment Variables**, add:
   - **`DATABASE_URL`**: Your PostgreSQL connection string.
   - **`NODE_ENV`**: `production`
6. Click **"Deploy Web Service"**.

---

## 🔐 First-Time System Initialization

When your deployment is live:

1. **Initialize Master Admin**:
   - Open your deployed URL: `https://your-domain.vercel.app/admin/login`
   - The system will detect a clean database and display **"First-Time System Setup"**.
   - Enter your **Full Name**, **Admin Email/Username**, **Password**, and **6-Digit 2FA Security PIN**.
   - Click **"Create Master Admin & Initialize"**.

2. **Register Employees**:
   - In Admin Panel (`/admin/employees`), click **"+ Add Employee"**.
   - Enter employee details (Name, Security PIN, Mobile, Address, Proof).
   - Staff can now log in at `/login` with their Name and PIN.

3. **Add Products & Categories**:
   - In Admin Panel (`/admin/products`), add your catalog with colors, sizes, sets, and pricing.

---

## 💻 Local Development

```bash
# Install dependencies
npm install

# Run locally with SQLite
npm run db:use-sqlite
npx prisma db push

# Start development server
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.
