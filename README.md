> [!WARNING]
> This project was mostly vibecoded!

### USOS Sync

A simple and easy-to-use sync tool for continuously importing your USOS schedule into Google Calendar. `usos-sync` syncs your classes for this and next week from USOS into Google Calendar.

## Running locally

1. `git clone https://github.com/denipolis/usos-sync.git`
2. `cd usos-sync`
3. `pnpm install`
4. Create `.env` from `.env.example`
5. `pnpm configure`
6. `pnpm start`

## Build

1. `git clone https://github.com/denipolis/usos-sync.git`
2. `cd usos-sync`
3. `pnpm install`
4. `pnpm build`

## Running in Docker

1. `git clone https://github.com/denipolis/usos-sync.git`
2. `cd usos-sync`
3. Create `.env` from `.env.example`
4. Run `pnpm install && pnpm configure` to generate `config.json`
5. `docker compose up --build -d`
6. Optional logs: `docker compose logs -f usos-sync`
7. Stop: `docker compose down`

## Commands

- `pnpm configure` — interactive setup (USOS OAuth + Google OAuth + calendar id)
- `pnpm sync:once` — run one synchronization cycle
- `pnpm start` — build and run scheduled sync
- `pnpm dev` — TypeScript watch mode

## Configuration model

- Static credentials are stored in `.env`.
- Runtime/dynamic tokens are stored in `config.json`

