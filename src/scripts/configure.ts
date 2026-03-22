import dotenv from 'dotenv';
import prompts from 'prompts';
import { getRuntimeConfigPath, loadRuntimeConfigIfExists, saveRuntimeConfig } from '../config-store.js';
import { runUsosAuthInteractive } from './usos-auth.js';
import { runGoogleAuthInteractive } from './google-auth.js';

dotenv.config();

const main = async () => {
  const existing = loadRuntimeConfigIfExists();

  console.log('\nUSOS Sync configuration wizard\n');
  console.log('Step 1/3: USOS authorization');
  const usos = await runUsosAuthInteractive();

  if (!usos.accessToken || !usos.accessTokenSecret) {
    throw new Error('USOS authorization did not return access tokens.');
  }

  console.log('\nStep 2/3: Google authorization');
  const google = await runGoogleAuthInteractive();

  if (!google.refreshToken) {
    throw new Error('Google authorization did not return refresh token.');
  }

  console.log('\nStep 3/3: Calendar selection');
  const defaultCalendarId = existing?.google.calendarId || 'primary';
  const calendarAnswer = await prompts(
    {
      type: 'text',
      name: 'calendarId',
      message: 'Google calendar ID',
      initial: defaultCalendarId
    },
    {
      onCancel: () => {
        throw new Error('Configuration canceled by user.');
      }
    }
  );

  const calendarId = String(calendarAnswer.calendarId || defaultCalendarId).trim() || defaultCalendarId;

  await saveRuntimeConfig({
    usos: {
      accessToken: usos.accessToken,
      accessTokenSecret: usos.accessTokenSecret
    },
    google: {
      refreshToken: google.refreshToken,
      calendarId
    }
  });

  console.log(`\nConfiguration saved: ${getRuntimeConfigPath()}`);
  console.log('Now you can run: pnpm sync:once\n');
}

main().catch((error: unknown) => {
  const message = (error as { message?: string }).message || error;
  console.error('\nConfigure failed:', message);
  process.exit(1);
});