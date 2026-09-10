#!/usr/bin/env bash
#
# Deploy the current branch to this machine. Run it ON the VPS, from the app
# directory:
#
#   cd /var/www/requit && ./deploy/deploy.sh
#
# Ordering matters and is not arbitrary:
#   migrate BEFORE build, so the build sees the schema it will run against
#   build BEFORE reload, so a failed build never takes the running site down
#   reload, not restart, so requests in flight are finished rather than dropped
set -Eeuo pipefail

APP_DIR="${APP_DIR:-/var/www/requit}"
# Override for a branch that is not yet merged:
#   BRANCH=claude/new-session-jwxsku ./deploy/deploy.sh
BRANCH="${BRANCH:-main}"

cd "$APP_DIR"

# Load .env into this shell so every command below has it — prisma, the build,
# and anything added later. Relying on prisma.config.ts to load it worked only
# for Prisma, and only as long as that import stayed there.
if [ ! -f .env ]; then
  echo "    No .env in $APP_DIR. Copy .env.example and fill it in first." >&2
  exit 1
fi

set -a
# shellcheck disable=SC1091
. ./.env
set +a

for required in DATABASE_URL REDIS_URL AUTH_SECRET AUTH_URL; do
  if [ -z "${!required:-}" ]; then
    echo "    $required is empty in .env. Fill it in before deploying." >&2
    exit 1
  fi
done

echo "==> Refusing to deploy with uncommitted changes"
if ! git diff --quiet || ! git diff --cached --quiet; then
  echo "    Working tree is dirty. Commit or stash on the server first." >&2
  exit 1
fi

echo "==> Fetching $BRANCH"
git fetch origin "$BRANCH"
git checkout "$BRANCH"
git reset --hard "origin/$BRANCH"

echo "==> Installing exactly what the lockfile says"
# `npm ci`, not `npm install`: a deploy must never resolve a different tree than
# the one that was tested. postinstall runs prisma generate.
#
# devDependencies are installed on purpose. The build needs them — typescript,
# tailwind, the Next plugin — and we build on the server rather than shipping a
# prebuilt tree. Do not add --omit=dev here; the build will fail.
npm ci

echo "==> Applying migrations"
# `migrate deploy` only applies committed migrations. It never generates one and
# never resets, so it cannot destroy data on a bad schema edit.
npx prisma migrate deploy

echo "==> Building"
npm run build

echo "==> Reloading"
mkdir -p /var/log/requit
if pm2 describe requit-web >/dev/null 2>&1; then
  pm2 reload deploy/ecosystem.config.cjs --update-env
else
  pm2 start deploy/ecosystem.config.cjs
  pm2 save
fi

echo "==> Waiting for health"
for attempt in $(seq 1 20); do
  if curl -fsS --max-time 3 http://127.0.0.1:3000/api/health >/dev/null 2>&1; then
    echo "    healthy after ${attempt}s"
    curl -sS http://127.0.0.1:3000/api/health
    echo
    exit 0
  fi
  sleep 1
done

echo "    NOT healthy after 20s — check: pm2 logs requit-web --lines 50" >&2
exit 1
