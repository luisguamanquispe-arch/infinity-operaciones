FROM node:20-alpine AS base
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app

FROM base AS deps
COPY package.json package-lock.json* ./
COPY prisma ./prisma
COPY prisma.config.ts ./
RUN npm ci --ignore-scripts

FROM base AS builder
ARG GIT_SHA=unknown
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
ENV NEXT_BUILD_WORKERS=1
ENV RENDER_LOW_MEMORY=1
ENV GIT_SHA=$GIT_SHA
RUN node scripts/prisma-run.cjs generate
RUN npm run build
# Solo deps de runtime; el CLI de Prisma no debe existir en la imagen final
RUN npm prune --omit=dev && \
    rm -rf node_modules/prisma && \
    rm -f node_modules/.bin/prisma node_modules/.bin/prisma.cmd

FROM base AS runner
ARG GIT_SHA=unknown
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_OPTIONS=--max-old-space-size=160
ENV HOSTNAME=0.0.0.0
ENV GIT_SHA=$GIT_SHA
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs

COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/scripts ./scripts

RUN mkdir -p public/uploads && chown -R nextjs:nodejs /app

USER nextjs
EXPOSE 3000
ENV PORT=3000

CMD ["node", "scripts/render-start.cjs"]
