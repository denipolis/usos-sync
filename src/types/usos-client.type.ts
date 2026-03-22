import { DateTime } from 'luxon';
import { LangDict } from './lang-dict.type.js';

export interface UsosClientParams {
  baseUrl: string;
  consumerKey: string;
  consumerSecret: string;
  accessToken: string;
  accessTokenSecret: string;
}

export interface UsosActivity {
  start_time?: string;
  end_time?: string;
  name?: LangDict;
  type?: string;
  url?: string;
  building_name?: LangDict;
  room_number?: LangDict;
}

export interface WeekWindows {
  thisWeekStart: DateTime;
  nextWeekStart: DateTime;
  rangeStart: DateTime;
  rangeEndExclusive: DateTime;
}