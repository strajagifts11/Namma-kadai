# ST Raja Gifts — Premium Gold & Cream Store

Responsive premium storefront plus private admin catalogue and order dashboard.

## Features
- Customer storefront with categories, product photos, prices, basket and WhatsApp order request.
- Admin sign-in, add/edit products, change price, show/hide products, photo upload and order status updates.
- Supabase database row-level security separates customer catalogue access from private customer order details.
- Brand social links and WhatsApp number are configured for ST Raja Gifts.

## Connect the backend before going live
1. Create a project at https://supabase.com/dashboard.
2. In **SQL Editor → New query**, paste and run all of `supabase-schema.sql`.
3. In Supabase **Project Settings → API** (or **Connect**), copy the Project URL and public anon/publishable key. Never use a `service_role` or secret key in browser files.
4. Replace `PASTE_YOUR_SUPABASE_PROJECT_URL` and `PASTE_YOUR_SUPABASE_ANON_OR_PUBLISHABLE_KEY` in both `app.js` and `admin.js` with those public values.
5. Create your login in **Authentication → Users → Add user**. Copy that user's UUID.
6. In SQL Editor run `insert into public.admin_users(user_id) values ('PASTE-REAL-USER-UUID-HERE');` using the actual UUID. Only registered UUIDs can manage products and see orders.
7. Upload the six website files (`index.html`, `app.js`, `admin.html`, `admin.js`, `supabase-schema.sql`, `README.md`) to your GitHub repository root. If your repository supports static assets, the CSS is included inline.
8. GitHub repository → **Settings → Pages → Deploy from a branch → main → /(root) → Save**.
9. Storefront: `https://YOUR-USERNAME.github.io/REPOSITORY/` ; Admin: `https://YOUR-USERNAME.github.io/REPOSITORY/admin.html`.
10. Sign into admin, upload a photo (JPG/PNG/WebP under 5 MB), add name/category/price/description and save.

## Demo vs live
The starter catalogue contains example product names and images. Replace them with your actual products and prices. Without the Supabase project and keys, backend sign-in, shared product edits, photo uploads and order dashboard cannot work.

## Order and privacy notes
WhatsApp checkout/order request does not process online payments. Confirm stock, final price, delivery charges and payment with the customer. Add a privacy notice before launch. Never share admin passwords, database passwords, or secret/service-role keys.
