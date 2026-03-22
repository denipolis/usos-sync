import crypto from 'crypto';
import OAuth from 'oauth-1.0a';
import { UsosOAuthCredentials } from './types/usos-oauth.type.js';

export const createUsosOAuth = ({ consumerKey, consumerSecret }: UsosOAuthCredentials): OAuth => {
  return new OAuth({
    consumer: { key: consumerKey, secret: consumerSecret },
    signature_method: 'HMAC-SHA1',
    hash_function(baseString: string, key: string) {
      return crypto.createHmac('sha1', key).update(baseString).digest('base64');
    }
  });
}

export const parseOAuthFormResponse = (text: string): Record<string, string> => {
  return Object.fromEntries(new URLSearchParams(text));
}