# ShopLite

Một dự án E-commerce Fullstack được xây dựng để học và thực hành kiến trúc Backend/Frontend hiện đại.

## Công nghệ sử dụng

### Backend

- Node.js
- Express
- TypeScript
- Prisma ORM
- PostgreSQL
- Redis
- Zod
- Pino Logger

### Frontend

- React
- Vite
- TypeScript

## Yêu cầu

- Node.js >= 22
- Docker Desktop
- npm

## Cài đặt

### 1. Clone project

```bash
git clone <repo-url>
cd shoplite
```

### 2. Khởi động Database

```bash
docker compose up -d
```

### 3. Cài package

```bash
cd server
npm install
```

### 4. Chạy server

```bash
npm run dev
```

Server chạy tại:

```
http://localhost:3000
```

## API

### Health

```
GET /health
```

### Ready

```
GET /health/ready
```

## Database

Prisma ORM

```bash
npx prisma migrate dev
```

Generate Prisma Client

```bash
npx prisma generate
```

Seed dữ liệu

```bash
npx prisma db seed
```

## Cấu trúc project

```
shoplite
├── client
├── server
├── docker-compose.yml
└── README.md
```
