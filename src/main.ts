import cron from 'node-cron';
import { config } from './config.js';
import { UsosClient } from './usos-client.js';
import { createGoogleCalendarClient } from './google-client.js';
import { runSync } from './sync.js';
import { formatError } from './error-utils.js';

const createServices = () => {
  const usosClient = new UsosClient({
    baseUrl: config.usos.baseUrl,
    consumerKey: config.usos.consumerKey,
    consumerSecret: config.usos.consumerSecret,
    accessToken: config.usos.accessToken,
    accessTokenSecret: config.usos.accessTokenSecret
  });

  const calendar = createGoogleCalendarClient({
    clientId: config.google.clientId,
    clientSecret: config.google.clientSecret,
    refreshToken: config.google.refreshToken
  });

  return { usosClient, calendar };
}

const executeSync = async () => {
  const { usosClient, calendar } = createServices();
  const result = await runSync({ usosClient, calendar, config });

  console.log(
    `[SYNC OK] range=${result.rangeStart}..${result.rangeEndExclusive} fetched=${result.fetched} unique=${result.unique} created=${result.created} updated=${result.updated} deleted=${result.deleted} finishedAt=${result.finishedAt}`
  );
}

const main = async () => {
  const runOnce = process.argv.includes('--once');

  if (runOnce) {
    await executeSync();
    return;
  }

  await executeSync();

  cron.schedule(
    config.app.cron,
    async () => {
      try {
        await executeSync();
      } catch (error: unknown) {
        console.error('[SYNC ERROR]', formatError(error));
      }
    },
    {
      timezone: config.app.timezone
    }
  );

  console.log(`[SCHEDULER] running with cron="${config.app.cron}" timezone="${config.app.timezone}"`);
}

main().catch((error: unknown) => {
  console.error('[FATAL]', formatError(error));
  process.exit(1);
});
