## Worship Together

A modern, sacred space for choirs and worship leaders.

### Getting Started

First, ensure you have your environment variables set in `.env.local`. Then, run the development server:

```bash
npm run dev
```

Open [http://localhost:4000](http://localhost:4000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Mobile App

This project is configured as both an installable PWA and a Capacitor Android shell.

### PWA

The app exposes `/manifest.webmanifest` and icons under `/public/icons`. After deploying over HTTPS, open the site on a mobile browser and use the browser's install or "Add to Home Screen" action.

The service worker is registered in production builds. For local service worker testing, run the app with:

```bash
$env:NEXT_PUBLIC_ENABLE_SERVICE_WORKER="true"
npm run dev
```

Offline navigation falls back to `/offline.html`; live sync, library writes, and Supabase-backed data still require a network connection.

### Android

Capacitor is set up in `capacitor.config.ts`. Because this app uses Next.js server features, the Android shell should point at a running or deployed Next.js URL through `CAPACITOR_SERVER_URL`.

For a deployed app:

```bash
$env:CAPACITOR_SERVER_URL="https://your-deployed-site.com"
npm run mobile:sync
npm run mobile:open:android
```

For the Android emulator while `npm run dev` is running on this machine:

```bash
npm run mobile:run:emulator
```

For a physical Android device, use the computer's LAN IP instead of `10.0.2.2`.
