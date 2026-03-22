import fs from 'node:fs';
import { promises as fsPromises } from 'node:fs';
import path from 'node:path';
import { RuntimeConfig } from './types/runtime-config.type.js';

const CONFIG_FILE_NAME = 'config.json';

export const getRuntimeConfigPath = (): string => {
  return path.resolve(process.cwd(), CONFIG_FILE_NAME);
}

const ensureString = (value: unknown, fieldName: string): string => {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`Invalid runtime config field: ${fieldName}`);
  }
  return value.trim();
}

const parseRuntimeConfig = (raw: string): RuntimeConfig => {
  const parsed = JSON.parse(raw) as Partial<RuntimeConfig>;

  return {
    usos: {
      accessToken: ensureString(parsed.usos?.accessToken, 'usos.accessToken'),
      accessTokenSecret: ensureString(parsed.usos?.accessTokenSecret, 'usos.accessTokenSecret')
    },
    google: {
      refreshToken: ensureString(parsed.google?.refreshToken, 'google.refreshToken'),
      calendarId: ensureString(parsed.google?.calendarId, 'google.calendarId')
    }
  };
}

export const loadRuntimeConfig = (): RuntimeConfig => {
  const filePath = getRuntimeConfigPath();
  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing ${CONFIG_FILE_NAME}. Run "pnpm configure" first.`);
  }

  const raw = fs.readFileSync(filePath, 'utf-8');
  return parseRuntimeConfig(raw);
}

export const loadRuntimeConfigIfExists = (): RuntimeConfig | null => {
  const filePath = getRuntimeConfigPath();
  if (!fs.existsSync(filePath)) {
    return null;
  }

  const raw = fs.readFileSync(filePath, 'utf-8');
  return parseRuntimeConfig(raw);
}

export const saveRuntimeConfig = async (config: RuntimeConfig): Promise<void> => {
  const filePath = getRuntimeConfigPath();
  const content = `${JSON.stringify(config, null, 2)}\n`;
  await fsPromises.writeFile(filePath, content, 'utf-8');
}