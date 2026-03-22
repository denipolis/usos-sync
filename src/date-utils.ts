import { DateTime } from 'luxon';
import { LangDict } from './types/lang-dict.type.js';

export const parseUsosDateTime = (value: string, timezone: string): DateTime => {
  return DateTime.fromFormat(value, 'yyyy-MM-dd HH:mm:ss', { zone: timezone });
}

export const pickLangDictValue = (langDict: LangDict, preferredLang = 'pl'): string => {
  if (langDict == null) {
    return '';
  }

  if (typeof langDict === 'string') {
    return langDict;
  }

  return (
    langDict[preferredLang] ||
    langDict.pl ||
    langDict.en ||
    Object.values(langDict).find((item) => typeof item === 'string') ||
    ''
  );
}