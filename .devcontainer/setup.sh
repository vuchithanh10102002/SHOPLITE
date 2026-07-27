#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════
# postCreateCommand — chay MOT lan khi codespace duoc tao.
#
#   1. Sinh file .env (secret ngau nhien, CLIENT_URL lay dong tu ten codespace)
#   2. ./deploy.sh  → build image + migrate + up -d --wait
#   3. Seed du lieu demo neu DB con rong
#   4. Doi cong 8080 sang PUBLIC (thu bang gh; that bai thi in huong dan tay)
#
# Chay lai duoc nhieu lan: .env da co thi GIU NGUYEN (khong sinh secret moi —
# doi secret giua chung se lam moi refresh token dang song thanh vo dung), DB da
# co san pham thi khong seed de.
#
# Test rieng phan sinh .env o may khac (khong build gi):
#   REPO_DIR=/tmp/thu CODESPACE_NAME=abc-123 bash .devcontainer/setup.sh --env-only
# ═══════════════════════════════════════════════════════════════════════════
set -euo pipefail

REPO_DIR="${REPO_DIR:-$(cd "$(dirname "$0")/.." && pwd)}"
mkdir -p "$REPO_DIR"
cd "$REPO_DIR"

HTTP_PORT=8080          # PHAI khop forwardPorts trong devcontainer.json
ENV_ONLY=""
[ "${1:-}" = "--env-only" ] && ENV_ONLY=1

# ─── URL cong khai ──────────────────────────────────────────────────────────
# Trong codespace, hai bien nay do GitHub dat san. Ngoai codespace (chay thu tren
# may) thi ve localhost. KHONG hardcode: moi codespace mot ten khac nhau.
if [ -n "${CODESPACE_NAME:-}" ]; then
  CLIENT_URL="https://${CODESPACE_NAME}-${HTTP_PORT}.${GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN:-app.github.dev}"
else
  CLIENT_URL="http://localhost:${HTTP_PORT}"
fi

# ─── 1. Sinh .env ───────────────────────────────────────────────────────────
rand() { openssl rand -base64 48 | tr -d '\n=+/' | cut -c1-48; }

# Mat khau tai khoan demo. KHONG dung mac dinh trong seed.ts (`Webpx@2024`):
# demo nay mo cong khai ra Internet, dung lai mat khau ca nhan o day la sai
# nguyen tac du no da nam san trong repo public.
SEED_PASSWORD="${SEED_PASSWORD:-Demo@12345}"

if [ -f .env ]; then
  echo "▶ .env da co — giu nguyen (khong sinh secret moi)."
  # Nhung CLIENT_URL thi PHAI cap nhat: neu .env con lai tu codespace cu (rebuild
  # container van giu /workspaces) thi URL trong do tro ve mot codespace da chet.
  if grep -qE '^CLIENT_URL=' .env; then
    sed -i "s#^CLIENT_URL=.*#CLIENT_URL=${CLIENT_URL}#" .env
  else
    echo "CLIENT_URL=${CLIENT_URL}" >> .env
  fi
else
  echo "▶ Sinh .env moi cho ${CLIENT_URL}"
  cat > .env <<EOF
# File nay do .devcontainer/setup.sh sinh ra — KHONG commit (da co trong .gitignore).
POSTGRES_USER=shoplite
POSTGRES_PASSWORD=$(rand)
POSTGRES_DB=shoplite

HTTP_PORT=${HTTP_PORT}

# Hai secret PHAI khac nhau (xem .env.prod.example).
JWT_ACCESS_SECRET=$(rand)
JWT_REFRESH_SECRET=$(rand)
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

CLIENT_URL=${CLIENT_URL}

# Placeholder hop format (env.ts chan chuoi khong bat dau bang cloudinary://).
# Muon upload anh that: dat Codespaces secret CLOUDINARY_URL roi chay lai script.
CLOUDINARY_URL=${CLOUDINARY_URL:-cloudinary://x:y@demo}

# SMTP gia: worker se KHONG gui duoc email that. Voi ban demo thi khong sao —
# dung tai khoan seed (da verified san) de dang nhap. Muon lay link verify cua
# tai khoan moi dang ky, doc thang trong Redis:
#   docker exec shoplite-redis-prod redis-cli get bull:email:id
#   docker exec shoplite-redis-prod redis-cli hget bull:email:<id> data
SMTP_URL=${SMTP_URL:-smtp://user:pass@smtp.example.com:587}
SMTP_HOST=${SMTP_HOST:-smtp.example.com}
SMTP_PORT=${SMTP_PORT:-587}
SMTP_USER=${SMTP_USER:-user}
SMTP_PASS=${SMTP_PASS:-pass}
SMTP_FROM=ShopLite demo <no-reply@shoplite.dev>

# Demo: 0 = thanh toan gia lap LUON thanh cong. Mac dinh cua app la 0.2 (20% don
# bi tu choi) — dung o day thi khach vao xem se tuong site hong.
PAYMENT_FAIL_RATE=0

BCRYPT_COST=12
EOF
  chmod 600 .env
fi

if [ -n "$ENV_ONLY" ]; then
  echo "✓ --env-only: dung o day."
  exit 0
fi

# ─── 2. Build + migrate + up ────────────────────────────────────────────────
# deploy.sh da lam dung thu tu (ha tang → migrate → doi code) va co --wait.
echo "▶ Build + deploy (lan dau ~5-10 phut tren may 2 core)..."
./deploy.sh

# ─── 3. Seed du lieu demo ───────────────────────────────────────────────────
PG_USER=$(grep -E '^POSTGRES_USER=' .env | tail -1 | cut -d= -f2- | tr -d '"\r')
PG_DB=$(grep -E '^POSTGRES_DB=' .env | tail -1 | cut -d= -f2- | tr -d '"\r')

COUNT=$(docker exec shoplite-postgres-prod \
          psql -U "$PG_USER" -d "$PG_DB" -tAc "select count(*) from products" 2>/dev/null || echo 0)
COUNT=$(echo "$COUNT" | tr -dc '0-9')

if [ "${COUNT:-0}" = "0" ]; then
  echo "▶ DB rong → seed du lieu demo..."
  # Service `migrate` dung stage `migrator` (co prisma CLI + tsx) nen chay duoc
  # seed; image `api` co y khong mang CLI theo.
  # `-e SEED_PASSWORD`: service migrate khong co env_file nen phai truyen tay.
  docker compose -f docker-compose.prod.yml run --rm \
    -e SEED_PASSWORD="$SEED_PASSWORD" migrate npx prisma db seed
else
  echo "▶ DB da co $COUNT san pham — bo qua seed."
fi

# ─── 4. Mo cong ra ngoai ────────────────────────────────────────────────────
# Mac dinh cong forward la PRIVATE: nguoi khac mo link se thay man hinh dang
# nhap GitHub. `gh codespace ports visibility` can token co scope `codespace`,
# ma token mac dinh trong codespace THUONG KHONG co → chuan bi san duong tay.
PUBLIC_OK=""
if [ -n "${CODESPACE_NAME:-}" ] && command -v gh >/dev/null 2>&1; then
  if gh codespace ports visibility "${HTTP_PORT}:public" -c "$CODESPACE_NAME" >/dev/null 2>&1; then
    PUBLIC_OK=1
  fi
fi

echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "  ShopLite demo:  ${CLIENT_URL}"
echo ""
echo "  Tai khoan seed (mat khau: ${SEED_PASSWORD})"
echo "    admin@shoplite.dev        — ADMIN, vao duoc /admin"
echo "    cong@webpx.vn             — khach da verify, dat hang duoc"
echo "    hanh.unverified@gmail.com — khach CHUA verify (thu BR4: 403)"
echo ""
if [ -n "$PUBLIC_OK" ]; then
  echo "  ✓ Cong ${HTTP_PORT} da chuyen sang PUBLIC."
else
  echo "  ⚠ CHUA mo cong ra ngoai. Nguoi khac mo link se thay man hinh dang"
  echo "    nhap GitHub. Bat tay: tab PORTS → chuot phai dong ${HTTP_PORT} →"
  echo "    Port Visibility → Public.  (Hoac tren may minh:"
  echo "    gh codespace ports visibility ${HTTP_PORT}:public -c ${CODESPACE_NAME:-<ten>})"
fi
echo "═══════════════════════════════════════════════════════════════"
