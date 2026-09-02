import { Manifest } from '../generator';

const ALPINE_BASE  = 'node:22-alpine';
const DEBIAN_BASE  = 'node:22-bookworm-slim';

function buildAlpine(): string {
    return `
FROM ${ALPINE_BASE} AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev

FROM ${ALPINE_BASE} AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM ${ALPINE_BASE} AS runner
RUN addgroup -S nestjs && adduser -S nestjs -G nestjs
WORKDIR /app
COPY --from=deps    /app/node_modules ./node_modules
COPY --from=builder /app/dist        ./dist
USER nestjs
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \\
  CMD wget -qO- http://localhost:3000/api/health || exit 1
CMD ["node", "dist/main"]
`.trimStart();
}

function buildDebian(): string {
    return `
FROM ${DEBIAN_BASE} AS deps
WORKDIR /app
ENV PUPPETEER_SKIP_DOWNLOAD=true
COPY package*.json ./
RUN npm ci --omit=dev

FROM ${DEBIAN_BASE} AS builder
WORKDIR /app
ENV PUPPETEER_CACHE_DIR=/app/.puppeteer
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM ${DEBIAN_BASE} AS runner
ENV LANG=en_US.UTF-8
ENV DBUS_SESSION_BUS_ADDRESS=autolaunch:
ENV PUPPETEER_CACHE_DIR=/app/.puppeteer

WORKDIR /app
COPY --from=deps    /app/node_modules  ./node_modules
COPY --from=builder /app/dist          ./dist
COPY --from=builder /app/.puppeteer    ./.puppeteer

# Install fonts, dbus, and Chrome system dependencies (requires root)
RUN apt-get update && apt-get install -y --no-install-recommends \\
      fonts-ipafont-gothic fonts-wqy-zenhei fonts-thai-tlwg \\
      fonts-khmeros fonts-kacst fonts-freefont-ttf dbus dbus-x11 \\
    && PUPPETEER_CACHE_DIR=/app/.puppeteer \\
       npx puppeteer browsers install chrome --install-deps \\
    && apt-get clean && rm -rf /var/lib/apt/lists/*

RUN groupadd -r nestjs && useradd -rm -g nestjs nestjs
RUN chown -R nestjs:nestjs /app
USER nestjs

EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \\
  CMD wget -qO- http://localhost:3000/api/health || exit 1
CMD ["node", "dist/main"]
`.trimStart();
}

export function buildDockerfile(manifests: Manifest[]): string {
    const needsDebian = manifests.some(m => m.docker?.base === 'debian');
    return needsDebian ? buildDebian() : buildAlpine();
}
