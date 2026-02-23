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
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm run build

FROM docker.io/library/nginx:1.29-alpine AS runtime

ENV NEXUS_API_UPSTREAM=http://api:3000

COPY nginx/default.conf.template /etc/nginx/templates/default.conf.template
COPY --from=builder /app/out /usr/share/nginx/html

EXPOSE 3001

CMD ["nginx", "-g", "daemon off;"]
