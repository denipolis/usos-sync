import dotenv from 'dotenv'
import { loadRuntimeConfig } from './config-store.js'
import { AppConfig } from './types/app-config.type.js'

dotenv.config()

const runtimeConfig = loadRuntimeConfig()

const requireEnv = (name: string): string => {
  const value = process.env[name]
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`)
  }
  return value
}

export const config: AppConfig = {
  usos: {
    baseUrl: requireEnv('USOS_BASE_URL').replace(/\/$/, ''),
    consumerKey: requireEnv('USOS_CONSUMER_KEY'),
    consumerSecret: requireEnv('USOS_CONSUMER_SECRET'),
    accessToken: runtimeConfig.usos.accessToken,
    accessTokenSecret: runtimeConfig.usos.accessTokenSecret,
    scopes: process.env.USOS_SCOPES || 'studies|offline_access',
    lang: process.env.USOS_LANG || 'pl'
  },
  google: {
    clientId: requireEnv('GOOGLE_CLIENT_ID'),
    clientSecret: requireEnv('GOOGLE_CLIENT_SECRET'),
    refreshToken: runtimeConfig.google.refreshToken,
    calendarId: runtimeConfig.google.calendarId
  },
  app: {
    timezone: process.env.TIMEZONE || 'Europe/Warsaw',
    cron: process.env.SYNC_CRON || '0 */12 * * *'
  }
}

