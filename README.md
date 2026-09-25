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

## Where things live

- `src/app/page.tsx` – the main page
- `src/components/Picker.tsx` – the filter form and spin/re-roll logic
- `src/components/ResultCard.tsx` – the restaurant card
- `src/app/api/*` – server endpoints the page calls (search, details, photos, geocoding)
- `src/lib/google.ts` – all calls to Google (server only, keeps the key secret)
- `src/lib/mock.ts` – sample restaurants for testing without a key
- `src/lib/cuisines.ts` – the cuisine list
