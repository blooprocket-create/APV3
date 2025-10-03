# Studio Nova — Framework-free E-commerce MVP

Studio Nova is a vanilla HTML/CSS/JavaScript storefront backed by Vercel serverless functions and a Neon (Postgres) database. It ships email/password auth (JWT via HttpOnly cookies), digital product purchases with mock payments, a full service-request workflow (quotes, messaging, deliverables), and an admin control panel – all without client-side frameworks or ORMs.

## Highlights

- **Frontend:** Static pages under `/public` styled with CSS variables, light/dark via `prefers-color-scheme`, tasteful animations, and ES modules for behavior.
- **Backend:** Vercel serverless functions in `/api` using `pg` with parameterized SQL. Shared helpers live in `/lib`.
- **Database:** Neon Postgres schema defined in `/sql/001_init.sql` with seed data in `002_seed.sql` (admin/editor/customers, products, services, requests, quote).
- **Auth:** Bcrypt-hashed passwords, JWT sessions stored in secure HttpOnly cookies, role-based guards for editor/admin features.
- **Workflows:**
  - Digital product mock purchase unlocks in the account area.
  - Service request lifecycle (request ? quoting ? mock payment ? deliverables).
  - Admin dashboard with user/product/service CRUD, Kanban-style request board, notifications broadcast.
- **Notifications:** Simple polling bell + list with mark-as-read support.
- **SEO:** Each page includes metadata, plus `sitemap.xml` and `robots.txt`.

## Project Structure

```
public/
  index.html, products.html, ...         # Marketing + app pages
  css/styles.css                         # Global styles + animations
  js/                                    # ES modules (apiClient, auth, catalog, admin, ui)
  assets/logo.svg                        # Animated SVG wordmark
api/
  *.ts                                   # Serverless endpoints (auth, catalog, orders, requests, admin, notifications)
lib/
  auth.ts, db.ts, validators.ts, utils.ts, env.ts
sql/
  001_init.sql, 002_seed.sql            # Schema + sample data
vercel.json                             # Rewrites for dynamic routes
```

## Getting Started

### Prerequisites

- Node.js 18+
- npm (ships with Node)
- Vercel CLI (`npm i -g vercel`) recommended for local dev
- Neon (or any Postgres instance) with SSL required

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment variables

Create a `.env` file (never commit this) with your Neon credentials and a strong JWT secret:

```
DATABASE_URL="postgresql://USER:PASSWORD@HOST:PORT/DBNAME?sslmode=require"
JWT_SECRET="paste_a_random_64_character_value"
```

Vercel will inherit the same variables when you add them to the project settings.

### 3. Provision the database

Run the migration and seed scripts (via the Neon SQL editor or `psql`):

```sql
\i sql/001_init.sql;
\i sql/002_seed.sql;
```

This seeds:

- Admin — `admin@example.com / Admin123!`
- Editor — `editor@example.com / Editor123!`
- Customers — `customer1@example.com`, `customer2@example.com` (`Customer123!`)
- Sample products, services, requests, messages, and a sent quote

### 4. Local development

```bash
vercel dev
```

Vercel will serve static assets from `/public` and compile the TypeScript API routes automatically. The app is then available at `http://localhost:3000`.

### 5. Deployment to Vercel

1. Push the repository to GitHub.
2. In Vercel, import the project from GitHub.
3. Add the `DATABASE_URL` and `JWT_SECRET` env vars in Project Settings ? Environment Variables (apply to Preview and Production).
4. Ensure the Neon database is accessible from Vercel (Neon works out of the box with `sslmode=require`).
5. After the first deploy, run the SQL migrations (same as step 3) against the production database.

## Key Workflows to Test

1. **Auth:** Sign up a new account, sign out, then sign back in. `/api/auth/me` should return the session.
2. **Digital purchase:** From a product detail page, click “Buy (Mock)” ? order is created, mock payment marks it paid, and the order appears in `account/order.html`.
3. **Service request:** Submit a new request. In `/admin/requests.html` create/send a quote, accept it as the customer, trigger the mock payment, upload deliverables, and confirm they appear in the customer account.
4. **Admin CRUD:** Create/edit/delete users, products, and services from their respective admin pages.
5. **Notifications:** Watch the bell indicator update after quotes, messages, or deliverables are created.

## Security & Performance Notes

- All SQL uses parameterized queries via `pg`.
- Passwords are hashed with bcrypt (`bcryptjs`).
- JWT cookies are `HttpOnly`, `Secure`, `SameSite=Lax`.
- Public GET endpoints set short cache headers; authenticated endpoints are not cached.
- Rate limiting applied to register/login to reduce brute-force attempts.

## Upgrading Mock Payments to Stripe (Later)

1. Replace `/api/payments-mock.ts` with a Stripe integration (Checkout Session or Payment Intents).
2. Store Stripe IDs alongside orders (add columns via a new migration).
3. Handle webhooks in a new serverless function to mark orders paid and advance service requests.
4. Add Stripe keys (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`) to environment variables.

## Scripts

- `npm run dev` — alias for `vercel dev`
- `npm run start` — same as `vercel dev`
- `npm run lint` — placeholder (no linter configured)

Feel free to extend scripts with formatting, linting, or test commands as you evolve the project.
