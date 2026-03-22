import axios, { AxiosInstance } from 'axios';
import OAuth from 'oauth-1.0a';
import { DateTime } from 'luxon';
import { createUsosOAuth } from './usos-oauth.js';
import { UsosActivity, UsosClientParams, WeekWindows } from './types/usos-client.type.js';

export class UsosClient {
  private baseUrl: string;
  private oauth: OAuth;
  private token: { key: string; secret: string };
  private http: AxiosInstance;

  constructor({ baseUrl, consumerKey, consumerSecret, accessToken, accessTokenSecret }: UsosClientParams) {
    this.baseUrl = baseUrl;

    this.oauth = createUsosOAuth({ consumerKey, consumerSecret });

    this.token = {
      key: accessToken,
      secret: accessTokenSecret
    };

    this.http = axios.create({
      timeout: 30000
    });
  }

  async get<T>(path: string, params: Record<string, string | number> = {}): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const requestData = {
      url,
      method: 'GET',
      data: params
    };

    const authHeader = this.oauth.toHeader(this.oauth.authorize(requestData, this.token));

    const response = await this.http.get<T>(url, {
      params,
      headers: {
        ...authHeader,
        Accept: 'application/json'
      }
    });

    return response.data;
  }

  async getUserTimetable({
    startDate,
    days = 7,
    fields = 'start_time|end_time|name|type|url|building_name|room_number'
  }: {
    startDate: string;
    days?: number;
    fields?: string;
  }): Promise<UsosActivity[]> {
    return this.get<UsosActivity[]>('/services/tt/user', {
      start: startDate,
      days,
      fields,
      format: 'json'
    });
  }

  static getWeekWindows(timezone: string): WeekWindows {
    const now = DateTime.now().setZone(timezone);
    const thisWeekStart = now.startOf('week');
    const nextWeekStart = thisWeekStart.plus({ weeks: 1 });

    return {
      thisWeekStart,
      nextWeekStart,
      rangeStart: thisWeekStart,
      rangeEndExclusive: thisWeekStart.plus({ days: 14 })
    };
  }
}