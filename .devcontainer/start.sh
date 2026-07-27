#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════
# postStartCommand — chay MOI lan codespace ngu day (sau ~30 phut khong dung).
#
# Chi bat lai container, KHONG build lai gi: image + volume nam trong dia cua
# codespace nen con nguyen qua giac ngu. Neu chua tung setup thi nhuong cho
# setup.sh (postCreateCommand) lam.
# ═══════════════════════════════════════════════════════════════════════════
set -euo pipefail

cd "$(cd "$(dirname "$0")/.." && pwd)"

if [ ! -f .env ]; then
  echo "▶ Chua co .env — bo qua (setup.sh se lo)."
  exit 0
fi

HTTP_PORT=$(grep -E '^HTTP_PORT=' .env | tail -1 | cut -d= -f2 | tr -d '"\r')
HTTP_PORT="${HTTP_PORT:-8080}"

# URL codespace co the doi (rebuild container). Cap nhat lai truoc khi bat api —
# CLIENT_URL sai thi link trong email verify/reset tro ve mot dia chi da chet.
if [ -n "${CODESPACE_NAME:-}" ]; then
  CLIENT_URL="https://${CODESPACE_NAME}-${HTTP_PORT}.${GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN:-app.github.dev}"
  sed -i "s#^CLIENT_URL=.*#CLIENT_URL=${CLIENT_URL}#" .env
else
  CLIENT_URL="http://localhost:${HTTP_PORT}"
fi

echo "▶ Bat lai stack..."
docker compose -f docker-compose.prod.yml up -d --wait

# Kiem THAT: /health (song chua) khong du — da dinh mot lan container bao healthy
# trong khi no dang noi chuyen voi DB sai. Chi /health/ready tham DB + Redis.
if curl -fsS -m 15 "http://localhost:${HTTP_PORT}/health/ready" | grep -q '"ok":true'; then
  echo "✓ San sang: ${CLIENT_URL}"
else
  echo "✗ /health/ready KHONG xanh. Xem log:"
  echo "    docker compose -f docker-compose.prod.yml logs --tail=50 api"
  exit 1
fi
