#!/usr/bin/env bash
# Deploy stack production (Roadmap 7.1 buoc 3). Chay tren VPS, o thu muc repo.
#
#   ./deploy.sh          build lai tu source trong repo (mac dinh)
#   ./deploy.sh --pull   keo image da build san tu registry (dung o Phase 8 khi
#                        CI da push len ghcr.io)
#
# set -e   dung ngay khi mot lenh that bai — KHONG duoc di tiep sau khi migrate
#          hong, vi `up -d` se dua code moi len schema cu.
# set -u   goi bien chua dat = loi, thay vi lang le thanh chuoi rong.
# pipefail lenh trong pipe hong thi ca pipe hong.
set -euo pipefail

cd "$(dirname "$0")"

COMPOSE="docker compose -f docker-compose.prod.yml"

if [ ! -f .env ]; then
  echo "✗ Thieu file .env. Chay: cp .env.prod.example .env roi dien gia tri that."
  exit 1
fi

# ─── 1. Lay code/image moi ──────────────────────────────────────────────────
if [ "${1:-}" = "--pull" ]; then
  echo "▶ Keo image tu registry..."
  $COMPOSE pull
else
  echo "▶ Build image tu source..."
  $COMPOSE build
fi

# ─── 2. Ha tang len TRUOC ───────────────────────────────────────────────────
# Migrate can DB dang chay. `up -d postgres redis` chi bat hai service do; co
# `--wait` nen lenh chi tra ve khi healthcheck xanh — khong phai `sleep 10`.
echo "▶ Bat postgres + redis..."
$COMPOSE up -d --wait postgres redis

# ─── 3. Migrate TRUOC khi doi code ──────────────────────────────────────────
# Thu tu nay quan trong: migrate xong roi moi thay code. Nguoc lai (code moi len
# truoc) thi trong vai giay code moi doc schema cu → 500 hang loat.
#
# Dung service `migrate` (stage migrator, co prisma CLI) chu KHONG phai
# `run --rm api npx prisma migrate deploy` nhu Roadmap viet — image api co y
# khong mang prisma CLI. `--rm` de container one-off khong dong lai.
echo "▶ Chay migration..."
$COMPOSE run --rm migrate

# ─── 4. Doi code ────────────────────────────────────────────────────────────
echo "▶ Bat toan bo stack..."
$COMPOSE up -d --wait

# ─── 5. Don image cu ────────────────────────────────────────────────────────
# Moi lan build de lai image khong con tag (<none>) — vai lan deploy la day dia
# VPS 20GB. `-f` de khong hoi xac nhan (script chay trong CI/cron khong ai tra loi).
echo "▶ Don image cu..."
docker image prune -f

echo ""
$COMPOSE ps
echo ""
# HTTP_PORT nam trong file .env — compose tu doc file do, con SHELL NAY thi khong.
# Khong doc ra day thi dong huong dan ben duoi luon in "localhost:80" trong khi
# stack dang o 8080 (da bi in sai mot lan). `grep` mot dong thay vi `source .env`:
# file do chua mat khau/secret, khong can nap het vao moi truong cua script.
PORT_HINT=$(grep -E '^HTTP_PORT=' .env | tail -1 | cut -d= -f2 | tr -d '"\r')
echo "✓ Deploy xong. Kiem tra: curl -s localhost:${PORT_HINT:-80}/health/ready"
