import { calendar_v3, google } from 'googleapis';
import { GoogleClientParams } from './types/google-client.type.js';

export const createGoogleCalendarClient = ({
  clientId,
  clientSecret,
  refreshToken
}: GoogleClientParams): calendar_v3.Calendar => {
  const oauth2Client = new google.auth.OAuth2(clientId, clientSecret);
  oauth2Client.setCredentials({ refresh_token: refreshToken });

  return google.calendar({
    version: 'v3',
    auth: oauth2Client
  });
}