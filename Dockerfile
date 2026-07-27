# =============================================================================
# Pilketos E-Voting System — Dockerfile (Multi-stage Production Build)
# =============================================================================
# Reference: 07_DEVELOPMENT_ROADMAP.md §Phase 0
# Reference: 02_SYSTEM_ARCHITECTURE.md §Deployment Architecture — Option B
#
# Stages:
#   1. deps       — Install production + dev dependencies
#   2. builder    — Compile TypeScript and build Next.js standalone output
#   3. runner     — Minimal runtime image (no build tools, no devDeps)
# =============================================================================

# ---------------------------------------------------------------------------
# Stage 1: Install all dependencies
# ---------------------------------------------------------------------------
FROM node:20-alpine AS deps

# libc6-compat is required for some native Node.js bindings on Alpine
RUN apk add --no-cache libc6-compat

WORKDIR /app

# Copy only manifests to leverage Docker layer caching
COPY package.json package-lock.json ./

# Install all dependencies (including dev) needed for the build step
RUN npm ci --legacy-peer-deps

# ---------------------------------------------------------------------------
# Stage 2: Build the Next.js application
# ---------------------------------------------------------------------------
FROM node:20-alpine AS builder

WORKDIR /app

# Copy node_modules from deps stage
COPY --from=deps /app/node_modules ./node_modules

# Copy source code
COPY . .

# Environment variables required at build time
# In CI/CD, these should be passed as --build-arg or set as build secrets
# ARG DATABASE_URL
# ARG DIRECT_URL
# etc.

# Build Next.js with standalone output for smaller runtime image
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

RUN npm run build

# ---------------------------------------------------------------------------
# Stage 3: Production runner
# ---------------------------------------------------------------------------
FROM node:20-alpine AS runner

WORKDIR /app

# Security: Run as non-root user
# Reference: 05_SECURITY.md §Infrastructure Security
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy only necessary runtime artifacts from builder
COPY --from=builder /app/public ./public

# Standalone output bundles everything needed to run (minimal footprint)
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

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
