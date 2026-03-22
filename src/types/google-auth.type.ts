export interface GoogleCredentials {
  clientId: string;
  clientSecret: string;
}

export interface CredentialsFilePayload {
  installed?: {
    client_id?: string;
    client_secret?: string;
    redirect_uris?: string[];
  };
  web?: {
    client_id?: string;
    client_secret?: string;
    redirect_uris?: string[];
  };
}

export interface GoogleAuthResult {
  refreshToken: string;
}