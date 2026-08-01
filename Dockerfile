# =============================================================================
# Pilketos E-Voting System — Dockerfile (Multi-stage Production Build)
# =============================================================================
# Reference: 07_DEVELOPMENT_ROADMAP.md §Phase 0
# Reference: 02_SYSTEM_ARCHITECTURE.md §Deployment Architecture — Option B
#
# Stages:
#   1. deps       — Install production + dev dependencies
#   2. migrator   — Prisma migrate/seed runner
#   3. builder    — Compile TypeScript and build Next.js standalone output
#   4. runner     — Minimal runtime image (no build tools, no devDeps)
# =============================================================================

# ---------------------------------------------------------------------------
# Stage 1: Install all dependencies
# ---------------------------------------------------------------------------
FROM node:22-alpine AS deps

# libc6-compat is required for some native Node.js bindings on Alpine
RUN apk add --no-cache libc6-compat

WORKDIR /app

ARG NPM_REGISTRY=https://registry.npmjs.org/

# Copy only manifests to leverage Docker layer caching
COPY package.json package-lock.json ./

# Install all dependencies (including dev) needed for the build step
# Increase timeout/retries to prevent ETIMEDOUT on slow/proxy networks
RUN npm config set registry "$NPM_REGISTRY" \
    && npm config set fetch-retries 10 \
    && npm config set fetch-retry-factor 2 \
    && npm config set fetch-retry-mintimeout 30000 \
    && npm config set fetch-retry-maxtimeout 600000 \
    && npm config set fetch-timeout 900000 \
    && npm config set maxsockets 3 \
    && npm ci --legacy-peer-deps --no-audit --prefer-offline

# ---------------------------------------------------------------------------
# Stage 2: Database migration runner
# ---------------------------------------------------------------------------
FROM node:22-alpine AS migrator

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY package.json package-lock.json prisma.config.ts ./
COPY prisma ./prisma

ENV NODE_ENV=production
ENV DATABASE_URL="postgresql://dummy:dummy@localhost:5432/dummy"

RUN npm run db:generate

# ---------------------------------------------------------------------------
# Stage 3: Build the Next.js application
# ---------------------------------------------------------------------------
FROM node:22-alpine AS builder

WORKDIR /app

# Copy node_modules from deps stage
COPY --from=deps /app/node_modules ./node_modules

# Copy source code
COPY . .

# Environment variables required at build time
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
ENV SKIP_ENV_VALIDATION=1
ENV DATABASE_URL="postgresql://dummy:dummy@localhost:5432/dummy"

# Generate Prisma client for build types and runtime access
RUN npm run db:generate

RUN npm run build

# ---------------------------------------------------------------------------
# Stage 4: Production runner
# ---------------------------------------------------------------------------
FROM node:22-alpine AS runner

WORKDIR /app

# Security: Run as non-root user
# Reference: 05_SECURITY.md §Infrastructure Security
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy only necessary runtime artifacts from builder
COPY --from=builder /app/public ./public
RUN mkdir -p /app/public/uploads && chown -R nextjs:nodejs /app/public/uploads

# Standalone output bundles everything needed to run (minimal footprint)
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
RUN mkdir -p /app/.next/cache && chmod -R 0777 /app/.next/cache

USER nextjs

EXPOSE 6500

ENV PORT=6500
ENV HOSTNAME=0.0.0.0
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Health check — calls the /api/health endpoint after startup
# Reference: 02_SYSTEM_ARCHITECTURE.md §Health Check Endpoint
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD wget -q --spider http://localhost:6500/api/health || exit 1

CMD ["node", "server.js"]
