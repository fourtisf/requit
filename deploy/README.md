# Deploying to the VPS

Target: `requit.xyz` → `31.97.57.242`, Ubuntu, Nginx, PM2 — the pattern
HANDOFF.md §1 specifies.

> **Read this first: country detection does not work yet.**
> `src/lib/country.ts` reads the `cf-ipcountry` header, which only exists when
> Cloudflare is in front of the site. DNS is currently at Hostinger pointing
> straight at the box, so every signup will record country `XX` — and offers are
> matched by country, so nobody will be eligible for anything. Fix it with
> **Step 6** before Phase 1 goes live. It is free and takes ten minutes.

---

## 1. Packages

```bash
sudo apt update && sudo apt install -y curl git nginx postgresql-16 redis-server

# Node 22
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs
sudo npm install -g pm2
```

## 2. Postgres and Redis

```bash
sudo -u postgres psql -c "CREATE USER requit WITH PASSWORD 'CHANGE-ME';"
sudo -u postgres psql -c "CREATE DATABASE requit OWNER requit;"
```

Redis must not evict — BullMQ jobs are postbacks and payouts, and a queue whose
jobs can be dropped loses money silently:

```bash
sudo sed -i 's/^# *maxmemory-policy .*/maxmemory-policy noeviction/' /etc/redis/redis.conf
sudo systemctl restart redis-server
```

Neither service should be reachable from the internet. Check with
`sudo ss -lntp` that both bind to `127.0.0.1` only.

## 3. The app

```bash
sudo mkdir -p /var/www/requit /var/log/requit
sudo chown -R "$USER" /var/www/requit /var/log/requit

git clone https://github.com/fourtisf/requit.git /var/www/requit
cd /var/www/requit
cp .env.example .env
```

Fill in `.env`. The four that must be right on the first boot:

```bash
DATABASE_URL="postgresql://requit:CHANGE-ME@localhost:5432/requit?schema=public"
REDIS_URL="redis://localhost:6379"
AUTH_SECRET="$(openssl rand -base64 32)"
AUTH_URL="https://requit.xyz"
NEXT_PUBLIC_APP_URL="https://requit.xyz"
```

`serverEnv()` refuses to boot in production without `AUTH_URL`, so a half-filled
`.env` fails loudly at start rather than quietly on the first sign-in.

`EMAIL_SERVER` may be left empty to get the site up. The app boots, the public
pages work, and `/signin` states that sign-in is unavailable rather than handing
out a code that never arrives. Nothing can sign in until it is set — including
you.

Lock the file down — it holds the database password and the app secret:

```bash
chmod 600 .env
```

## 4. First deploy

```bash
./deploy/deploy.sh
```

It refuses to run on a dirty tree, applies migrations before building, builds
before reloading, and then polls `/api/health` — so a broken build never
replaces a working site.

```bash
pm2 startup   # then run the line it prints, so PM2 survives a reboot
pm2 save
```

## 5a. If the box already runs Caddy (or anything else on :80/:443)

Check before installing nginx:

```bash
ss -lntp | grep -E ':80 |:443 '
```

If something already owns those ports, **do not stop it and do not remove it**
— it is serving live traffic. Two web servers cannot share a port, and the one
that got there first is not the one that moves. Add Requit to the existing
server instead:

```bash
cp /etc/caddy/Caddyfile /etc/caddy/Caddyfile.bak
cat deploy/Caddyfile.snippet >> /etc/caddy/Caddyfile
caddy validate --config /etc/caddy/Caddyfile
systemctl reload caddy
```

**Back the file up first.** It also serves whatever else is on the box, so a
failed reload takes that down too. If the reload fails:

```bash
journalctl -xeu caddy.service --no-pager | tail -30
cp /etc/caddy/Caddyfile.bak /etc/caddy/Caddyfile
systemctl reload caddy || systemctl restart caddy
```

`caddy validate` is not proof the reload will work. It runs as root; the
service runs as the `caddy` user. Anything that user cannot open — a log path
under a directory that does not exist, a certificate directory it cannot
write — passes validation and then fails at reload.

Caddy issues and renews the certificate itself — skip certbot entirely. Then
skip to step 7.

## 5b. Nginx and TLS

```bash
sudo cp deploy/nginx.conf /etc/nginx/sites-available/requit
sudo ln -sf /etc/nginx/sites-available/requit /etc/nginx/sites-enabled/requit
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx

sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d requit.xyz -d www.requit.xyz
```

## 6. Cloudflare — required before Phase 1

Without this, `cf-ipcountry` never arrives and every member is country `XX`.

1. Add `requit.xyz` to Cloudflare (free plan).
2. At Hostinger, change the nameservers to the two Cloudflare gives you.
3. In Cloudflare DNS, keep `A @ → 31.97.57.242` and `CNAME www → requit.xyz`,
   both **Proxied** (orange cloud). The orange cloud is what adds the header.
4. SSL/TLS mode **Full (strict)** — certbot already issued a real certificate.
5. On the box, restore the visitor IP, or Nginx will see Cloudflare's edge as
   every visitor and the rate limiter will bucket the whole world together:

```bash
( for t in v4 v6; do curl -s "https://www.cloudflare.com/ips-$t"; echo; done ) \
  | sed 's/^/set_real_ip_from /; s/$/;/' | sudo tee /etc/nginx/cloudflare-ips.conf
```

Then uncomment the two `real_ip` lines in `deploy/nginx.conf` and reload.

Verify:

```bash
curl -sI https://requit.xyz | grep -i cf-ray     # present = proxied
```

## 7. Firewall

```bash
sudo ufw allow OpenSSH && sudo ufw allow 'Nginx Full' && sudo ufw enable
```

Once Cloudflare is proxying, restrict 80/443 to Cloudflare's ranges as well —
otherwise the origin IP is still directly reachable and the proxy is bypassable.

---

## If port 3000 is taken

`EADDRINUSE: address already in use :::3000` in `web.error.log` means another
service on the box owns the port. Next cannot bind, PM2 restarts it forever,
and — before the health check learned to identify itself — the probe would go
green against whatever else was answering.

Give Requit its own port. Edit the INSTALLED nginx config, not the one in the
repo: `deploy.sh` refuses to run with a dirty working tree.

```bash
cd /var/www/requit
echo 'PORT="3001"' >> .env

sed -i 's|127.0.0.1:[0-9]*;|127.0.0.1:3001;|' /etc/nginx/sites-available/requit
nginx -t && systemctl reload nginx

pm2 delete requit-web requit-worker
./deploy/deploy.sh
```

`deploy.sh` warns if the installed nginx upstream and `PORT` disagree.

## Later deploys

```bash
cd /var/www/requit && ./deploy/deploy.sh
```

## Checks

```bash
curl -s https://requit.xyz/api/health     # {"status":"ok",...}
pm2 status
pm2 logs requit-web --lines 50
pm2 logs requit-worker --lines 50
```

## Not covered here, on purpose

- **Backups.** Nothing in this repo backs up Postgres, and from Phase 1 that
  database *is* the record of what members are owed. Set up `pg_dump` to
  off-box storage before real money moves.
- **The hot wallet passphrase** (§6.3) is supplied out of band at process start.
  It must not be in `.env`, in `ecosystem.config.cjs`, or in this script.
- **The postback endpoint needs this stable IP** (§4.2). Register
  `https://requit.xyz/api/postback/<network>` in each network's dashboard, and
  put their published IPs in the `*_POSTBACK_IPS` variables.
