import axios from 'axios';
import OAuth from 'oauth-1.0a';
import { pathToFileURL } from 'node:url';
import dotenv from 'dotenv';
import prompts from 'prompts';
import { loadRuntimeConfigIfExists, saveRuntimeConfig } from '../config-store.js';
import { formatError } from '../error-utils.js';
import { createUsosOAuth, parseOAuthFormResponse } from '../usos-oauth.js';
import { UsosAuthResult } from '../types/usos-auth.type.js';

dotenv.config();

const requireEnv = (name: string): string => {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

const buildOAuth = (consumerKey: string, consumerSecret: string): OAuth => {
  return createUsosOAuth({ consumerKey, consumerSecret });
}

export const runUsosAuthInteractive = async (): Promise<UsosAuthResult> => {
  const baseUrl = requireEnv('USOS_BASE_URL').replace(/\/$/, '');
  const consumerKey = requireEnv('USOS_CONSUMER_KEY');
  const consumerSecret = requireEnv('USOS_CONSUMER_SECRET');
  const scopes = process.env.USOS_SCOPES || 'studies|offline_access';

  const oauth = buildOAuth(consumerKey, consumerSecret);
  const requestTokenUrl = `${baseUrl}/services/oauth/request_token`;
  const accessTokenUrl = `${baseUrl}/services/oauth/access_token`;
  const authorizeUrl = `${baseUrl}/services/oauth/authorize`;

  const requestTokenData = {
    url: requestTokenUrl,
    method: 'POST',
    data: {
      oauth_callback: 'oob',
      scopes
    }
  };

  const requestTokenAuthHeader = oauth.toHeader(oauth.authorize(requestTokenData));

  const requestTokenResponse = await axios.post(
    requestTokenUrl,
    new URLSearchParams({ oauth_callback: 'oob', scopes }).toString(),
    {
      headers: {
        ...requestTokenAuthHeader,
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    }
  );

  const requestTokenPayload = parseOAuthFormResponse(requestTokenResponse.data);
  const requestToken = requestTokenPayload.oauth_token;
  const requestTokenSecret = requestTokenPayload.oauth_token_secret;

  if (!requestToken || !requestTokenSecret) {
    throw new Error('Failed to obtain request token from USOS API.');
  }

  console.log('\n1) Open this URL and authorize the app:\n');
  console.log(`${authorizeUrl}?oauth_token=${encodeURIComponent(requestToken)}`);

  const verifierAnswer = await prompts(
    {
      type: 'text',
      name: 'verifier',
      message: 'Enter oauth_verifier shown by USOS'
    },
    {
      onCancel: () => {
        throw new Error('USOS authorization canceled by user.');
      }
    }
  );
  const verifier = String(verifierAnswer.verifier || '').trim();

  if (!verifier) {
    throw new Error('oauth_verifier is empty.');
  }

  const accessTokenData = {
    url: accessTokenUrl,
    method: 'POST',
    data: {
      oauth_verifier: verifier
    }
  };

  const accessTokenHeader = oauth.toHeader(
    oauth.authorize(accessTokenData, {
      key: requestToken,
      secret: requestTokenSecret
    })
  );

  const accessTokenResponse = await axios.post(
    accessTokenUrl,
    new URLSearchParams({ oauth_verifier: verifier }).toString(),
    {
      headers: {
        ...accessTokenHeader,
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    }
  );

  const accessTokenPayload = parseOAuthFormResponse(accessTokenResponse.data);

  return {
    accessToken: accessTokenPayload.oauth_token || '',
    accessTokenSecret: accessTokenPayload.oauth_token_secret || '',
    userId: accessTokenPayload.user_id || undefined
  };
}

const main = async () => {
  const existing = loadRuntimeConfigIfExists();
  const usos = await runUsosAuthInteractive();

  if (!usos.accessToken || !usos.accessTokenSecret) {
    throw new Error('USOS did not return access token pair.');
  }

  await saveRuntimeConfig({
    usos: {
      accessToken: usos.accessToken,
      accessTokenSecret: usos.accessTokenSecret
    },
    google: {
      refreshToken: existing?.google.refreshToken || '',
      calendarId: existing?.google.calendarId || 'primary'
    }
  });

  console.log('\nUSOS access token acquired and saved to config.json.\n');
  if (usos.userId) {
    console.log(`USOS_USER_ID=${usos.userId}`);
  }
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
    console.error('\nUSOS auth failed:', formatError(error));
    process.exit(1);
  });
}