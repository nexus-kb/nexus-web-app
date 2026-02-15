FROM docker.io/library/node:22-bookworm-slim AS base

ENV PNPM_HOME=/pnpm
ENV PATH=${PNPM_HOME}:${PATH}

RUN corepack enable

FROM base AS deps

WORKDIR /app

COPY package.json pnpm-lock.yaml ./

RUN pnpm install --frozen-lockfile

FROM base AS builder

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

ARG NEXUS_WEB_API_BASE_URL=http://127.0.0.1:3000

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV NEXUS_WEB_API_BASE_URL=${NEXUS_WEB_API_BASE_URL}

RUN pnpm run build

FROM docker.io/library/node:22-bookworm-slim AS runtime

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    tini \
    && rm -rf /var/lib/apt/lists/*

RUN groupadd --gid 10001 nexus \
    && useradd --uid 10001 --gid nexus --create-home --home-dir /home/nexus --shell /usr/sbin/nologin nexus \
    && mkdir -p /app \
    && chown nexus:nexus /app

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3001
ENV HOSTNAME=0.0.0.0

COPY --from=builder --chown=nexus:nexus /app/public ./public
COPY --from=builder --chown=nexus:nexus /app/.next/standalone ./
COPY --from=builder --chown=nexus:nexus /app/.next/static ./.next/static

EXPOSE 3001

USER 10001:10001

ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["node", "server.js"]
