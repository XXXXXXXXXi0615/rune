import type { SolarTermName } from './solarTerms';

export interface SolarTermReferenceFixture {
  year: number;
  term: SolarTermName;
  longitudeDegrees: number;
  referenceInstant: string;
  referenceTimezone: 'UTC';
  sourceNote: string;
}

/** Independent apparent-geocentric-longitude fixtures; see CALENDAR_ACCURACY_REPORT.md. */
export const SOLAR_TERM_REFERENCE_FIXTURES: readonly SolarTermReferenceFixture[] = [
  {
    "year": 1901,
    "term": "小寒",
    "longitudeDegrees": 285,
    "referenceInstant": "1901-01-05T23:53:21.613Z",
    "referenceTimezone": "UTC",
    "sourceNote": "Swiss Ephemeris 2.10.03 Moshier apparent geocentric Sun; independent benchmark reference. HKO defines terms by 15-degree apparent solar longitude."
  },
  {
    "year": 1901,
    "term": "立春",
    "longitudeDegrees": 315,
    "referenceInstant": "1901-02-04T11:39:50.078Z",
    "referenceTimezone": "UTC",
    "sourceNote": "Swiss Ephemeris 2.10.03 Moshier apparent geocentric Sun; independent benchmark reference. HKO defines terms by 15-degree apparent solar longitude."
  },
  {
    "year": 1901,
    "term": "驚蟄",
    "longitudeDegrees": 345,
    "referenceInstant": "1901-03-06T06:10:50.430Z",
    "referenceTimezone": "UTC",
    "sourceNote": "Swiss Ephemeris 2.10.03 Moshier apparent geocentric Sun; independent benchmark reference. HKO defines terms by 15-degree apparent solar longitude."
  },
  {
    "year": 1901,
    "term": "清明",
    "longitudeDegrees": 15,
    "referenceInstant": "1901-04-05T11:44:19.201Z",
    "referenceTimezone": "UTC",
    "sourceNote": "Swiss Ephemeris 2.10.03 Moshier apparent geocentric Sun; independent benchmark reference. HKO defines terms by 15-degree apparent solar longitude."
  },
  {
    "year": 1901,
    "term": "立夏",
    "longitudeDegrees": 45,
    "referenceInstant": "1901-05-06T05:50:22.471Z",
    "referenceTimezone": "UTC",
    "sourceNote": "Swiss Ephemeris 2.10.03 Moshier apparent geocentric Sun; independent benchmark reference. HKO defines terms by 15-degree apparent solar longitude."
  },
  {
    "year": 1901,
    "term": "芒種",
    "longitudeDegrees": 75,
    "referenceInstant": "1901-06-06T10:36:26.706Z",
    "referenceTimezone": "UTC",
    "sourceNote": "Swiss Ephemeris 2.10.03 Moshier apparent geocentric Sun; independent benchmark reference. HKO defines terms by 15-degree apparent solar longitude."
  },
  {
    "year": 1901,
    "term": "小暑",
    "longitudeDegrees": 105,
    "referenceInstant": "1901-07-07T21:07:34.262Z",
    "referenceTimezone": "UTC",
    "sourceNote": "Swiss Ephemeris 2.10.03 Moshier apparent geocentric Sun; independent benchmark reference. HKO defines terms by 15-degree apparent solar longitude."
  },
  {
    "year": 1901,
    "term": "立秋",
    "longitudeDegrees": 135,
    "referenceInstant": "1901-08-08T06:46:05.840Z",
    "referenceTimezone": "UTC",
    "sourceNote": "Swiss Ephemeris 2.10.03 Moshier apparent geocentric Sun; independent benchmark reference. HKO defines terms by 15-degree apparent solar longitude."
  },
  {
    "year": 1901,
    "term": "白露",
    "longitudeDegrees": 165,
    "referenceInstant": "1901-09-08T09:10:14.298Z",
    "referenceTimezone": "UTC",
    "sourceNote": "Swiss Ephemeris 2.10.03 Moshier apparent geocentric Sun; independent benchmark reference. HKO defines terms by 15-degree apparent solar longitude."
  },
  {
    "year": 1901,
    "term": "寒露",
    "longitudeDegrees": 195,
    "referenceInstant": "1901-10-09T00:06:27.376Z",
    "referenceTimezone": "UTC",
    "sourceNote": "Swiss Ephemeris 2.10.03 Moshier apparent geocentric Sun; independent benchmark reference. HKO defines terms by 15-degree apparent solar longitude."
  },
  {
    "year": 1901,
    "term": "立冬",
    "longitudeDegrees": 225,
    "referenceInstant": "1901-11-08T02:34:28.596Z",
    "referenceTimezone": "UTC",
    "sourceNote": "Swiss Ephemeris 2.10.03 Moshier apparent geocentric Sun; independent benchmark reference. HKO defines terms by 15-degree apparent solar longitude."
  },
  {
    "year": 1901,
    "term": "大雪",
    "longitudeDegrees": 255,
    "referenceInstant": "1901-12-07T18:52:36.044Z",
    "referenceTimezone": "UTC",
    "sourceNote": "Swiss Ephemeris 2.10.03 Moshier apparent geocentric Sun; independent benchmark reference. HKO defines terms by 15-degree apparent solar longitude."
  },
  {
    "year": 1950,
    "term": "小寒",
    "longitudeDegrees": 285,
    "referenceInstant": "1950-01-05T21:38:42.501Z",
    "referenceTimezone": "UTC",
    "sourceNote": "Swiss Ephemeris 2.10.03 Moshier apparent geocentric Sun; independent benchmark reference. HKO defines terms by 15-degree apparent solar longitude."
  },
  {
    "year": 1950,
    "term": "立春",
    "longitudeDegrees": 315,
    "referenceInstant": "1950-02-04T09:20:45.095Z",
    "referenceTimezone": "UTC",
    "sourceNote": "Swiss Ephemeris 2.10.03 Moshier apparent geocentric Sun; independent benchmark reference. HKO defines terms by 15-degree apparent solar longitude."
  },
  {
    "year": 1950,
    "term": "驚蟄",
    "longitudeDegrees": 345,
    "referenceInstant": "1950-03-06T03:35:25.962Z",
    "referenceTimezone": "UTC",
    "sourceNote": "Swiss Ephemeris 2.10.03 Moshier apparent geocentric Sun; independent benchmark reference. HKO defines terms by 15-degree apparent solar longitude."
  },
  {
    "year": 1950,
    "term": "清明",
    "longitudeDegrees": 15,
    "referenceInstant": "1950-04-05T08:44:26.658Z",
    "referenceTimezone": "UTC",
    "sourceNote": "Swiss Ephemeris 2.10.03 Moshier apparent geocentric Sun; independent benchmark reference. HKO defines terms by 15-degree apparent solar longitude."
  },
  {
    "year": 1950,
    "term": "立夏",
    "longitudeDegrees": 45,
    "referenceInstant": "1950-05-06T02:24:39.382Z",
    "referenceTimezone": "UTC",
    "sourceNote": "Swiss Ephemeris 2.10.03 Moshier apparent geocentric Sun; independent benchmark reference. HKO defines terms by 15-degree apparent solar longitude."
  },
  {
    "year": 1950,
    "term": "芒種",
    "longitudeDegrees": 75,
    "referenceInstant": "1950-06-06T06:50:58.485Z",
    "referenceTimezone": "UTC",
    "sourceNote": "Swiss Ephemeris 2.10.03 Moshier apparent geocentric Sun; independent benchmark reference. HKO defines terms by 15-degree apparent solar longitude."
  },
  {
    "year": 1950,
    "term": "小暑",
    "longitudeDegrees": 105,
    "referenceInstant": "1950-07-07T17:13:16.771Z",
    "referenceTimezone": "UTC",
    "sourceNote": "Swiss Ephemeris 2.10.03 Moshier apparent geocentric Sun; independent benchmark reference. HKO defines terms by 15-degree apparent solar longitude."
  },
  {
    "year": 1950,
    "term": "立秋",
    "longitudeDegrees": 135,
    "referenceInstant": "1950-08-08T02:55:11.727Z",
    "referenceTimezone": "UTC",
    "sourceNote": "Swiss Ephemeris 2.10.03 Moshier apparent geocentric Sun; independent benchmark reference. HKO defines terms by 15-degree apparent solar longitude."
  },
  {
    "year": 1950,
    "term": "白露",
    "longitudeDegrees": 165,
    "referenceInstant": "1950-09-08T05:33:40.105Z",
    "referenceTimezone": "UTC",
    "sourceNote": "Swiss Ephemeris 2.10.03 Moshier apparent geocentric Sun; independent benchmark reference. HKO defines terms by 15-degree apparent solar longitude."
  },
  {
    "year": 1950,
    "term": "寒露",
    "longitudeDegrees": 195,
    "referenceInstant": "1950-10-08T20:51:38.946Z",
    "referenceTimezone": "UTC",
    "sourceNote": "Swiss Ephemeris 2.10.03 Moshier apparent geocentric Sun; independent benchmark reference. HKO defines terms by 15-degree apparent solar longitude."
  },
  {
    "year": 1950,
    "term": "立冬",
    "longitudeDegrees": 225,
    "referenceInstant": "1950-11-07T23:43:42.750Z",
    "referenceTimezone": "UTC",
    "sourceNote": "Swiss Ephemeris 2.10.03 Moshier apparent geocentric Sun; independent benchmark reference. HKO defines terms by 15-degree apparent solar longitude."
  },
  {
    "year": 1950,
    "term": "大雪",
    "longitudeDegrees": 255,
    "referenceInstant": "1950-12-07T16:21:39.811Z",
    "referenceTimezone": "UTC",
    "sourceNote": "Swiss Ephemeris 2.10.03 Moshier apparent geocentric Sun; independent benchmark reference. HKO defines terms by 15-degree apparent solar longitude."
  },
  {
    "year": 1984,
    "term": "小寒",
    "longitudeDegrees": 285,
    "referenceInstant": "1984-01-06T03:40:51.515Z",
    "referenceTimezone": "UTC",
    "sourceNote": "Swiss Ephemeris 2.10.03 Moshier apparent geocentric Sun; independent benchmark reference. HKO defines terms by 15-degree apparent solar longitude."
  },
  {
    "year": 1984,
    "term": "立春",
    "longitudeDegrees": 315,
    "referenceInstant": "1984-02-04T15:18:44.697Z",
    "referenceTimezone": "UTC",
    "sourceNote": "Swiss Ephemeris 2.10.03 Moshier apparent geocentric Sun; independent benchmark reference. HKO defines terms by 15-degree apparent solar longitude."
  },
  {
    "year": 1984,
    "term": "驚蟄",
    "longitudeDegrees": 345,
    "referenceInstant": "1984-03-05T09:24:38.843Z",
    "referenceTimezone": "UTC",
    "sourceNote": "Swiss Ephemeris 2.10.03 Moshier apparent geocentric Sun; independent benchmark reference. HKO defines terms by 15-degree apparent solar longitude."
  },
  {
    "year": 1984,
    "term": "清明",
    "longitudeDegrees": 15,
    "referenceInstant": "1984-04-04T14:22:19.266Z",
    "referenceTimezone": "UTC",
    "sourceNote": "Swiss Ephemeris 2.10.03 Moshier apparent geocentric Sun; independent benchmark reference. HKO defines terms by 15-degree apparent solar longitude."
  },
  {
    "year": 1984,
    "term": "立夏",
    "longitudeDegrees": 45,
    "referenceInstant": "1984-05-05T07:50:56.885Z",
    "referenceTimezone": "UTC",
    "sourceNote": "Swiss Ephemeris 2.10.03 Moshier apparent geocentric Sun; independent benchmark reference. HKO defines terms by 15-degree apparent solar longitude."
  },
  {
    "year": 1984,
    "term": "芒種",
    "longitudeDegrees": 75,
    "referenceInstant": "1984-06-05T12:08:36.884Z",
    "referenceTimezone": "UTC",
    "sourceNote": "Swiss Ephemeris 2.10.03 Moshier apparent geocentric Sun; independent benchmark reference. HKO defines terms by 15-degree apparent solar longitude."
  },
  {
    "year": 1984,
    "term": "小暑",
    "longitudeDegrees": 105,
    "referenceInstant": "1984-07-06T22:29:06.590Z",
    "referenceTimezone": "UTC",
    "sourceNote": "Swiss Ephemeris 2.10.03 Moshier apparent geocentric Sun; independent benchmark reference. HKO defines terms by 15-degree apparent solar longitude."
  },
  {
    "year": 1984,
    "term": "立秋",
    "longitudeDegrees": 135,
    "referenceInstant": "1984-08-07T08:17:52.627Z",
    "referenceTimezone": "UTC",
    "sourceNote": "Swiss Ephemeris 2.10.03 Moshier apparent geocentric Sun; independent benchmark reference. HKO defines terms by 15-degree apparent solar longitude."
  },
  {
    "year": 1984,
    "term": "白露",
    "longitudeDegrees": 165,
    "referenceInstant": "1984-09-07T11:09:49.418Z",
    "referenceTimezone": "UTC",
    "sourceNote": "Swiss Ephemeris 2.10.03 Moshier apparent geocentric Sun; independent benchmark reference. HKO defines terms by 15-degree apparent solar longitude."
  },
  {
    "year": 1984,
    "term": "寒露",
    "longitudeDegrees": 195,
    "referenceInstant": "1984-10-08T02:42:35.710Z",
    "referenceTimezone": "UTC",
    "sourceNote": "Swiss Ephemeris 2.10.03 Moshier apparent geocentric Sun; independent benchmark reference. HKO defines terms by 15-degree apparent solar longitude."
  },
  {
    "year": 1984,
    "term": "立冬",
    "longitudeDegrees": 225,
    "referenceInstant": "1984-11-07T05:45:32.627Z",
    "referenceTimezone": "UTC",
    "sourceNote": "Swiss Ephemeris 2.10.03 Moshier apparent geocentric Sun; independent benchmark reference. HKO defines terms by 15-degree apparent solar longitude."
  },
  {
    "year": 1984,
    "term": "大雪",
    "longitudeDegrees": 255,
    "referenceInstant": "1984-12-06T22:28:02.650Z",
    "referenceTimezone": "UTC",
    "sourceNote": "Swiss Ephemeris 2.10.03 Moshier apparent geocentric Sun; independent benchmark reference. HKO defines terms by 15-degree apparent solar longitude."
  },
  {
    "year": 2000,
    "term": "小寒",
    "longitudeDegrees": 285,
    "referenceInstant": "2000-01-06T01:00:40.922Z",
    "referenceTimezone": "UTC",
    "sourceNote": "Swiss Ephemeris 2.10.03 Moshier apparent geocentric Sun; independent benchmark reference. HKO defines terms by 15-degree apparent solar longitude."
  },
  {
    "year": 2000,
    "term": "立春",
    "longitudeDegrees": 315,
    "referenceInstant": "2000-02-04T12:40:22.879Z",
    "referenceTimezone": "UTC",
    "sourceNote": "Swiss Ephemeris 2.10.03 Moshier apparent geocentric Sun; independent benchmark reference. HKO defines terms by 15-degree apparent solar longitude."
  },
  {
    "year": 2000,
    "term": "驚蟄",
    "longitudeDegrees": 345,
    "referenceInstant": "2000-03-05T06:42:39.517Z",
    "referenceTimezone": "UTC",
    "sourceNote": "Swiss Ephemeris 2.10.03 Moshier apparent geocentric Sun; independent benchmark reference. HKO defines terms by 15-degree apparent solar longitude."
  },
  {
    "year": 2000,
    "term": "清明",
    "longitudeDegrees": 15,
    "referenceInstant": "2000-04-04T11:31:58.602Z",
    "referenceTimezone": "UTC",
    "sourceNote": "Swiss Ephemeris 2.10.03 Moshier apparent geocentric Sun; independent benchmark reference. HKO defines terms by 15-degree apparent solar longitude."
  },
  {
    "year": 2000,
    "term": "立夏",
    "longitudeDegrees": 45,
    "referenceInstant": "2000-05-05T04:50:09.805Z",
    "referenceTimezone": "UTC",
    "sourceNote": "Swiss Ephemeris 2.10.03 Moshier apparent geocentric Sun; independent benchmark reference. HKO defines terms by 15-degree apparent solar longitude."
  },
  {
    "year": 2000,
    "term": "芒種",
    "longitudeDegrees": 75,
    "referenceInstant": "2000-06-05T08:58:33.652Z",
    "referenceTimezone": "UTC",
    "sourceNote": "Swiss Ephemeris 2.10.03 Moshier apparent geocentric Sun; independent benchmark reference. HKO defines terms by 15-degree apparent solar longitude."
  },
  {
    "year": 2000,
    "term": "小暑",
    "longitudeDegrees": 105,
    "referenceInstant": "2000-07-06T19:13:55.882Z",
    "referenceTimezone": "UTC",
    "sourceNote": "Swiss Ephemeris 2.10.03 Moshier apparent geocentric Sun; independent benchmark reference. HKO defines terms by 15-degree apparent solar longitude."
  },
  {
    "year": 2000,
    "term": "立秋",
    "longitudeDegrees": 135,
    "referenceInstant": "2000-08-07T05:02:58.296Z",
    "referenceTimezone": "UTC",
    "sourceNote": "Swiss Ephemeris 2.10.03 Moshier apparent geocentric Sun; independent benchmark reference. HKO defines terms by 15-degree apparent solar longitude."
  },
  {
    "year": 2000,
    "term": "白露",
    "longitudeDegrees": 165,
    "referenceInstant": "2000-09-07T07:59:08.613Z",
    "referenceTimezone": "UTC",
    "sourceNote": "Swiss Ephemeris 2.10.03 Moshier apparent geocentric Sun; independent benchmark reference. HKO defines terms by 15-degree apparent solar longitude."
  },
  {
    "year": 2000,
    "term": "寒露",
    "longitudeDegrees": 195,
    "referenceInstant": "2000-10-07T23:38:11.564Z",
    "referenceTimezone": "UTC",
    "sourceNote": "Swiss Ephemeris 2.10.03 Moshier apparent geocentric Sun; independent benchmark reference. HKO defines terms by 15-degree apparent solar longitude."
  },
  {
    "year": 2000,
    "term": "立冬",
    "longitudeDegrees": 225,
    "referenceInstant": "2000-11-07T02:48:02.838Z",
    "referenceTimezone": "UTC",
    "sourceNote": "Swiss Ephemeris 2.10.03 Moshier apparent geocentric Sun; independent benchmark reference. HKO defines terms by 15-degree apparent solar longitude."
  },
  {
    "year": 2000,
    "term": "大雪",
    "longitudeDegrees": 255,
    "referenceInstant": "2000-12-06T19:37:01.849Z",
    "referenceTimezone": "UTC",
    "sourceNote": "Swiss Ephemeris 2.10.03 Moshier apparent geocentric Sun; independent benchmark reference. HKO defines terms by 15-degree apparent solar longitude."
  },
  {
    "year": 2026,
    "term": "小寒",
    "longitudeDegrees": 285,
    "referenceInstant": "2026-01-05T08:23:09.281Z",
    "referenceTimezone": "UTC",
    "sourceNote": "Swiss Ephemeris 2.10.03 Moshier apparent geocentric Sun; independent benchmark reference. HKO defines terms by 15-degree apparent solar longitude."
  },
  {
    "year": 2026,
    "term": "立春",
    "longitudeDegrees": 315,
    "referenceInstant": "2026-02-03T20:02:08.061Z",
    "referenceTimezone": "UTC",
    "sourceNote": "Swiss Ephemeris 2.10.03 Moshier apparent geocentric Sun; independent benchmark reference. HKO defines terms by 15-degree apparent solar longitude."
  },
  {
    "year": 2026,
    "term": "驚蟄",
    "longitudeDegrees": 345,
    "referenceInstant": "2026-03-05T13:58:59.879Z",
    "referenceTimezone": "UTC",
    "sourceNote": "Swiss Ephemeris 2.10.03 Moshier apparent geocentric Sun; independent benchmark reference. HKO defines terms by 15-degree apparent solar longitude."
  },
  {
    "year": 2026,
    "term": "清明",
    "longitudeDegrees": 15,
    "referenceInstant": "2026-04-04T18:40:00.068Z",
    "referenceTimezone": "UTC",
    "sourceNote": "Swiss Ephemeris 2.10.03 Moshier apparent geocentric Sun; independent benchmark reference. HKO defines terms by 15-degree apparent solar longitude."
  },
  {
    "year": 2026,
    "term": "立夏",
    "longitudeDegrees": 45,
    "referenceInstant": "2026-05-05T11:48:44.057Z",
    "referenceTimezone": "UTC",
    "sourceNote": "Swiss Ephemeris 2.10.03 Moshier apparent geocentric Sun; independent benchmark reference. HKO defines terms by 15-degree apparent solar longitude."
  },
  {
    "year": 2026,
    "term": "芒種",
    "longitudeDegrees": 75,
    "referenceInstant": "2026-06-05T15:48:22.095Z",
    "referenceTimezone": "UTC",
    "sourceNote": "Swiss Ephemeris 2.10.03 Moshier apparent geocentric Sun; independent benchmark reference. HKO defines terms by 15-degree apparent solar longitude."
  },
  {
    "year": 2026,
    "term": "小暑",
    "longitudeDegrees": 105,
    "referenceInstant": "2026-07-07T01:56:57.910Z",
    "referenceTimezone": "UTC",
    "sourceNote": "Swiss Ephemeris 2.10.03 Moshier apparent geocentric Sun; independent benchmark reference. HKO defines terms by 15-degree apparent solar longitude."
  },
  {
    "year": 2026,
    "term": "立秋",
    "longitudeDegrees": 135,
    "referenceInstant": "2026-08-07T11:42:44.825Z",
    "referenceTimezone": "UTC",
    "sourceNote": "Swiss Ephemeris 2.10.03 Moshier apparent geocentric Sun; independent benchmark reference. HKO defines terms by 15-degree apparent solar longitude."
  },
  {
    "year": 2026,
    "term": "白露",
    "longitudeDegrees": 165,
    "referenceInstant": "2026-09-07T14:41:17.370Z",
    "referenceTimezone": "UTC",
    "sourceNote": "Swiss Ephemeris 2.10.03 Moshier apparent geocentric Sun; independent benchmark reference. HKO defines terms by 15-degree apparent solar longitude."
  },
  {
    "year": 2026,
    "term": "寒露",
    "longitudeDegrees": 195,
    "referenceInstant": "2026-10-08T06:29:18.243Z",
    "referenceTimezone": "UTC",
    "sourceNote": "Swiss Ephemeris 2.10.03 Moshier apparent geocentric Sun; independent benchmark reference. HKO defines terms by 15-degree apparent solar longitude."
  },
  {
    "year": 2026,
    "term": "立冬",
    "longitudeDegrees": 225,
    "referenceInstant": "2026-11-07T09:52:04.805Z",
    "referenceTimezone": "UTC",
    "sourceNote": "Swiss Ephemeris 2.10.03 Moshier apparent geocentric Sun; independent benchmark reference. HKO defines terms by 15-degree apparent solar longitude."
  },
  {
    "year": 2026,
    "term": "大雪",
    "longitudeDegrees": 255,
    "referenceInstant": "2026-12-07T02:52:32.432Z",
    "referenceTimezone": "UTC",
    "sourceNote": "Swiss Ephemeris 2.10.03 Moshier apparent geocentric Sun; independent benchmark reference. HKO defines terms by 15-degree apparent solar longitude."
  },
  {
    "year": 2050,
    "term": "小寒",
    "longitudeDegrees": 285,
    "referenceInstant": "2050-01-05T04:07:55.898Z",
    "referenceTimezone": "UTC",
    "sourceNote": "Swiss Ephemeris 2.10.03 Moshier apparent geocentric Sun; independent benchmark reference. HKO defines terms by 15-degree apparent solar longitude."
  },
  {
    "year": 2050,
    "term": "立春",
    "longitudeDegrees": 315,
    "referenceInstant": "2050-02-03T15:43:49.511Z",
    "referenceTimezone": "UTC",
    "sourceNote": "Swiss Ephemeris 2.10.03 Moshier apparent geocentric Sun; independent benchmark reference. HKO defines terms by 15-degree apparent solar longitude."
  },
  {
    "year": 2050,
    "term": "驚蟄",
    "longitudeDegrees": 345,
    "referenceInstant": "2050-03-05T09:32:45.287Z",
    "referenceTimezone": "UTC",
    "sourceNote": "Swiss Ephemeris 2.10.03 Moshier apparent geocentric Sun; independent benchmark reference. HKO defines terms by 15-degree apparent solar longitude."
  },
  {
    "year": 2050,
    "term": "清明",
    "longitudeDegrees": 15,
    "referenceInstant": "2050-04-04T14:03:17.082Z",
    "referenceTimezone": "UTC",
    "sourceNote": "Swiss Ephemeris 2.10.03 Moshier apparent geocentric Sun; independent benchmark reference. HKO defines terms by 15-degree apparent solar longitude."
  },
  {
    "year": 2050,
    "term": "立夏",
    "longitudeDegrees": 45,
    "referenceInstant": "2050-05-05T07:02:01.970Z",
    "referenceTimezone": "UTC",
    "sourceNote": "Swiss Ephemeris 2.10.03 Moshier apparent geocentric Sun; independent benchmark reference. HKO defines terms by 15-degree apparent solar longitude."
  },
  {
    "year": 2050,
    "term": "芒種",
    "longitudeDegrees": 75,
    "referenceInstant": "2050-06-05T10:54:54.056Z",
    "referenceTimezone": "UTC",
    "sourceNote": "Swiss Ephemeris 2.10.03 Moshier apparent geocentric Sun; independent benchmark reference. HKO defines terms by 15-degree apparent solar longitude."
  },
  {
    "year": 2050,
    "term": "小暑",
    "longitudeDegrees": 105,
    "referenceInstant": "2050-07-06T21:01:57.297Z",
    "referenceTimezone": "UTC",
    "sourceNote": "Swiss Ephemeris 2.10.03 Moshier apparent geocentric Sun; independent benchmark reference. HKO defines terms by 15-degree apparent solar longitude."
  },
  {
    "year": 2050,
    "term": "立秋",
    "longitudeDegrees": 135,
    "referenceInstant": "2050-08-07T06:52:33.335Z",
    "referenceTimezone": "UTC",
    "sourceNote": "Swiss Ephemeris 2.10.03 Moshier apparent geocentric Sun; independent benchmark reference. HKO defines terms by 15-degree apparent solar longitude."
  },
  {
    "year": 2050,
    "term": "白露",
    "longitudeDegrees": 165,
    "referenceInstant": "2050-09-07T10:00:43.074Z",
    "referenceTimezone": "UTC",
    "sourceNote": "Swiss Ephemeris 2.10.03 Moshier apparent geocentric Sun; independent benchmark reference. HKO defines terms by 15-degree apparent solar longitude."
  },
  {
    "year": 2050,
    "term": "寒露",
    "longitudeDegrees": 195,
    "referenceInstant": "2050-10-08T02:00:13.861Z",
    "referenceTimezone": "UTC",
    "sourceNote": "Swiss Ephemeris 2.10.03 Moshier apparent geocentric Sun; independent benchmark reference. HKO defines terms by 15-degree apparent solar longitude."
  },
  {
    "year": 2050,
    "term": "立冬",
    "longitudeDegrees": 225,
    "referenceInstant": "2050-11-07T05:33:44.483Z",
    "referenceTimezone": "UTC",
    "sourceNote": "Swiss Ephemeris 2.10.03 Moshier apparent geocentric Sun; independent benchmark reference. HKO defines terms by 15-degree apparent solar longitude."
  },
  {
    "year": 2050,
    "term": "大雪",
    "longitudeDegrees": 255,
    "referenceInstant": "2050-12-06T22:41:51.239Z",
    "referenceTimezone": "UTC",
    "sourceNote": "Swiss Ephemeris 2.10.03 Moshier apparent geocentric Sun; independent benchmark reference. HKO defines terms by 15-degree apparent solar longitude."
  },
  {
    "year": 2100,
    "term": "小寒",
    "longitudeDegrees": 285,
    "referenceInstant": "2100-01-05T07:30:49.474Z",
    "referenceTimezone": "UTC",
    "sourceNote": "Swiss Ephemeris 2.10.03 Moshier apparent geocentric Sun; independent benchmark reference. HKO defines terms by 15-degree apparent solar longitude."
  },
  {
    "year": 2100,
    "term": "立春",
    "longitudeDegrees": 315,
    "referenceInstant": "2100-02-03T19:01:49.191Z",
    "referenceTimezone": "UTC",
    "sourceNote": "Swiss Ephemeris 2.10.03 Moshier apparent geocentric Sun; independent benchmark reference. HKO defines terms by 15-degree apparent solar longitude."
  },
  {
    "year": 2100,
    "term": "驚蟄",
    "longitudeDegrees": 345,
    "referenceInstant": "2100-03-05T12:36:05.657Z",
    "referenceTimezone": "UTC",
    "sourceNote": "Swiss Ephemeris 2.10.03 Moshier apparent geocentric Sun; independent benchmark reference. HKO defines terms by 15-degree apparent solar longitude."
  },
  {
    "year": 2100,
    "term": "清明",
    "longitudeDegrees": 15,
    "referenceInstant": "2100-04-04T16:45:22.156Z",
    "referenceTimezone": "UTC",
    "sourceNote": "Swiss Ephemeris 2.10.03 Moshier apparent geocentric Sun; independent benchmark reference. HKO defines terms by 15-degree apparent solar longitude."
  },
  {
    "year": 2100,
    "term": "立夏",
    "longitudeDegrees": 45,
    "referenceInstant": "2100-05-05T09:22:30.334Z",
    "referenceTimezone": "UTC",
    "sourceNote": "Swiss Ephemeris 2.10.03 Moshier apparent geocentric Sun; independent benchmark reference. HKO defines terms by 15-degree apparent solar longitude."
  },
  {
    "year": 2100,
    "term": "芒種",
    "longitudeDegrees": 75,
    "referenceInstant": "2100-06-05T12:59:41.606Z",
    "referenceTimezone": "UTC",
    "sourceNote": "Swiss Ephemeris 2.10.03 Moshier apparent geocentric Sun; independent benchmark reference. HKO defines terms by 15-degree apparent solar longitude."
  },
  {
    "year": 2100,
    "term": "小暑",
    "longitudeDegrees": 105,
    "referenceInstant": "2100-07-06T23:00:36.902Z",
    "referenceTimezone": "UTC",
    "sourceNote": "Swiss Ephemeris 2.10.03 Moshier apparent geocentric Sun; independent benchmark reference. HKO defines terms by 15-degree apparent solar longitude."
  },
  {
    "year": 2100,
    "term": "立秋",
    "longitudeDegrees": 135,
    "referenceInstant": "2100-08-07T08:55:38.887Z",
    "referenceTimezone": "UTC",
    "sourceNote": "Swiss Ephemeris 2.10.03 Moshier apparent geocentric Sun; independent benchmark reference. HKO defines terms by 15-degree apparent solar longitude."
  },
  {
    "year": 2100,
    "term": "白露",
    "longitudeDegrees": 165,
    "referenceInstant": "2100-09-07T12:16:51.670Z",
    "referenceTimezone": "UTC",
    "sourceNote": "Swiss Ephemeris 2.10.03 Moshier apparent geocentric Sun; independent benchmark reference. HKO defines terms by 15-degree apparent solar longitude."
  },
  {
    "year": 2100,
    "term": "寒露",
    "longitudeDegrees": 195,
    "referenceInstant": "2100-10-08T04:32:46.221Z",
    "referenceTimezone": "UTC",
    "sourceNote": "Swiss Ephemeris 2.10.03 Moshier apparent geocentric Sun; independent benchmark reference. HKO defines terms by 15-degree apparent solar longitude."
  },
  {
    "year": 2100,
    "term": "立冬",
    "longitudeDegrees": 225,
    "referenceInstant": "2100-11-07T08:21:39.210Z",
    "referenceTimezone": "UTC",
    "sourceNote": "Swiss Ephemeris 2.10.03 Moshier apparent geocentric Sun; independent benchmark reference. HKO defines terms by 15-degree apparent solar longitude."
  },
  {
    "year": 2100,
    "term": "大雪",
    "longitudeDegrees": 255,
    "referenceInstant": "2100-12-07T01:41:41.156Z",
    "referenceTimezone": "UTC",
    "sourceNote": "Swiss Ephemeris 2.10.03 Moshier apparent geocentric Sun; independent benchmark reference. HKO defines terms by 15-degree apparent solar longitude."
  }
] as const;
