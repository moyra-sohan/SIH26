# ⚙️ PRABAH (প্রবাহ) — Backend API Gateway

[![Fastify](https://img.shields.io/badge/Fastify-5.x-000000.svg?style=for-the-badge&logo=fastify&logoColor=white)](https://fastify.dev/)
[![Prisma ORM](https://img.shields.io/badge/Prisma-6.x-2D3748.svg?style=for-the-badge&logo=prisma&logoColor=white)](https://www.prisma.io/)
[![Neon PostgreSQL](https://img.shields.io/badge/Neon-PostgreSQL-00E599.svg?style=for-the-badge&logo=postgresql&logoColor=black)](https://neon.tech/)
[![JWT Auth](https://img.shields.io/badge/JWT-Secure%20Auth-black.svg?style=for-the-badge&logo=json-web-tokens)](https://jwt.io/)
[![Bcrypt](https://img.shields.io/badge/Bcrypt-Password%20Hash-blue.svg?style=for-the-badge)](https://www.npmjs.com/package/bcryptjs)

The **PRABAH Backend Gateway** is an asynchronous API server built with **Fastify 5** and **Prisma ORM**. It serves as the primary application gateway, providing authenticated user management, persistent profile storage on **Neon Serverless PostgreSQL**, secure session and cookie handling, and an intelligent reverse proxy layer to the downstream **Python FastAPI ML Microservice**.

---

## 📑 Table of Contents

1. [Architectural Overview](#-architectural-overview)
2. [Directory Structure](#-directory-structure)
3. [Database Schema (Prisma & Neon PostgreSQL)](#-database-schema-prisma--neon-postgresql)
4. [Authentication & Security Architecture](#-authentication--security-architecture)
5. [Machine Learning Proxy & Routing](#-machine-learning-proxy--routing)
6. [API Endpoints Reference](#-api-endpoints-reference)
7. [Environment Configuration (.env)](#-environment-configuration-env)
8. [Prerequisites & Quick Start](#-prerequisites--quick-start)
9. [Database Health & Verification Scripts](#-database-health--verification-scripts)

---

## 🏛️ Architectural Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            VITE FRONTEND CLIENT                             │
│                         (http://localhost:5173)                             │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │ HTTP Requests (CORS Enabled)
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                       FASTIFY 5 BACKEND GATEWAY (:5000)                     │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │ Middlewares & Plugins:                                                │  │
│  │  • @fastify/cors      ── Origin reflection with credential support    │  │
│  │  • @fastify/cookie    ── Signed HTTP-only cookie parsing              │  │
│  │  • @fastify/session   ── State session storage                        │  │
│  │  • @fastify/jwt       ── Token signing & verification                 │  │
│  │  • pino-pretty        ── Structured request logging                   │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                      │                                       │
│                ┌─────────────────────┴─────────────────────┐                 │
│                ▼                                           ▼                 │
│     AUTH ROUTER (`/api/auth/*`)                ML PROXY ROUTER (`/api/ml/*`) │
│    • User Registration                        • Health & Model Status        │
│    • Password Hashing (bcrypt)                • Single & Batch Predictions   │
│    • Session / Me Route                       • Live Weather Telemetry       │
│    • Cookie-based Logout                      • 9-Table Spatial DB Queries   │
│                │                                           │                 │
└────────────────┼───────────────────────────────────────────┼─────────────────┘
                 │ Prisma Queries                            │ HTTP (Port 8000)
                 ▼                                           ▼
┌─────────────────────────────────┐         ┌─────────────────────────────────┐
│     Neon Cloud PostgreSQL       │         │    Python FastAPI ML Engine     │
│   (Serverless SQL Database)     │         │   (Scikit-Learn Pipeline)       │
└─────────────────────────────────┘         └─────────────────────────────────┘
```

---

## 📁 Directory Structure

```text
backend/
├── prisma/
│   └── schema.prisma                # Prisma ORM schema definition for Neon PostgreSQL
├── src/
│   ├── server.js                    # Fastify server initialization, plugins, & health probes
│   ├── lib/
│   │   └── prisma.js                # Singleton PrismaClient connection instance
│   └── routes/
│       ├── auth.js                  # User registration, login, session, /me, and logout routes
│       └── ml.js                    # Reverse proxy controllers to Python ML microservice
├── verify_db.js                     # Standalone Neon PostgreSQL connection validation script
├── .env                             # Local environment variables configuration
├── .env.example                     # Environment template for deployment
└── package.json                     # Dependencies, scripts, and engine specifications
```

---

## 🗄️ Database Schema (Prisma & Neon PostgreSQL)

The backend connects directly to a serverless **Neon PostgreSQL** cluster using **Prisma ORM**.

### `prisma/schema.prisma`

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}

model User {
  id        String   @id @default(uuid())
  name      String
  username  String?  @unique
  email     String   @unique
  password  String
  houseNo   String?
  street    String
  area      String
  city      String
  district  String
  state     String
  pinCode   String
  country   String   @default("India")
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@map("users")
}
```

---

## 🔐 Authentication & Security Architecture

### 1. Password Security
- Passwords are encrypted using `bcryptjs` with **10 salt rounds** prior to storage.
- Raw passwords are never logged or returned in query payloads.

### 2. Multi-Tier Token & Session Strategy
The server supports a 3-tier authentication verification chain in `getAuthenticatedUser(request)`:
1. **Active Server Session:** Checked via `@fastify/session`.
2. **Signed HTTP-Only Cookie:** Read and validated via `@fastify/cookie` (`signed: true`, `sameSite: 'lax'`).
3. **Authorization Header:** Fallback Bearer token validation via `@fastify/jwt`.

---

## 🔄 Machine Learning Proxy & Routing

To simplify frontend integration, prevent CORS issues, and provide structured fallbacks, the backend acts as a reverse proxy to the **Python FastAPI ML Microservice** (`http://127.0.0.1:8000`):

- **Weather API Key Security:** The `WEATHER_API_KEY` is kept isolated within the Python microservice; the backend proxies `/api/ml/weather/:ward_id` without exposing tokens.
- **Fail-Safe Degradation:** If the ML service is restarting or unreachable, the gateway intercepts connection errors and returns a structured `503 Service Unavailable` with actionable recovery hints.

---

## 📡 API Endpoints Reference

### 1. System Health
| Method | Route | Description |
|---|---|---|
| `GET` | `/` | Service name, status, and version |
| `GET` | `/api/health` | Neon PostgreSQL query probe (`SELECT 1`) |

### 2. Authentication (`/api/auth/*`)
| Method | Route | Payload / Parameters | Description |
|---|---|---|---|
| `POST` | `/api/auth/register` | `name`, `username`, `email`, `password`, `street`, `area`, `city`, `district`, `state`, `pinCode` | Creates a new user in PostgreSQL and sets auth cookie |
| `POST` | `/api/auth/login` | `email` (or `username`), `password` | Verifies credentials, issues JWT and session |
| `GET` | `/api/auth/session` | *None* (Cookie/Session) | Validates active session state |
| `GET` | `/api/auth/me` | *None* (JWT / Cookie) | Returns authenticated user profile |
| `POST` | `/api/auth/logout` | *None* | Destroys session and clears auth cookies |

### 3. Machine Learning Proxy (`/api/ml/*`)
| Method | Route | Upstream FastAPI Endpoint |
|---|---|---|
| `GET` | `/api/ml/health` | `GET /health` |
| `GET` | `/api/ml/wards` | `GET /api/wards` |
| `GET` | `/api/ml/features` | `GET /api/features` |
| `POST` | `/api/ml/predict` | `POST /api/predict` |
| `GET` | `/api/ml/forecasts` | `GET /api/ward-forecasts` |
| `POST` | `/api/ml/batch-predict` | `POST /api/batch-predict` |
| `GET` | `/api/ml/weather/:ward_id` | `GET /api/weather/{ward_id}` |
| `GET` | `/api/ml/weather-predict/:ward_id` | `GET /api/weather-predict/{ward_id}` |
| `GET` | `/api/ml/db/tables` | `GET /api/db/tables` |
| `GET` | `/api/ml/db/table/:tableName` | `GET /api/db/table/{tableName}` |
| `GET` | `/api/ml/db/all` | `GET /api/db/all` |
| `GET` | `/api/ml/db/roads` | `GET /api/db/roads` |
| `GET` | `/api/ml/db/drains` | `GET /api/db/drains` |
| `GET` | `/api/ml/db/zones` | `GET /api/db/zones` |
| `GET` | `/api/ml/db/3h-situation` | `GET /api/db/3h-situation` |
| `POST` | `/api/ml/db/predict-location` | `POST /api/db/predict-location` |

---

## ⚙️ Environment Configuration (.env)

Create a `.env` file in the `backend/` directory:

```env
# Neon PostgreSQL Connection String (Pooler or Direct URL with SSL)
DATABASE_URL="postgresql://neondb_owner:***@ep-dawn-heart-a5liig8g-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require"

# Server Port
PORT=5000

# Security Secrets (Minimum 32 characters long for production)
JWT_SECRET="sih_urban_flood_secret_key_2026_jwt_token"
SESSION_SECRET="sih_flood_session_secret_key_minimum_32_characters_long_2026!"
COOKIE_SECRET="sih_flood_cookie_secret_key_minimum_32_characters_long_2026!"

# Upstream Python ML Microservice URL
ML_SERVICE_URL="http://127.0.0.1:8000"
```

---

## 🚀 Prerequisites & Quick Start

Ensure you have **Node.js** (`>= 18.0.0`) installed.

```powershell
# 1. Navigate to the backend directory
cd SIH-26085/backend

# 2. Install dependencies
npm install

# 3. Generate Prisma client
npx prisma generate

# 4. Push schema to database (if setting up new DB)
npx prisma db push

# 5. Start development server with auto-reload
npm run dev
# or for standard production start:
# node src/server.js
```

The gateway will be operational at: `http://localhost:5000/`

---

## 🧪 Database Health & Verification Scripts

To test that your Neon PostgreSQL connection and Prisma client are properly configured without starting the entire web server:

```powershell
node verify_db.js
```

### Expected Output:
```text
✅ Successfully connected to Neon PostgreSQL Database!
📊 Total Registered Users: X
```
