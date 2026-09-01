// Shared scheduling engine + types. Pure (no Host/Node-only imports) so it can be
// imported by both the Host Service (src/index.ts) and the Client bundle
// (src/client.tsx) without pulling Host-only code into the renderer.

export type RecurrencePattern = 'daily' | 'weekday' | 'weekly' | 'monthly'

export type RunMode = 'continuation' | 'standalone'

/** Old tasks without preset belong to the moyu workbench. Used by Host persist/run and Client list filter. */
export function taskPresetOf(task: { preset?: string | null }): string {
  return typeof task.preset === 'string' && task.preset.trim() ? task.preset.trim() : 'moyu'
}

export function taskRunModeOf(task: { runMode?: string | null }): RunMode {
  return task.runMode === 'continuation' ? 'continuation' : 'standalone'
}

export type ScheduleSpec =
  | { kind: 'once'; runAt: number }
  | {
      kind: 'recurring'
      pattern: RecurrencePattern
      timeOfDay: string
      weekday?: number
      dayOfMonth?: number
      timeZone: string
    }

/** Thrown by validateSchedule; carries an HTTP status for the route layer. */
export class ServiceError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly httpStatus: number = 400,
  ) {
    super(message)
    this.name = 'ServiceError'
  }
}

function daysInMonth(year: number, month0: number): number {
  return new Date(Date.UTC(year, month0 + 1, 0)).getUTCDate()
}

/** Add `n` days to a wall (year/month0/day) triple, rolling month/year. */
function addDays(year: number, month0: number, day: number, n: number): { year: number; month0: number; day: number } {
  const d = new Date(Date.UTC(year, month0, day + n))
  return { year: d.getUTCFullYear(), month0: d.getUTCMonth(), day: d.getUTCDate() }
}

/** Local wall-clock parts of a UTC instant in a given IANA timezone. */
function localParts(utcMs: number, timeZone: string): {
  year: number
  month0: number
  day: number
  weekday: number
  hour: number
  minute: number
  second: number
} {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
  const parts = dtf.formatToParts(new Date(utcMs))
  const map: Record<string, string> = {}
  for (const p of parts) if (p.type !== 'literal') map[p.type] = p.value
  const year = Number(map.year)
  const month0 = Number(map.month) - 1
  const day = Number(map.day)
  const hour = map.hour === '24' ? 0 : Number(map.hour)
  const weekdayByName: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }
  return {
    year,
    month0,
    day,
    weekday: weekdayByName[map.weekday] ?? 0,
    hour,
    minute: Number(map.minute),
    second: Number(map.second),
  }
}

/** Offset (local - utc, in ms) for a UTC instant in a timezone. */
function tzOffsetMs(utcMs: number, timeZone: string): number {
  const lp = localParts(utcMs, timeZone)
  const asLocal = Date.UTC(lp.year, lp.month0, lp.day, lp.hour, lp.minute, lp.second)
  return asLocal - utcMs
}

/**
 * Convert a local wall-clock datetime (in tz) to a UTC instant.
 *
 * A single offset lookup is wrong across DST transitions: a wall time in the
 * new offset's frame yields a UTC instant whose offset differs, shifting the
 * result by an hour. Iterate the fixed-point `U = wallAsUTC - offset(U)` until
 * it stabilises (2-3 passes).
 *
 * Edge cases (documented policy):
 * - Non-existent wall time (spring-forward gap, e.g. 02:30 on the US DST day):
 *   resolves to the post-transition local time (mapped forward).
 * - Ambiguous wall time (fall-back overlap, e.g. 01:30 occurs twice): resolves
 *   to the first (pre-transition) occurrence.
 */
function zonedWallToUtc(
  year: number,
  month0: number,
  day: number,
  hour: number,
  minute: number,
  timeZone: string,
): number {
  const wallAsUTC = Date.UTC(year, month0, day, hour, minute, 0)
  let utc = wallAsUTC
  for (let i = 0; i < 4; i++) {
    const cand = wallAsUTC - tzOffsetMs(utc, timeZone)
    if (cand === utc) break
    utc = cand
  }
  return utc
}

function parseHHmm(value: string): { h: number; m: number } | null {
  const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value)
  if (!m) return null
  return { h: Number(m[1]), m: Number(m[2]) }
}

/** Next future occurrence (strictly after `after`) for a schedule, or null. */
export function computeNextRun(spec: ScheduleSpec, after: number): number | null {
  if (spec.kind === 'once') return spec.runAt > after ? spec.runAt : null
  const parsed = parseHHmm(spec.timeOfDay)
  if (!parsed) return null
  const tz = spec.timeZone
  const start = localParts(after, tz)
  let { year, month0, day } = start
  for (let i = 0; i < 800; i++) {
    const weekday = new Date(Date.UTC(year, month0, day)).getUTCDay()
    let matches = false
    if (spec.pattern === 'daily') matches = true
    else if (spec.pattern === 'weekday') matches = weekday >= 1 && weekday <= 5
    else if (spec.pattern === 'weekly') matches = weekday === (spec.weekday ?? weekday)
    else if (spec.pattern === 'monthly') {
      const target = Math.min(spec.dayOfMonth ?? day, daysInMonth(year, month0))
      matches = day === target
    }
    if (matches) {
      const cand = zonedWallToUtc(year, month0, day, parsed.h, parsed.m, tz)
      if (cand > after) return cand
    }
    const next = addDays(year, month0, day, 1)
    year = next.year
    month0 = next.month0
    day = next.day
  }
  return null
}

/** Validate a schedule spec; throws ServiceError on malformed input. */
export function validateSchedule(spec: ScheduleSpec): void {
  if (spec.kind === 'once') {
    if (!Number.isFinite(spec.runAt)) {
      throw new ServiceError('invalid_schedule', 'once.runAt must be a finite number', 400)
    }
    return
  }
  if (!['daily', 'weekday', 'weekly', 'monthly'].includes(spec.pattern)) {
    throw new ServiceError('invalid_schedule', 'recurring.pattern must be daily|weekday|weekly|monthly', 400)
  }
  if (!parseHHmm(spec.timeOfDay)) {
    throw new ServiceError('invalid_schedule', 'recurring.timeOfDay must be HH:mm (24h)', 400)
  }
  if (spec.pattern === 'weekly' && !(spec.weekday! >= 0 && spec.weekday! <= 6)) {
    throw new ServiceError('invalid_schedule', 'recurring.weekday must be 0-6 for weekly', 400)
  }
  if (spec.pattern === 'monthly' && !(spec.dayOfMonth! >= 1 && spec.dayOfMonth! <= 31)) {
    throw new ServiceError('invalid_schedule', 'recurring.dayOfMonth must be 1-31 for monthly', 400)
  }
  if (typeof spec.timeZone !== 'string' || spec.timeZone.length === 0) {
    throw new ServiceError('invalid_schedule', 'recurring.timeZone is required', 400)
  }
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: spec.timeZone })
  } catch {
    throw new ServiceError('invalid_schedule', `invalid IANA timezone: ${spec.timeZone}`, 400)
  }
}

const WEEKDAY_LABELS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']

/** Human-readable label for a schedule (Chinese), used in the Client UI. */
export function describeSchedule(spec: ScheduleSpec): string {
  if (spec.kind === 'once') {
    return `一次性 · ${new Date(spec.runAt).toLocaleString()}`
  }
  const time = spec.timeOfDay
  switch (spec.pattern) {
    case 'daily':
      return `每天 ${time}`
    case 'weekday':
      return `工作日 ${time}`
    case 'weekly':
      return `每${WEEKDAY_LABELS[spec.weekday ?? 1]} ${time}`
    case 'monthly':
      return `每月${spec.dayOfMonth ?? 1}日 ${time}`
  }
}

/** Next run timestamp for a spec (or null), for the Client's preview line. */
export function previewNextRun(spec: ScheduleSpec, from: number = Date.now()): number | null {
  return computeNextRun(spec, from)
}
