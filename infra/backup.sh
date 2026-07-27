#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════
# Backup DB hang dem (Roadmap 8.1 buoc 4). Chay bang user `deploy` qua cron:
#
#   0 2 * * * /home/deploy/shoplite/infra/backup.sh >> /var/log/shoplite-backup.log 2>&1
#
# Doc mat khau/ten DB tu chinh file .env cua stack — khong chep lai o day.
# ═══════════════════════════════════════════════════════════════════════════
set -euo pipefail

REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"
BACKUP_DIR="${BACKUP_DIR:-$HOME/backups}"
KEEP_DAYS="${KEEP_DAYS:-30}"
CONTAINER="shoplite-postgres-prod"

cd "$REPO_DIR"
[ -f .env ] || { echo "✗ Khong thay $REPO_DIR/.env"; exit 1; }

# Doc dung hai bien can, thay vi `source .env` (file do con chua JWT secret,
# creds Cloudinary/SMTP — khong can nap het vao moi truong cua script cron).
PG_USER=$(grep -E '^POSTGRES_USER=' .env | tail -1 | cut -d= -f2- | tr -d '"\r')
PG_DB=$(grep -E '^POSTGRES_DB=' .env | tail -1 | cut -d= -f2- | tr -d '"\r')
: "${PG_USER:?thieu POSTGRES_USER trong .env}"
: "${PG_DB:?thieu POSTGRES_DB trong .env}"

mkdir -p "$BACKUP_DIR"
STAMP=$(date +%Y%m%d_%H%M%S)
OUT="$BACKUP_DIR/shoplite_$STAMP.sql.gz"

echo "[$(date -Is)] ▶ dump $PG_DB → $OUT"

# ═══ Ghi ra file TAM roi moi doi ten ═══
# Cron bi giet giua chung (may reboot, het dia) se de lai mot file .sql.gz cut
# ngang MA VAN dung ten that — den luc can khoi phuc moi biet no hong. Doi ten
# la thao tac nguyen tu: chi file HOAN CHINH moi mang ten that.
TMP="$OUT.partial"

# pipefail (set -o) o tren lam ca pipe hong neu pg_dump hong — khong co no thi
# gzip van "thanh cong" tren dong du lieu rong va script bao xanh.
docker exec "$CONTAINER" pg_dump -U "$PG_USER" -d "$PG_DB" | gzip > "$TMP"

# Dump rong/qua nho (< 1KB) gan nhu chac chan la hong: DB that co 24 san pham.
SIZE=$(stat -c%s "$TMP")
if [ "$SIZE" -lt 1024 ]; then
  echo "✗ Dump chi $SIZE byte — coi nhu that bai, giu lai de xem: $TMP"
  exit 1
fi

mv "$TMP" "$OUT"
echo "[$(date -Is)] ✓ $(du -h "$OUT" | cut -f1)"

# Don ban cu. Dat SAU khi dump thanh cong: neu dump hong thi `set -e` da thoat
# tu tren, va ban cu VAN CON — khong bao gio xoa cai cu truoc khi co cai moi.
find "$BACKUP_DIR" -name 'shoplite_*.sql.gz' -mtime "+$KEEP_DAYS" -delete
echo "  con lai: $(ls -1 "$BACKUP_DIR"/shoplite_*.sql.gz 2>/dev/null | wc -l) ban"

# Muon day len cloud thi bo comment dong duoi (can `rclone config` truoc):
# rclone copy "$OUT" gdrive:shoplite-backup/
#
# ═══ Backup chua duoc THU KHOI PHUC thi chua phai backup ═══
# Mot lan moi thang, chay thu tren may khac (KHONG phai DB dang chay):
#   gunzip -c shoplite_XXXX.sql.gz | docker exec -i <container-test> psql -U <user> -d shoplite_restore_test
