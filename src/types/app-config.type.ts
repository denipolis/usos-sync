export interface AppConfig {
  usos: {
    baseUrl: string;
    consumerKey: string;
    consumerSecret: string;
    accessToken: string;
    accessTokenSecret: string;
    scopes: string;
    lang: string;
  };
  google: {
    clientId: string;
    clientSecret: string;
    refreshToken: string;
    calendarId: string;
  };
  app: {
    timezone: string;
    cron: string;
  };
}