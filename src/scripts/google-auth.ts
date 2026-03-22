import fs from 'node:fs/promises';
import { Server } from 'node:http';
import { pathToFileURL } from 'node:url';
import dotenv from 'dotenv';
import express from 'express';
import prompts from 'prompts';
import { google } from 'googleapis';
import { loadRuntimeConfigIfExists, saveRuntimeConfig } from '../config-store.js';
import { formatError } from '../error-utils.js';
import {
  CredentialsFilePayload,
  GoogleAuthResult,
  GoogleCredentials
} from '../types/google-auth.type.js';

dotenv.config();

const GOOGLE_REDIRECT_URI = 'http://127.0.0.1:53682/oauth2callback';

const requireEnv = (name: string): string => {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return normalizeEnvValue(value);
}

const normalizeEnvValue = (value: string): string => {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1).trim();
  }
  return trimmed;
}

const extractCode = (value: string): string => {
  const trimmed = value.trim();
  if (!trimmed) return '';

  try {
    const url = new URL(trimmed);
    const code = url.searchParams.get('code');
    if (code) return code;
  } catch {
    // Not a URL; treat input as raw code.
  }

  return trimmed;
}

const readGoogleCredentialsFile = async (filePath: string): Promise<Partial<GoogleCredentials>> => {
  const raw = await fs.readFile(filePath, 'utf-8');
  const parsed = JSON.parse(raw) as CredentialsFilePayload;
  const source = parsed.installed || parsed.web;

  if (!source) {
    throw new Error('Invalid GOOGLE_OAUTH_CLIENT_JSON file format. Expected "installed" or "web" object.');
  }

  return {
    clientId: source.client_id,
    clientSecret: source.client_secret
  };
}

const resolveGoogleCredentials = async (): Promise<GoogleCredentials> => {
  const credentialsPath = process.env.GOOGLE_OAUTH_CLIENT_JSON
    ? normalizeEnvValue(process.env.GOOGLE_OAUTH_CLIENT_JSON)
    : '';

  const fileCredentials = credentialsPath ? await readGoogleCredentialsFile(credentialsPath) : {};

  const clientId =
    (process.env.GOOGLE_CLIENT_ID ? normalizeEnvValue(process.env.GOOGLE_CLIENT_ID) : '') ||
    fileCredentials.clientId ||
    '';
  const clientSecret =
    (process.env.GOOGLE_CLIENT_SECRET ? normalizeEnvValue(process.env.GOOGLE_CLIENT_SECRET) : '') ||
    fileCredentials.clientSecret ||
    '';

  if (!clientId) {
    throw new Error('Missing GOOGLE_CLIENT_ID (or provide GOOGLE_OAUTH_CLIENT_JSON).');
  }

  if (!clientSecret) {
    throw new Error('Missing GOOGLE_CLIENT_SECRET (or provide GOOGLE_OAUTH_CLIENT_JSON).');
  }

  return { clientId, clientSecret };
}

const buildInvalidClientHelp = (): string => {
  return [
    'Google returned invalid_client. Check the following:',
    `- Redirect URI used by script: ${GOOGLE_REDIRECT_URI}`,
    '- GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be from the SAME OAuth client',
    '- Prefer OAuth client type: Desktop App (for local scripts)',
    '- If using Web client, add exact redirect URI in Google Cloud -> APIs & Services -> Credentials',
    '- Ensure Google Calendar API is enabled in the same project',
    '- Remove extra quotes/spaces in .env values'
  ].join('\n');
}

const startLocalCallbackServer = (): {
  waitForCode: Promise<string>;
  close: () => Promise<void>;
  started: boolean;
} => {
  let parsed: URL;
  try {
    parsed = new URL(GOOGLE_REDIRECT_URI);
  } catch {
    return {
      waitForCode: Promise.reject(new Error('Static GOOGLE_REDIRECT_URI constant is not a valid URL.')),
      close: async () => {},
      started: false
    };
  }

  const isLocalhost = ['localhost', '127.0.0.1', '::1'].includes(parsed.hostname);
  if (parsed.protocol !== 'http:' || !isLocalhost) {
    return {
      waitForCode: Promise.reject(
        new Error('Automatic callback works only for local HTTP redirect URI (localhost/127.0.0.1).')
      ),
      close: async () => {},
      started: false
    };
  }

  const expectedPath = parsed.pathname || '/';
  const port = Number(parsed.port || '80');

  let server: Server;
  const app = express();

  const waitForCode = new Promise<string>((resolve, reject) => {
    app.get(expectedPath, (req, res) => {
      const error = typeof req.query.error === 'string' ? req.query.error : null;
      const code = typeof req.query.code === 'string' ? req.query.code : null;

      if (error) {
        res.status(400).set('Connection', 'close').send(`OAuth error: ${error}. You can close this tab.`);
        reject(new Error(`OAuth callback error: ${error}`));
        return;
      }

      if (!code) {
        res.status(400).set('Connection', 'close').send('No authorization code in callback. You can close this tab.');
        reject(new Error('No authorization code in callback URL.'));
        return;
      }

      res.status(200).set('Connection', 'close').send('Authorization received. You can return to terminal.');
      resolve(code);
    });

    app.use((_req, res) => {
      res.status(404).send('Not found');
    });

    server = app.listen(port, parsed.hostname);
    server.on('error', (err) => reject(err));
  });

  return {
    waitForCode,
    close: async () => {
      if (!server || !server.listening) {
        return;
      }

      await new Promise<void>((resolve, reject) => {
        server.close((err) => {
          if (err) {
            reject(err);
            return;
          }
          resolve();
        });
      });
    },
    started: true
  };
}

export const runGoogleAuthInteractive = async (): Promise<GoogleAuthResult> => {
  const { clientId, clientSecret } = await resolveGoogleCredentials();
  const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, GOOGLE_REDIRECT_URI);

  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: ['https://www.googleapis.com/auth/calendar']
  });

  console.log(`\nUsing redirect URI: ${GOOGLE_REDIRECT_URI}`);
  console.log('\n1) Open this URL in your browser and grant access:\n');
  console.log(authUrl);

  let code = '';
  const localCallback = startLocalCallbackServer();

  if (localCallback.started) {
    console.log('\n2) Waiting for callback on local redirect URI...');

    try {
      code = await Promise.race([
        localCallback.waitForCode,
        new Promise<string>((_, reject) => {
          setTimeout(() => reject(new Error('Callback timeout.')), 180000);
        })
      ]);
      console.log('Callback received automatically.');
    } catch {
      const fallbackAnswer = await prompts(
        {
          type: 'text',
          name: 'codeOrUrl',
          message: 'Auto-callback failed. Paste code or full redirected URL'
        },
        {
          onCancel: () => {
            throw new Error('Google authorization canceled by user.');
          }
        }
      );
      code = extractCode(String(fallbackAnswer.codeOrUrl || ''));
    } finally {
      await localCallback.close();
    }
  } else {
    const manualAnswer = await prompts(
      {
        type: 'text',
        name: 'codeOrUrl',
        message: 'Paste code or full redirected URL'
      },
      {
        onCancel: () => {
          throw new Error('Google authorization canceled by user.');
        }
      }
    );
    code = extractCode(String(manualAnswer.codeOrUrl || ''));
  }

  if (!code) {
    throw new Error('Authorization code is empty.');
  }

  const { tokens } = await oauth2Client.getToken(code);

  if (!tokens.refresh_token) {
    console.log(
      '\nNo refresh token returned. Try revoking app access in Google account and run this script again with prompt=consent (already enabled).'
    );
  }

  return {
    refreshToken: tokens.refresh_token || ''
  };
}

const main = async () => {
  const existing = loadRuntimeConfigIfExists();
  const googleAuth = await runGoogleAuthInteractive();

  if (!googleAuth.refreshToken) {
    throw new Error('Google did not return a refresh token.');
  }

  await saveRuntimeConfig({
    usos: {
      accessToken: existing?.usos.accessToken || '',
      accessTokenSecret: existing?.usos.accessTokenSecret || ''
    },
    google: {
      refreshToken: googleAuth.refreshToken,
      calendarId: existing?.google.calendarId || 'primary'
    }
  });

  console.log('\nGoogle refresh token acquired and saved to config.json.\n');
}

const isDirectExecution = (): boolean => {
  const entry = process.argv[1];
  if (!entry) {
    return false;
  }
  return import.meta.url === pathToFileURL(entry).href;
}

if (isDirectExecution()) {
  main().catch((error: unknown) => {
    const responseData = (error as { response?: { data?: { error?: string; error_description?: string } } })?.response?.data;
    const message = String(formatError(error));

    console.error('\nGoogle auth failed:', message);

    const normalized = `${responseData?.error || ''} ${responseData?.error_description || ''} ${message}`.toLowerCase();

    if (normalized.includes('invalid_client')) {
      console.error(`\n${buildInvalidClientHelp()}`);
    }

    process.exit(1);
  });
}