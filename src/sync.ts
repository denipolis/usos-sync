import crypto from 'crypto'
import { DateTime } from 'luxon'
import { calendar_v3 } from 'googleapis'
import { parseUsosDateTime, pickLangDictValue } from './date-utils.js'
import { UsosClient } from './usos-client.js'
import {
  RunSyncParams,
  RunSyncResult,
  ToGoogleEventOptions
} from './types/sync.type.js'
import { UsosActivity } from './types/usos-client.type.js'

const buildStableSyncId = (
  activity: UsosActivity,
  preferredLang: string
): string => {
  const payload = {
    type: activity.type || '',
    start: activity.start_time || '',
    end: activity.end_time || '',
    name: pickLangDictValue(activity.name, preferredLang),
    url: activity.url || ''
  }

  const hex = crypto
    .createHash('sha256')
    .update(JSON.stringify(payload))
    .digest('hex')
  return `usos${hex.slice(0, 44)}`
}

const buildLocation = (
  activity: UsosActivity,
  preferredLang: string
): string | undefined => {
  const room = [activity.building_name, activity.room_number]
    .map(value => pickLangDictValue(value, preferredLang))
    .filter(Boolean)
    .join(' ')
    .trim()

  return room || undefined
}

const toGoogleEvent = (
  activity: UsosActivity,
  {
    timezone,
    preferredLang,
    eventId
  }: ToGoogleEventOptions
): calendar_v3.Schema$Event => {
  const start = parseUsosDateTime(activity.start_time || '', timezone)
  const end = parseUsosDateTime(activity.end_time || '', timezone)

  const summary =
    pickLangDictValue(activity.name, preferredLang) || 'USOS activity'
  const descriptionParts = [
    'Source: USOS API',
    activity.type ? `Type: ${activity.type}` : null,
    activity.url ? `USOS URL: ${activity.url}` : null
  ].filter(Boolean) as string[]

  return {
    id: eventId,
    summary,
    location: buildLocation(activity, preferredLang),
    description: descriptionParts.join('\n'),
    start: {
      dateTime: start.toISO(),
      timeZone: timezone
    },
    end: {
      dateTime: end.toISO(),
      timeZone: timezone
    },
    extendedProperties: {
      private: {
        source: 'usos-sync',
        usosSyncId: eventId,
        usosType: activity.type || ''
      }
    }
  }
}

const deleteMissingSyncedEvents = async (
  calendar: calendar_v3.Calendar,
  calendarId: string,
  timeMin: string,
  timeMax: string,
  validSyncIds: Set<string>
): Promise<number> => {
  let pageToken: string | undefined
  let deleted = 0

  do {
    const response = await calendar.events.list({
      calendarId,
      timeMin,
      timeMax,
      singleEvents: true,
      privateExtendedProperty: ['source=usos-sync'],
      maxResults: 500,
      pageToken
    })

    const pageItems = response.data.items || []
    for (const event of pageItems) {
      const syncId = event?.extendedProperties?.private?.usosSyncId
      if (!syncId) {
        continue
      }

      if (!validSyncIds.has(syncId)) {
        await calendar.events.delete({
          calendarId,
          eventId: event.id || ''
        })
        deleted += 1
      }
    }

    pageToken = response.data.nextPageToken || undefined
  } while (pageToken)

  return deleted
}

const upsertEvent = async (
  calendar: calendar_v3.Calendar,
  calendarId: string,
  eventId: string,
  eventBody: calendar_v3.Schema$Event
): Promise<'updated' | 'created'> => {
  try {
    await calendar.events.get({ calendarId, eventId })
    await calendar.events.update({
      calendarId,
      eventId,
      requestBody: eventBody
    })
    return 'updated'
  } catch (error: unknown) {
    const status = (error as { response?: { status?: number } })?.response
      ?.status
    if (status === 404) {
      await calendar.events.insert({
        calendarId,
        requestBody: eventBody
      })
      return 'created'
    }
    throw error
  }
}

export const runSync = async ({
  usosClient,
  calendar,
  config
}: RunSyncParams): Promise<RunSyncResult> => {
  const timezone = config.app.timezone
  const preferredLang = config.usos.lang
  const calendarId = config.google.calendarId

  const { thisWeekStart, nextWeekStart, rangeStart, rangeEndExclusive } =
    UsosClient.getWeekWindows(timezone)

  const [currentWeekActivities, nextWeekActivities] = await Promise.all([
    usosClient.getUserTimetable({
      startDate: thisWeekStart.toISODate() || '',
      days: 7
    }),
    usosClient.getUserTimetable({
      startDate: nextWeekStart.toISODate() || '',
      days: 7
    })
  ])

  const rawActivities = [
    ...(currentWeekActivities || []),
    ...(nextWeekActivities || [])
  ]

  const activityMap = new Map<string, UsosActivity>()
  for (const activity of rawActivities) {
    if (!activity?.start_time || !activity?.end_time) {
      continue
    }
    const syncId = buildStableSyncId(activity, preferredLang)
    activityMap.set(syncId, activity)
  }

  let created = 0
  let updated = 0

  for (const [syncId, activity] of activityMap.entries()) {
    const eventBody = toGoogleEvent(activity, {
      timezone,
      preferredLang,
      eventId: syncId
    })

    const result = await upsertEvent(calendar, calendarId, syncId, eventBody)
    if (result === 'created') created += 1
    if (result === 'updated') updated += 1
  }

  const validSyncIds = new Set(activityMap.keys())
  const deleted = await deleteMissingSyncedEvents(
    calendar,
    calendarId,
    rangeStart.toUTC().toISO() || '',
    rangeEndExclusive.toUTC().toISO() || '',
    validSyncIds
  )

  return {
    fetched: rawActivities.length,
    unique: activityMap.size,
    created,
    updated,
    deleted,
    rangeStart: rangeStart.toISODate(),
    rangeEndExclusive: rangeEndExclusive.toISODate(),
    finishedAt: DateTime.now().setZone(timezone).toISO()
  }
}
