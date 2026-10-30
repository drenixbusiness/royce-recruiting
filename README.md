# Royce Recruiting board

Live recruiting board for the office TV (`/tv`) with a PIN-locked admin panel (`/admin`). Demo PIN: `2468`.

## Run on your own computer or server

```bash
npm install
npm run build
npm start
```

Data, truck photos and driver documents are saved in `./data`. Open `http://<this-computer's-IP>:3000/tv` on the TV.
Back up the `data` folder; it is not in git.

## Deploy on Vercel

Vercel has no permanent disk, so the board needs a Redis database there:

1. Vercel → your project → **Storage** → **Create / Connect** → **Upstash for Redis** (the free plan is enough to start).
2. Connect it to this project for **Production** (and Preview if you use it). Vercel adds `KV_REST_API_URL` and `KV_REST_API_TOKEN` for you.
3. **Deployments** → latest → **Redeploy**.

Until a database is connected, every page shows “Database not connected” instead of failing.

On Vercel, screens check for changes every 3 seconds (`SYNC_POLL_MS` to change it). Each open TV makes about
860,000 small requests a month at that rate. That is within the Vercel Hobby request allowance for one TV, but above Upstash's
free command allowance (pay-as-you-go costs roughly $2 a month for one TV). Running on your own server instead updates instantly at no cost.
