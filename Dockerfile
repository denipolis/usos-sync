# DEPS
FROM node:21.5-alpine AS base

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

WORKDIR /usr/src/app

# DEPENDENCIES
FROM base AS deps

COPY package.json .
COPY pnpm-lock.yaml .

RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile

# BUILD
FROM base AS build

COPY . .

COPY --from=deps /usr/src/app/node_modules ./node_modules

RUN pnpm build

# RUN
FROM base AS run

WORKDIR /usr/src/app

COPY --from=build /usr/src/app/node_modules ./node_modules
COPY --from=build /usr/src/app/dist ./dist
COPY --from=build /usr/src/app/package.json .
COPY --from=build /usr/src/app/pnpm-lock.yaml .

CMD ["node", "dist/main.js"]
