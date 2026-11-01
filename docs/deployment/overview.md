# Deployment Guide & Compute Models: be-quiz

This document outlines the deployment models, compute execution environments, build pipelines, and operational procedures for **be-quiz**.

For the logical application architecture and service boundaries, consult [Architecture Overview](../architecture/overview.md). For physical backing services, databases, and storage topologies, consult [Infrastructure Overview](../infrastructure/overview.md).

---

## 1. Deployment Models Summary

be-quiz supports two primary compute deployment models:

| Aspect | Model A: Vercel (Serverless PaaS) | Model B: Docker (Standalone Container) |
| :--- | :--- | :--- |
| **Primary Target** | Managed production cloud hosting | Self-hosted VPS, Docker Compose, Fly.io, AWS ECS, Kubernetes |
| **Compute Engine** | AWS Lambda / Vercel Serverless Functions | Long-running Node.js process (`node server.js`) |
| **Process Lifecycle** | Ephemeral (spin-up on demand, scales to zero) | Persistent long-running daemon |
| **Build Artifact** | Vercel Serverless Output (`.vercel/output`) | Next.js Standalone Build (`.next/standalone`) |
| **Port / Binding** | Handled automatically by Vercel edge router | Binds to `0.0.0.0:3000` (configurable via `PORT` / `HOSTNAME`) |
| **Static Assets** | Automatically served via Vercel Edge CDN | Served directly by standalone Node or via fronting reverse proxy |

---

## 2. Model A: Vercel Serverless PaaS

Vercel provides native zero-configuration deployments for Next.js App Router applications.

### 2.1 How it Operates
* **React Server Components & Server Actions:** Compiled into serverless Lambda functions routed automatically by the Vercel edge network.
* **Cold Starts & Scaling:** Invocations scale instantaneously with incoming traffic and terminate when idle.
* **Static Assets:** Bundled static files (`/_next/static/*`) and static public assets are offloaded to Vercel's global CDN edge caches.

### 2.2 Production Setup Steps
1. **Repository Import:** Connect the GitHub repository in [vercel.com/new](https://vercel.com/new).
2. **Environment Variables:**
   * `DATABASE_URL`: Managed PostgreSQL connection string (see [Infrastructure](../infrastructure/overview.md#1-database-layer-postgresql)).
   * `BLOB_READ_WRITE_TOKEN`: Required for flyer and feedback image uploads.
   * `APP_URL`: Production domain URL (e.g., `https://quiz.example.com`).
   * `GEMINI_API_KEY` or `OPENAI_API_KEY`: Optional API key for AI flyer scanning.
3. **Database Migration & Seeding:**
   Run migrations and seed the initial admin user using your remote connection string:
   ```bash
   DATABASE_URL="postgresql://..." npx prisma db push
   DATABASE_URL="postgresql://..." npx tsx prisma/seed.ts
   ```

---

## 3. Model B: Docker Standalone Container

The application includes a production-grade multi-stage `Dockerfile` leveraging Next.js `output: "standalone"`.

### 3.1 Multi-Stage Build Architecture
The `Dockerfile` is structured in three stages:
1. **`deps` stage:** Alpine Linux base, installs build dependencies (`libc6-compat`) and performs clean npm installation (`npm ci`).
2. **`builder` stage:** Generates the Prisma Client (`npx prisma generate`) and compiles the standalone Next.js bundle (`npm run build`).
3. **`runner` stage:** Minimal Alpine runtime containing only the non-root `nextjs` system user, `.next/standalone`, static assets (`.next/static`), and public folder.

### 3.2 Running with Docker Compose
While the repository's root `docker-compose.yml` is configured for local PostgreSQL development, a complete standalone production or VPS stack can be deployed using an orchestrated compose file (e.g., `docker-compose.prod.yml`):

```yaml
services:
  postgres:
    image: postgres:16-alpine
    container_name: be_quiz_postgres
    environment:
      POSTGRES_USER: quiz
      POSTGRES_PASSWORD: quiz
      POSTGRES_DB: be_quiz
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    restart: unless-stopped

  app:
    build: .
    container_name: be_quiz_app
    environment:
      DATABASE_URL: "postgresql://quiz:quiz@postgres:5432/be_quiz?schema=public"
      APP_URL: "http://localhost:3000"
      PORT: 3000
      HOSTNAME: "0.0.0.0"
    ports:
      - "3000:3000"
    volumes:
      # Persistent local storage for flyer and feedback uploads
      - app_uploads:/app/public/uploads
    depends_on:
      - postgres
    restart: unless-stopped

volumes:
  postgres_data:
  app_uploads:
```

### 3.3 Container Build & Execution Commands
To build and run the container manually:

```bash
# Build the container image
docker build -t be-quiz:latest .

# Run container with volume mount for uploads
docker run -d \
  --name be-quiz \
  -p 3000:3000 \
  -e DATABASE_URL="postgresql://user:password@host:5432/db" \
  -e APP_URL="https://quiz.example.com" \
  -v be_quiz_uploads:/app/public/uploads \
  be-quiz:latest
```

---

## 4. Database Schema Sync in Release Pipelines

Regardless of the deployment model, database schema updates must be applied to PostgreSQL:

* **Production & Development Schema Sync:**
  ```bash
  DATABASE_URL="..." npx prisma db push
  ```
  *(Note: The project currently relies on `prisma db push` without checked-in SQL migration folders. Versioned migration history with `prisma migrate dev` / `prisma migrate deploy` can be initialized when needed.)*
* **Initial Admin Seed Data:**
  ```bash
  DATABASE_URL="..." npx tsx prisma/seed.ts
  ```
