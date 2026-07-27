# Dockerfile production cho API + worker (Handbook 9.2, Roadmap 7.1 buoc 1).
#
# Bon stage, moi stage co MOT viec:
#   build    → co devDependencies, chay `prisma generate` + `tsc` ra dist/
#   deps     → CHI dependencies production, khong he thay code TS
#   migrator → build + prisma CLI, CHI de chay `prisma migrate deploy` luc deploy
#   final    → khong cai gi ca, chi nhat ket qua cua build + deps
#
# Vi sao khong gop build+deps: neu dung lai node_modules cua stage build thi
# devDependencies (typescript, vitest, tsx...) di thang vao image production.
# Cai `npm ci --omit=dev` rieng o stage deps la cach duy nhat co duoc mot cay
# node_modules SACH ma khong phai `npm prune` (prune khong bo het).
#
# ═══ LECH HANDBOOK CO CHU Y (1): node:24 chu khong phai node:20 ═══
# Handbook 9.2 viet node:20-alpine, nhung Node 20 het vong doi thang 4/2026 —
# ship mot runtime khong con nhan va bao mat len prod la sai. node:24 la Active
# LTS va dung khop Node dang chay o may dev (v24.16), nen khong co chuyen "chay
# ngon local, chet trong container" vi lech phien ban.
#
# ═══ LECH ROADMAP CO CHU Y (2): prisma CLI KHONG nam trong image API ═══
# Roadmap 7.1 buoc 3 viet `docker compose run --rm api npx prisma migrate deploy`,
# tuc la CLI phai co trong image API. DA DO THAT: lam vay image len 483MB
# (prisma CLI 67MB + effect 34MB + typescript 24MB + fast-check 5MB, keo theo
# @prisma/engines 36MB co ca schema-engine 20MB chi migrate moi dung) — vuot xa
# moc DoD < 300MB. Va no con sai ve BAO MAT: container dang phuc vu HTTP thi
# khong nen mang theo cong cu du suc go/viet lai schema DB.
# → Migrate chay bang stage `migrator` rieng (xem deploy.sh + compose prod).

# ─── Stage 1: build ──────────────────────────────────────────────────────────
FROM node:24-alpine AS build
WORKDIR /app

# COPY package*.json TRUOC roi moi COPY code: Docker cache theo tung layer, va
# layer chi hong khi file dau vao cua no doi. Sua mot dong trong src/ ma
# package-lock.json khong doi → `npm ci` (lau nhat) van an cache.
COPY package*.json ./
RUN npm ci

# Prisma Client la code SINH RA, khong nam trong node_modules san — phai generate.
# Copy rieng prisma/ truoc `COPY . .` de sua code TS khong lam chay lai generate.
# Ket qua ra `node_modules/.prisma/client` (generator dung output mac dinh) —
# stage final boc dung thu muc do sang cay node_modules production.
COPY prisma ./prisma
RUN npx prisma generate

COPY . .
RUN npm run build

# ─── Stage 2: deps production ────────────────────────────────────────────────
FROM node:24-alpine AS deps
WORKDIR /app

COPY package*.json ./

# ═══ Vi sao can CA BA co `--omit` (do that tung buoc, khong phai phong xa) ═══
# `--omit=dev` MOT MINH khong du: @prisma/client khai `prisma` va `typescript` la
# peerDependencies OPTIONAL, nen npm van keo ca prisma CLI vao cay production —
# keo theo @prisma/engines (co schema-engine 20MB chi migrate moi dung), effect
# 34MB (dep cua @prisma/config), typescript 24MB, fast-check 5MB.
#
# Them `--omit=peer` cung CHUA du — da build va do trong image: prisma 51MB +
# effect 34MB + typescript 24MB VAN CON, node_modules 258MB → image 387MB.
# Ly do nam trong package-lock.json: may package do duoc danh dau `devOptional`
# (den duoc bang ca duong dev VA duong optional). Bo duong `dev` va duong `peer`
# thi duong `optional` van giu chung lai.
#
# `--omit=optional` la manh ghep con thieu: node_modules 258MB → 82MB.
# Cai gi that su can luc chay van con, vi chung la dependency TRUC TIEP trong
# package.json (zod, express, ioredis, bcrypt, lodash cua cloudinary, luxon cua
# cron-parser...). Da smoke test container: /health/ready xanh (ping that DB +
# Redis), login chay duoc (bcrypt native compare) — so do o README muc "Do luong".
RUN npm ci --omit=dev --omit=peer --omit=optional

# Prisma 6 ship SAN moi bien the engine cho moi database trong runtime/:
# query_engine_bg.<db>.wasm-base64.js + query_compiler_bg.<db>.* (~50MB, danh cho
# edge/serverless) va cac file .map (~15MB). Project nay chay engine `library`
# tren Node: `.prisma/client/index.js` chi `require('@prisma/client/runtime/
# library.js')` — da grep xac nhan trong image, khong doan. Bo phan thua: runtime
# 73MB → 4MB.
RUN rm -f node_modules/@prisma/client/runtime/*wasm-base64* \
          node_modules/@prisma/client/runtime/*.map

# KHONG `npx prisma generate` o day: prisma CLI la devDependency nen cay nay
# khong co no, npx se di TAI CLI tu mang giua luc build (cham, va build hong khi
# offline). Client sinh o stage build duoc copy sang o stage final — cung mot ket
# qua, khong ton 130MB.

# ─── Stage 3: migrator ───────────────────────────────────────────────────────
# Image rieng chi de chay `prisma migrate deploy` luc deploy. No dung LAI stage
# build nen khong build lai gi ca (chung layer, chung cache).
FROM build AS migrator
CMD ["npx", "prisma", "migrate", "deploy"]

# ─── Stage 4: runtime ────────────────────────────────────────────────────────
FROM node:24-alpine
WORKDIR /app

ENV NODE_ENV=production

# openssl: Prisma dò libssl luc khoi dong de chon query engine. Alpine (musl) co
# ban khong cai san — thieu no thi container chay duoc den luc query DAU TIEN roi
# moi chet, tuc la healthcheck co the da xanh truoc khi loi lo ra.
RUN apk add --no-cache openssl

# Chay bang user thuong. Mac dinh cua image la root; mot lo RCE trong app ma
# process dang la root thi ke tan cong lam chu luon container.
RUN addgroup -S app && adduser -S app -G app

COPY --from=deps /app/node_modules ./node_modules
# Prisma Client SINH RA (index.js + libquery_engine .so.node): thu duy nhat can
# lay tu stage build ngoai dist/. Thieu no thi `new PrismaClient()` chet ngay
# lan dau require. Phai copy SAU node_modules cua deps, khong thi bi de mat.
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build /app/dist ./dist
# prisma/ giu trong image runtime cho tien debug (doc schema + xem migrations da
# apply). `migrate deploy` KHONG chay tu day nua — do la viec cua stage migrator.
COPY prisma ./prisma
COPY package.json ./

USER app
EXPOSE 3000

# wget co san trong busybox cua alpine — khong can cai curl.
HEALTHCHECK --interval=15s --timeout=3s --retries=3 \
  CMD wget -qO- http://localhost:3000/health || exit 1

# Worker dung CHUNG image nay, chi khac `command:` trong compose
# (node dist/worker.js) — cung code, cung deps, khac tien trinh.
CMD ["node", "dist/index.js"]
