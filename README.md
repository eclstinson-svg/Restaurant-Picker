# Where Should We Eat?

A random restaurant picker for date night. Pick a starting point, radius,
cuisine, and price range, and it chooses a restaurant using Google Maps data.

## Running it on your computer

1. Open a terminal in this folder.
2. `npm install` (only needed the first time, or after pulling new changes)
3. `npm run dev`
4. Open http://localhost:3000

Without a Google API key the app uses sample restaurants. To use real data,
put your key in `.env.local` (see `.env.example`) and restart `npm run dev`.

## Accounts & shared history (Supabase)

1. In Supabase → SQL Editor, run `supabase/schema.sql` once.
2. In Supabase → Authentication → Emails, add `{{ .Token }}` to the
   "Magic link" and "Confirm signup" templates so emails include a sign-in code.
3. Add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
   to `.env.local` and to Vercel's environment variables, then redeploy.

Without these the app still works, just without sign-in and history.

## Where things live

- `src/app/page.tsx` – the main page
- `src/components/Picker.tsx` – the filter form and spin/re-roll logic
- `src/components/ResultCard.tsx` – the restaurant card
- `src/app/api/*` – server endpoints the page calls (search, details, photos, geocoding)
- `src/lib/google.ts` – all calls to Google (server only, keeps the key secret)
- `src/lib/mock.ts` – sample restaurants for testing without a key
- `src/lib/cuisines.ts` – the cuisine list
- `src/lib/db.ts` – all database reads/writes (couples, visits, ratings, wishlist)
- `src/components/AccountProvider.tsx` – who's signed in and which couple they're in
- `src/components/History.tsx`, `Wishlist.tsx` – the "Been there" and "Want to try" tabs
- `supabase/schema.sql` – database tables and security rules
