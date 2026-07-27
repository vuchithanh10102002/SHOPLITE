#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════
# Dung mot lan tren may VPS moi tinh (Roadmap 8.1 buoc 1).
# Chay bang root, ngay sau khi ssh vao lan dau:
#
#   scp infra/vps-setup.sh <user>@<ip>:/tmp/
#   ssh <user>@<ip> 'sudo bash /tmp/vps-setup.sh "<noi-dung-public-key-cua-ban>"'
#
# Script IDEMPOTENT — chay lai lan hai khong hong gi, de con sua roi chay lai.
#
# ═══ CHUA TUNG CHAY THAT — DUNG TUONG DAY LA DO DA KIEM CHUNG ═══
# Trang thai (27/07/2026): moi `bash -n` sach, chua co may nao chay qua.
# Huong VPS da BO giua chung vi khong dang ky duoc provider nao (Oracle Cloud
# Always Free, Railway, Fly.io deu bat xac minh the tin dung) → Phase 8 chuyen
# sang demo bang GitHub Codespaces (xem .devcontainer/ + README).
#
# Giu file lai vi noi dung van dung va la tai lieu hoc van hanh; ngay nao co VPS
# that thi chay — nhung LAN DAU chay phai coi la lan thu nghiem: doc lai tung
# khoi, va nho rang doi PasswordAuthentication=no ma chua kiem key vao duoc la
# cach tu khoa minh ra khoi may nhanh nhat.
# ═══════════════════════════════════════════════════════════════════════════
set -euo pipefail

PUBKEY="${1:-}"
DEPLOY_USER="deploy"

if [ "$(id -u)" -ne 0 ]; then
  echo "✗ Phai chay bang root (sudo)."
  exit 1
fi
if [ -z "$PUBKEY" ]; then
  echo "✗ Thieu public key. Vi du:"
  echo "    sudo bash vps-setup.sh \"\$(cat ~/.ssh/id_ed25519.pub)\""
  exit 1
fi

echo "▶ 1/6 Cap nhat he thong"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get upgrade -y -qq

echo "▶ 2/6 Tao user thuong '$DEPLOY_USER' + khoa ssh"
# Khong tao lai neu da co (idempotent).
id -u "$DEPLOY_USER" >/dev/null 2>&1 || adduser --disabled-password --gecos "" "$DEPLOY_USER"
usermod -aG sudo "$DEPLOY_USER"

install -d -m 700 -o "$DEPLOY_USER" -g "$DEPLOY_USER" "/home/$DEPLOY_USER/.ssh"
AUTH="/home/$DEPLOY_USER/.ssh/authorized_keys"
touch "$AUTH"
# grep -qxF: chi them khi CHUA co dong y het — chay lai khong nhan doi key.
grep -qxF "$PUBKEY" "$AUTH" || echo "$PUBKEY" >> "$AUTH"
chmod 600 "$AUTH"
chown "$DEPLOY_USER:$DEPLOY_USER" "$AUTH"

# sudo khong hoi mat khau: user nay tao bang --disabled-password nen KHONG CO
# mat khau de go. Thieu dong nay thi `sudo` cua no bao "incorrect password"
# vinh vien va coi nhu mat quyen admin.
echo "$DEPLOY_USER ALL=(ALL) NOPASSWD:ALL" > "/etc/sudoers.d/90-$DEPLOY_USER"
chmod 440 "/etc/sudoers.d/90-$DEPLOY_USER"

echo "▶ 3/6 Siet sshd (tat dang nhap bang mat khau + tat login root)"
SSHD_DROPIN=/etc/ssh/sshd_config.d/99-shoplite.conf
# Ubuntu 24.04 doc ca thu muc sshd_config.d/ — ghi file rieng o day AN TOAN hon
# sed vao sshd_config goc (khong dung vao dong nao cua nha cung cap, va go ra
# chi viec xoa mot file).
cat > "$SSHD_DROPIN" <<'EOF'
PasswordAuthentication no
KbdInteractiveAuthentication no
PermitRootLogin no
EOF

# ═══ KIEM TRA TRUOC KHI RESTART ═══
# Config sshd sai + restart = mat may vinh vien (khong con duong nao vao).
# `sshd -t` bao loi cu phap TRUOC khi restart. Va chi restart khi key da nam
# trong authorized_keys — neu khong, tat password login la tu khoa cua minh.
if [ ! -s "$AUTH" ]; then
  echo "✗ authorized_keys rong — KHONG tat password login, se tu khoa may."
  rm -f "$SSHD_DROPIN"
  exit 1
fi
sshd -t
systemctl restart ssh

echo "▶ 4/6 Tuong lua"
# ═══ ORACLE CLOUD CO HAI LOP TUONG LUA ═══
# (1) Security List / NSG tren web console — phai tu mo 80 va 443 o do.
# (2) Ngay TRONG may: image Ubuntu cua Oracle ship san luat iptables chan het
#     tru cong 22, va luat do duoc luu bang netfilter-persistent. Mo ufw ma
#     khong go luat kia thi trang web VAN khong vao duoc, rat de tuong may hong.
if [ -f /etc/iptables/rules.v4 ]; then
  echo "  · Phat hien iptables cua Oracle — mo them 80/443 trong do"
  iptables -I INPUT 5 -p tcp --dport 80  -j ACCEPT 2>/dev/null || true
  iptables -I INPUT 6 -p tcp --dport 443 -j ACCEPT 2>/dev/null || true
  netfilter-persistent save >/dev/null 2>&1 || true
fi

apt-get install -y -qq ufw
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

echo "▶ 5/6 Docker + compose plugin"
if ! command -v docker >/dev/null 2>&1; then
  curl -fsSL https://get.docker.com | sh
fi
usermod -aG docker "$DEPLOY_USER"
systemctl enable --now docker

echo "▶ 6/6 Va cham + tu vá bao mat"
apt-get install -y -qq unattended-upgrades
dpkg-reconfigure -f noninteractive unattended-upgrades

# Swap 2GB: Postgres + Redis + hai tien trinh Node + build image tren cung mot
# may. Het RAM giua luc build thi OOM killer ban tien trinh ngau nhien — thuong
# la postgres. Swap khong lam may nhanh len, no lam may KHONG CHET.
if ! swapon --show | grep -q .; then
  fallocate -l 2G /swapfile
  chmod 600 /swapfile
  mkswap /swapfile >/dev/null
  swapon /swapfile
  grep -qF '/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

echo ""
echo "✓ Xong. Kiem tra TRUOC KHI DONG PHIEN NAY (mo mot terminal khac):"
echo "    ssh $DEPLOY_USER@<ip>       # phai vao duoc bang key"
echo "    ssh $DEPLOY_USER@<ip> 'docker ps'"
echo ""
echo "  Neu vao duoc thi moi dong phien root nay. Sai gi con cua nay de sua."
