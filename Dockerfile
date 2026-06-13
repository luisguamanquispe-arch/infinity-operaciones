FROM node:20-alpine AS base
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app

FROM base AS deps
COPY package.json package-lock.json* ./
COPY prisma ./prisma
COPY prisma.config.ts ./
RUN npm ci --ignore-scripts

FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
ENV NEXT_BUILD_WORKERS=1
RUN npx prisma generate
RUN npm run build
RUN node -e "require('./scripts/prepare-standalone.cjs').prepareStandalone('/app')"

FROM base AS runner
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_OPTIONS=--max-old-space-size=160
ENV HOSTNAME=0.0.0.0
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs

COPY --from=builder /app/scripts ./scripts
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma.config.ts ./prisma.config.ts
COPY --from=builder /app/node_modules/prisma ./node_modules/prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
# No copiar node_modules/.bin/prisma: Docker desreferencia el symlink y rompe rutas WASM.
RUN mkdir -p node_modules/.bin && ln -sf ../prisma/build/index.js node_modules/.bin/prisma
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

RUN mkdir -p public/uploads && chown -R nextjs:nodejs public/uploads

USER nextjs
EXPOSE 3000
ENV PORT=3000

CMD ["node", "scripts/render-start.cjs"]
