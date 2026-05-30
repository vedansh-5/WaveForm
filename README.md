# WaveForm 🌊 — Mathematically Derived Audio Visualization

WaveForm is a premium, high-performance audio analyzer and visualizer. It processes uploaded rhythmic audio, trims it, solves complex **Fourier Series coefficients** (12 Harmonics) using a fast Go DSP engine, and plots the dynamic, rhythmic wave equations in real-time in a Next.js frontend using D3.js.

---

## 🚀 Key Features

* **Fourier Series DSP Solver**: Computes real-time mathematical equations ($a_0$, $a_n$, $b_n$ coefficients and fundamental frequency) representing rhythmic audio profiles.
* **Crisp, Dynamic Visualizer**: Beautiful D3.js canvas plotting epicycles and waves drawing over time as the audio plays.
* **Persistent Sessions**: User authentication with secure token-based logins.
* **Lightweight Storage**: Seamless audio streaming directly from Cloudflare R2 with automatic local fallback during development.
* **Free Production Architecture**: Designed to run 24/7 with zero out-of-pocket hosting costs.

---

## 🛠️ Local Development Setup

To run the entire stack on your local machine:

### 1. Backend (Go + PostgreSQL)
1. **Prerequisites**: Ensure Go 1.25+ and PostgreSQL are installed.
2. **Environment**: Create a file named `.env` in the `backend/` directory:
   ```env
   PORT=8080
   ENV=development
   DATABASE_URL=postgres://postgres:root@localhost:5432/waveform_db?sslmode=disable
   JWT_SECRET=your_local_jwt_secret_key
   
   # Keep empty to default to local folder storage during dev
   R2_ACCOUNT_ID=
   R2_ACCESS_KEY_ID=
   R2_SECRET_ACCESS_KEY=
   R2_BUCKET_NAME=
   R2_PUBLIC_DOMAIN=
   ```
3. **Run Backend**:
   ```bash
   cd backend
   go run cmd/api/main.go
   ```

### 2. Frontend (Next.js + Tailwind)
1. **Prerequisites**: Ensure Node.js is installed.
2. **Install Dependencies**:
   ```bash
   cd frontend
   npm install
   ```
3. **Run Frontend**:
   ```bash
   npm run dev
   ```
   Open `http://localhost:3000` to interact with the application.

### 🐳 Docker Compose Alternative (1-Click Run)
To run the database and Go API locally inside Docker:
```bash
cd backend
docker compose up --build
```

---

## ☁️ Production Architecture & Deployment ($0 Cost)

This project is configured to run fully in production with **$0 out-of-pocket hosting fees** and **zero cold starts**, bypassing the limitations of traditional free cloud tiers:

```
[Next.js Frontend] -----> [Nginx Reverse Proxy] -----> [Go / Fiber API]
(Cloudflare Pages - $0)    (Docker Container - $0)     (Render Host - $0)
         |                                                   |
         v                                                   v
[Cloudflare R2 Storage] <----------------------------- [Supabase Postgres]
(S3-Compatible - $0)                                    (Managed DB - $0)
```

### 1. Frontend: Cloudflare Pages ($0)
* **Hosting**: Next.js is deployed to **Cloudflare Pages**, providing ultra-fast global edge CDN delivery with unlimited bandwidth.
* **Setup**: Connects to the GitHub repository, targets `/frontend` directory, builds using Next.js preset, and uses `NEXT_PUBLIC_API_URL` to route requests to the API.

### 2. Backend: Render Web Services ($0)
* **Hosting**: Go Fiber API server is compiled via a multi-stage `Dockerfile` and hosted on Render’s free tier.
* **Keep-Alive Monitor (No Cold Starts)**: To prevent Render’s free tier from going to sleep after 15 minutes of inactivity, **Cron-Job.org** is set up to ping the `/health` endpoint of the backend every 10 minutes, keeping the server active 24/7.

### 3. Database: Supabase ($0)
* **Hosting**: A fully managed PostgreSQL database hosted on **Supabase’s free tier**.
* **IPv4 Pooler**: Bypasses Render’s lack of outbound IPv6 capabilities by connecting through the Supabase connection pooler on port `6543`.

### 4. Audio Storage: Cloudflare R2 ($0)
* **Hosting**: Audio files are streamed and saved on **Cloudflare R2** via an S3-compatible API.
* **Bandwidth Savings**: When a user plays an audio file, the backend issues a `302 Found` redirect directly to Cloudflare’s R2 CDN public domain, lowering API server bandwidth and processor load to absolute zero.
