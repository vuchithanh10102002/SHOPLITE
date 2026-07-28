#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════
# DIEN TAP KHOI PHUC (Roadmap 8.1 buoc 4 — "khong dien tap = khong co backup").
#
#   ./infra/restore-test.sh                  # lay ban dump moi nhat
#   ./infra/restore-test.sh duong/dan.sql.gz # chi dinh ban nao
#   ./infra/restore-test.sh --keep           # giu lai DB test de soi tay
#
# Khoi phuc vao MOT DB RIENG trong container Postgres cua DEV — co y KHONG dung
# container prod: dump phai chung minh no doc duoc o mot may khac, va thao tac
# nay khong duoc phep cham vao DB dang phuc vu.
#
# Ba diem lam cho dien tap nay co gia tri (thieu mot cai la dien tap gia):
#   1. ON_ERROR_STOP=1 — mac dinh psql GAP LOI VAN CHAY TIEP roi thoat ma 0.
#      Khong co co nay thi mot ban dump cut ngang van "restore thanh cong".
#   2. So SANH voi ban goc — restore khong loi chua chung minh du lieu dung.
#      Doi chieu ca so dong LAN van tay MD5 cua noi dung.
#   3. Xoa DB test o cuoi — de lai thi lan sau khong biet dang nhin ban nao.
# ═══════════════════════════════════════════════════════════════════════════
set -euo pipefail

REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_DIR"

BACKUP_DIR="${BACKUP_DIR:-$HOME/backups}"
SRC_CONTAINER="shoplite-postgres-prod"   # noi du lieu that dang chay
DST_CONTAINER="${DST_CONTAINER:-shoplite-postgres}"  # container dev
TEST_DB="shoplite_restore_test"
KEEP=""
DUMP=""

for arg in "$@"; do
  case "$arg" in
    --keep) KEEP=1 ;;
    *)      DUMP="$arg" ;;
  esac
done

[ -f .env ] || { echo "✗ Khong thay $REPO_DIR/.env"; exit 1; }
PG_USER=$(grep -E '^POSTGRES_USER=' .env | tail -1 | cut -d= -f2- | tr -d '"\r')
PG_DB=$(grep -E '^POSTGRES_DB=' .env | tail -1 | cut -d= -f2- | tr -d '"\r')

# Ban moi nhat neu khong chi dinh.
if [ -z "$DUMP" ]; then
  DUMP=$(ls -1t "$BACKUP_DIR"/shoplite_*.sql.gz 2>/dev/null | head -1 || true)
fi
[ -n "$DUMP" ] && [ -f "$DUMP" ] || {
  echo "✗ Khong tim thay ban dump nao trong $BACKUP_DIR (chay infra/backup.sh truoc)"; exit 1; }

echo "▶ Dien tap khoi phuc: $(basename "$DUMP")  →  $DST_CONTAINER/$TEST_DB"

# ─── 1. DB dich sach ────────────────────────────────────────────────────────
# Role owner phai ton tai TRUOC: dump co san `ALTER ... OWNER TO <user>`, thieu role
# thi ON_ERROR_STOP=1 dung ngay — dung y do, nhung do la thieu sot cua may dich chu
# khong phai cua ban backup.
docker exec "$DST_CONTAINER" psql -U postgres -q -c "DROP DATABASE IF EXISTS $TEST_DB;" >/dev/null
docker exec "$DST_CONTAINER" psql -U postgres -q -c \
  "DO \$\$ BEGIN IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='$PG_USER') THEN CREATE ROLE $PG_USER LOGIN; END IF; END \$\$;" >/dev/null
docker exec "$DST_CONTAINER" psql -U postgres -q -c "CREATE DATABASE $TEST_DB OWNER $PG_USER;" >/dev/null

# ─── 2. Khoi phuc ───────────────────────────────────────────────────────────
# `if !` chu khong de `set -e` tu giet: chet ngang thi khong ai in ket luan, nguoi
# doc log chi thay mot dong ERROR cua psql roi tu suy dien (da bi mot lan).
if ! gunzip -c "$DUMP" | docker exec -i "$DST_CONTAINER" \
       psql -U postgres -d "$TEST_DB" -v ON_ERROR_STOP=1 -q >/dev/null; then
  echo "✗ DIEN TAP THAT BAI: khong restore noi ban nay (dump hong hoac cat ngang)."
  echo "  DB $TEST_DB duoc GIU LAI de soi. Xoa tay:"
  echo "    docker exec $DST_CONTAINER psql -U postgres -c 'DROP DATABASE $TEST_DB;'"
  exit 1
fi
echo "  ✓ restore khong loi"

# ─── 3. Doi chieu voi ban goc ───────────────────────────────────────────────
COUNTS="select 'users',count(*) from users
  union all select 'products',count(*) from products
  union all select 'categories',count(*) from categories
  union all select 'orders',count(*) from orders
  union all select 'order_items',count(*) from order_items
  union all select 'payments',count(*) from payments order by 1"

# Van tay noi dung: so dong khop van co the sai gia/sai hash mat khau.
FINGER="select coalesce(sum(total_amount),0)::text
  ||' | '||coalesce((select md5(string_agg(slug||price::text,',' order by slug)) from products),'-')
  ||' | '||coalesce((select md5(string_agg(email||password_hash,',' order by email)) from users),'-')
  from orders"

SRC_COUNTS=$(docker exec "$SRC_CONTAINER" psql -U "$PG_USER" -d "$PG_DB" -tAF'|' -c "$COUNTS")
DST_COUNTS=$(docker exec "$DST_CONTAINER" psql -U postgres -d "$TEST_DB" -tAF'|' -c "$COUNTS")
SRC_FINGER=$(docker exec "$SRC_CONTAINER" psql -U "$PG_USER" -d "$PG_DB" -tAc "$FINGER")
DST_FINGER=$(docker exec "$DST_CONTAINER" psql -U postgres -d "$TEST_DB" -tAc "$FINGER")

echo "  --- so dong (goc | khoi phuc) ---"
paste -d' ' <(echo "$SRC_COUNTS") <(echo "$DST_COUNTS") | sed 's/^/    /'

FAIL=""
[ "$SRC_COUNTS" = "$DST_COUNTS" ] || { echo "  ✗ SO DONG LECH"; FAIL=1; }
[ "$SRC_FINGER" = "$DST_FINGER" ] || {
  echo "  ✗ VAN TAY LECH"; echo "    goc: $SRC_FINGER"; echo "    khp: $DST_FINGER"; FAIL=1; }

# ─── 4. Don ──────────────────────────────────────────────────────────────────
if [ -z "$KEEP" ]; then
  docker exec "$DST_CONTAINER" psql -U postgres -q -c "DROP DATABASE IF EXISTS $TEST_DB;" >/dev/null
else
  echo "  (giu lai $TEST_DB theo --keep)"
fi

if [ -n "$FAIL" ]; then
  echo "✗ DIEN TAP THAT BAI — ban backup nay KHONG dung duoc."
  exit 1
fi
echo "✓ Dien tap dat: khoi phuc duoc, so dong va van tay noi dung khop ban goc."
