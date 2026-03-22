export interface RuntimeConfig {
  usos: {
    accessToken: string;
    accessTokenSecret: string;
  };
  google: {
    refreshToken: string;
    calendarId: string;
  };
}