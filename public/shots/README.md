# Marketing screenshots

Rendered from the running app, not drawn. Regenerate them whenever the screens
they show change — a screenshot of a product that no longer looks like that is
worse than none, because it is a claim rather than a decoration.

```bash
npx tsx scripts/seed-demo.ts     # demo offers + a fixed session token
npm run dev                      # in another shell
npx tsx scripts/shots.ts         # writes app.png and app-mobile.png
```

The figures in these are a demo account. `seed-demo.ts` refuses to run with
NODE_ENV=production: it deletes every Offer row and creates a session token
that would be a standing back door on a live machine.

Two crops, on purpose: the desktop render is unreadable at phone width, so
small screens are served the app's own mobile layout instead. See
`src/components/marketing/product-shots.tsx`.
