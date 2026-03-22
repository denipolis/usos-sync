import { calendar_v3 } from 'googleapis';
import type { AppConfig } from './app-config.type.js';
import type { UsosClient } from '../usos-client.js';

export interface ToGoogleEventOptions {
  timezone: string;
  preferredLang: string;
  eventId: string;
}

export interface RunSyncParams {
  usosClient: UsosClient;
  calendar: calendar_v3.Calendar;
  config: AppConfig;
}

export interface RunSyncResult {
  fetched: number;
  unique: number;
  created: number;
  updated: number;
  deleted: number;
  rangeStart: string | null;
  rangeEndExclusive: string | null;
  finishedAt: string | null;
}