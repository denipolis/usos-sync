# BASE
FROM node:20-alpine AS base

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

WORKDIR /usr/src/app

# DEPENDENCIES FOR BUILD (includes devDeps)
FROM base AS deps-build

COPY package.json .
COPY pnpm-lock.yaml .

RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile --network-concurrency=1 --child-concurrency=1

# DEPENDENCIES FOR RUNTIME (prod only)
FROM base AS deps-prod

COPY package.json .
COPY pnpm-lock.yaml .

RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --prod --frozen-lockfile --network-concurrency=1 --child-concurrency=1

# BUILD
FROM base AS build

COPY . .

COPY --from=deps-build /usr/src/app/node_modules ./node_modules

RUN NODE_OPTIONS=--max-old-space-size=192 pnpm build

# RUN
FROM base AS run

WORKDIR /usr/src/app

ENV NODE_ENV=production
ENV NODE_OPTIONS=--max-old-space-size=128

COPY --from=deps-prod /usr/src/app/node_modules ./node_modules
COPY --from=build /usr/src/app/dist ./dist
COPY --from=build /usr/src/app/package.json .
COPY --from=build /usr/src/app/pnpm-lock.yaml .

CMD ["node", "dist/main.js"]
