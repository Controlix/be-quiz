# VPS Deployment Architectures for Multi-Team be-quiz

**Date:** 2026-11-07  
**Scope:** VPS (Hetzner CX23 @ ~€6.49/mo) with Docker Compose and Zero Cold-Start Lag.

---

## Architecture A: Multi-Database Stack (5 Containers)

In this model, each team has its own independent PostgreSQL container and database.

```mermaid
graph TD
    classDef external fill:#f9f,stroke:#333,stroke-width:2px;
    classDef container fill:#fff9c4,stroke:#fbc02d,stroke-width:2px;
    classDef persistent fill:#e8f5e9,stroke:#388e3c,stroke-width:2px;

    subgraph Internet ["External Internet"]
        User1["Team 1 Players"]:::external
        User2["Team 2 Players"]:::external
    end

    subgraph VPS ["Hetzner VPS Host"]
        Proxy["Caddy Reverse Proxy"]:::container

        subgraph Team1 ["Team 1 Stack"]
            App1["Next.js App 1"]:::container
            DB1["PostgreSQL 1"]:::container
            VolDB1[("Volume: DB 1")]:::persistent
            VolFiles1[("Volume: Uploads 1")]:::persistent
            App1 --> DB1
            DB1 --> VolDB1
            App1 --> VolFiles1
        end

        subgraph Team2 ["Team 2 Stack"]
            App2["Next.js App 2"]:::container
            DB2["PostgreSQL 2"]:::container
            VolDB2[("Volume: DB 2")]:::persistent
            VolFiles2[("Volume: Uploads 2")]:::persistent
            App2 --> DB2
            DB2 --> VolDB2
            App2 --> VolFiles2
        end
    end

    User1 --> Proxy
    User2 --> Proxy
    Proxy --> App1
    Proxy --> App2
```

- **Containers (5):** Caddy proxy + 2x Next.js app containers + 2x PostgreSQL containers.
- **Pros:** 100% physical data separation; complete database independence.
- **Cons:** Slightly higher memory footprint.

---

## Architecture B: Single Database with Schema-per-Tenant (4 Containers)

In this model, both teams share a single PostgreSQL container, but their data is strictly isolated into separate database schemas.

```mermaid
graph TD
    classDef external fill:#f9f,stroke:#333,stroke-width:2px;
    classDef container fill:#fff9c4,stroke:#fbc02d,stroke-width:2px;
    classDef persistent fill:#e8f5e9,stroke:#388e3c,stroke-width:2px;

    subgraph Internet ["External Internet"]
        User1["Team 1 Players"]:::external
        User2["Team 2 Players"]:::external
    end

    subgraph VPS ["Hetzner VPS Host"]
        Proxy["Caddy Reverse Proxy"]:::container

        App1["Next.js App 1"]:::container
        App2["Next.js App 2"]:::container
        DBServer["Shared PostgreSQL Engine"]:::container

        VolDB[("Volume: DB Data")]:::persistent
        VolFiles1[("Volume: Uploads 1")]:::persistent
        VolFiles2[("Volume: Uploads 2")]:::persistent
    end

    User1 --> Proxy
    User2 --> Proxy
    Proxy --> App1
    Proxy --> App2

    App1 --> DBServer
    App2 --> DBServer

    DBServer --> VolDB
    App1 --> VolFiles1
    App2 --> VolFiles2
```

- **Containers (4):** Caddy proxy + 2x Next.js app containers + 1x Shared PostgreSQL container.
- **Pros:** Lower resource usage; single database instance to back up.
- **Cons:** Shared database engine process.

---

---

## Architecture C: Code-Level Multi-Tenancy (3 Containers)

In this model, a single Next.js app container handles all teams, inspecting subdomains at the middleware level and scoping all database queries by `teamId` inside a single shared database.

```mermaid
graph TD
    classDef external fill:#f9f,stroke:#333,stroke-width:2px;
    classDef container fill:#fff9c4,stroke:#fbc02d,stroke-width:2px;
    classDef persistent fill:#e8f5e9,stroke:#388e3c,stroke-width:2px;

    subgraph Internet ["External Internet"]
        User1["Team 1 Players"]:::external
        User2["Team 2 Players"]:::external
    end

    subgraph VPS ["Hetzner VPS Host"]
        Proxy["Caddy Reverse Proxy"]:::container

        subgraph SharedApp ["Single Multi-Tenant App Container"]
            App["Next.js App (Multi-Tenant)<br/>Routes by Subdomain / teamId"]:::container
        end

        subgraph SharedDB ["Shared Database Container"]
            DBServer["PostgreSQL Server Engine"]:::container
        end

        subgraph Storage ["Host Disk Storage"]
            VolDB[("Volume: Single DB<br/>(Scoped by teamId)")]:::persistent
            VolFiles[("Volume: Shared Uploads")]:::persistent
        end
    end

    User1 -->|team1.com| Proxy
    User2 -->|team2.com| Proxy
    Proxy --> App

    App -->|Prisma queries with WHERE teamId| DBServer
    DBServer --> VolDB
    App --> VolFiles
```

- **Containers (3):** Caddy proxy + 1x Multi-Tenant Next.js app container + 1x Shared PostgreSQL container.
- **Pros:** Minimal container footprint; single codebase deployment.
- **Cons:** Requires a massive code refactor across all Prisma queries, server actions, and routing middleware; high security risk of cross-tenant data leaks if a query filter is missed.

---

## Cost Calculation & Resource Comparison

All three architectures run on the same Hetzner Cloud **CX23** instance (**2 vCPU, 4GB RAM, 40GB NVMe SSD**) located in Germany/Finland, priced at **€5.99/mo + €0.50 IPv4 = €6.49/mo (excl. VAT)**.

| Metric / Resource           | Architecture A (Multi-DB)           | Architecture B (Schema-per-Tenant)  | Architecture C (Code Multi-Tenant)                |
| :-------------------------- | :---------------------------------- | :---------------------------------- | :------------------------------------------------ |
| **Total Containers**        | **5** (Caddy + 2 Apps + 2 Postgres) | **4** (Caddy + 2 Apps + 1 Postgres) | **3** (Caddy + 1 App + 1 Postgres)                |
| **RAM Footprint (Approx.)** | ~450 MB / 4 GB                      | ~400 MB / 4 GB                      | ~300 MB / 4 GB                                    |
| **Disk Space (Approx.)**    | ~1.2 GB / 40 GB                     | ~1.0 GB / 40 GB                     | ~0.8 GB / 40 GB                                   |
| **Code Refactor Required**  | **None**                            | **None**                            | **Massive** (Tenant filtering across all queries) |
| **Monthly Hosting Cost**    | **€6.49 / mo**                      | **€6.49 / mo**                      | **€6.49 / mo**                                    |
