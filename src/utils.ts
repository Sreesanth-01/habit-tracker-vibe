import type { AppState, AppSettings, Habit, HabitLog, SortMode } from './types'

const STORAGE_KEY = 'habit-tracker-state'

export const HABIT_COLORS = [
  '#6366f1',
  '#8b5cf6',
  '#ec4899',
  '#f43f5e',
  '#f97316',
  '#eab308',
  '#22c55e',
  '#14b8a6',
  '#06b6d4',
  '#3b82f6',
] as const

export const HABIT_EMOJIS = [
  '💪', '📚', '💧', '🧘', '🏃', '😴', '🥗', '✍️', '🎸', '🧹',
  '☕', '🧠', '💊', '🚶', '📵',
] as const

export const HABIT_PRESETS = [
  { name: 'Morning workout', emoji: '💪', color: '#f97316' },
  { name: 'Read 20 minutes', emoji: '📚', color: '#6366f1' },
  { name: 'Drink water', emoji: '💧', color: '#06b6d4' },
  { name: 'Meditate', emoji: '🧘', color: '#8b5cf6' },
  { name: 'No phone before bed', emoji: '📵', color: '#ec4899' },
] as const

export const QUOTES = [
  'Small steps every day lead to big changes.',
  'You don\'t have to be perfect — just consistent.',
  'Discipline is choosing what you want most over what you want now.',
  'The secret of your future is hidden in your daily routine.',
  'Progress, not perfection.',
  'Show up for yourself today.',
  'A little progress each day adds up.',
] as const

const DEFAULT_SETTINGS: AppSettings = { theme: 'dark', sort: 'default' }

export function todayKey(): string {
  return formatDateKey(new Date())
}

export function formatDateKey(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function parseDateKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function getLastNDays(n: number, from = new Date()): string[] {
  const days: string[] = []
  const anchor = new Date(from)
  anchor.setHours(0, 0, 0, 0)
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(anchor)
    d.setDate(anchor.getDate() - i)
    days.push(formatDateKey(d))
  }
  return days
}

export function getMonthDays(year: number, month: number): string[] {
  const days: string[] = []
  const last = new Date(year, month + 1, 0).getDate()
  for (let d = 1; d <= last; d++) {
    days.push(formatDateKey(new Date(year, month, d)))
  }
  return days
}

export function dayLabel(key: string): string {
  const date = parseDateKey(key)
  const today = todayKey()
  if (key === today) return 'Today'
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  if (key === formatDateKey(yesterday)) return 'Yesterday'
  return date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
}

export function dailyQuote(): string {
  const start = new Date(new Date().getFullYear(), 0, 0)
  const dayOfYear = Math.floor((Date.now() - start.getTime()) / 86400000)
  return QUOTES[dayOfYear % QUOTES.length]
}

export function loadState(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { habits: [], logs: [], settings: { ...DEFAULT_SETTINGS } }
    const parsed = JSON.parse(raw) as Partial<AppState>
    return {
      habits: Array.isArray(parsed.habits) ? parsed.habits.map(normalizeHabit) : [],
      logs: Array.isArray(parsed.logs) ? parsed.logs : [],
      settings: { ...DEFAULT_SETTINGS, ...parsed.settings },
    }
  } catch {
    return { habits: [], logs: [], settings: { ...DEFAULT_SETTINGS } }
  }
}

function normalizeHabit(h: Habit): Habit {
  return {
    id: h.id,
    name: h.name,
    emoji: h.emoji,
    color: h.color,
    note: h.note,
    createdAt: h.createdAt,
  }
}

export function saveState(state: AppState): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
}

export function isCompleted(logs: HabitLog[], habitId: string, date: string): boolean {
  return logs.some((l) => l.habitId === habitId && l.date === date)
}

export function toggleLog(state: AppState, habitId: string, date: string): AppState {
  const exists = isCompleted(state.logs, habitId, date)
  const logs = exists
    ? state.logs.filter((l) => !(l.habitId === habitId && l.date === date))
    : [...state.logs, { habitId, date }]
  return { ...state, logs }
}

export function calcStreak(logs: HabitLog[], habitId: string): number {
  let streak = 0
  const cursor = new Date()
  cursor.setHours(0, 0, 0, 0)

  const today = formatDateKey(cursor)
  if (!isCompleted(logs, habitId, today)) {
    cursor.setDate(cursor.getDate() - 1)
  }

  while (isCompleted(logs, habitId, formatDateKey(cursor))) {
    streak++
    cursor.setDate(cursor.getDate() - 1)
  }
  return streak
}

export function calcBestStreak(logs: HabitLog[], habitId: string): number {
  const dates = [...new Set(logs.filter((l) => l.habitId === habitId).map((l) => l.date))].sort()
  if (dates.length === 0) return 0

  let best = 1
  let current = 1
  for (let i = 1; i < dates.length; i++) {
    const prev = parseDateKey(dates[i - 1])
    const curr = parseDateKey(dates[i])
    const diff = (curr.getTime() - prev.getTime()) / 86400000
    if (diff === 1) {
      current++
      best = Math.max(best, current)
    } else {
      current = 1
    }
  }
  return best
}

export function completionRate(logs: HabitLog[], habitId: string, days: string[]): number {
  if (days.length === 0) return 0
  const done = days.filter((d) => isCompleted(logs, habitId, d)).length
  return Math.round((done / days.length) * 100)
}

export function todayProgress(state: AppState): { done: number; total: number } {
  const today = todayKey()
  const total = state.habits.length
  const done = state.habits.filter((h) => isCompleted(state.logs, h.id, today)).length
  return { done, total }
}

export function dayCompletionPercent(state: AppState, date: string): number {
  if (state.habits.length === 0) return 0
  const done = state.habits.filter((h) => isCompleted(state.logs, h.id, date)).length
  return Math.round((done / state.habits.length) * 100)
}

export function weeklyStats(state: AppState): {
  completions: number
  possible: number
  bestStreak: number
  perfectDays: number
} {
  const days = getLastNDays(7)
  let completions = 0
  let perfectDays = 0
  let bestStreak = 0

  for (const habit of state.habits) {
    completions += days.filter((d) => isCompleted(state.logs, habit.id, d)).length
    bestStreak = Math.max(bestStreak, calcStreak(state.logs, habit.id))
  }

  for (const day of days) {
    if (dayCompletionPercent(state, day) === 100 && state.habits.length > 0) perfectDays++
  }

  return {
    completions,
    possible: state.habits.length * 7,
    bestStreak,
    perfectDays,
  }
}

export function sortHabits(habits: Habit[], logs: HabitLog[], mode: SortMode): Habit[] {
  const copy = [...habits]
  const week = getLastNDays(7)
  switch (mode) {
    case 'name':
      return copy.sort((a, b) => a.name.localeCompare(b.name))
    case 'streak':
      return copy.sort((a, b) => calcStreak(logs, b.id) - calcStreak(logs, a.id))
    case 'weekly':
      return copy.sort(
        (a, b) => completionRate(logs, b.id, week) - completionRate(logs, a.id, week),
      )
    default:
      return copy
  }
}

export function createHabit(
  name: string,
  emoji: string,
  color: string,
  note?: string,
): Habit {
  return {
    id: crypto.randomUUID(),
    name: name.trim(),
    emoji,
    color,
    note: note?.trim() || undefined,
    createdAt: new Date().toISOString(),
  }
}

export function updateHabit(habit: Habit, patch: Partial<Pick<Habit, 'name' | 'emoji' | 'color' | 'note'>>): Habit {
  return {
    ...habit,
    name: patch.name?.trim() ?? habit.name,
    emoji: patch.emoji ?? habit.emoji,
    color: patch.color ?? habit.color,
    note: patch.note !== undefined ? patch.note.trim() || undefined : habit.note,
  }
}

export function exportData(state: AppState): string {
  return JSON.stringify(state, null, 2)
}

export function importData(json: string): AppState {
  const parsed = JSON.parse(json) as Partial<AppState>
  if (!Array.isArray(parsed.habits) || !Array.isArray(parsed.logs)) {
    throw new Error('Invalid backup file')
  }
  return {
    habits: parsed.habits.map(normalizeHabit),
    logs: parsed.logs,
    settings: { ...DEFAULT_SETTINGS, ...parsed.settings },
  }
}

export function moveHabit(habits: Habit[], id: string, direction: -1 | 1): Habit[] {
  const idx = habits.findIndex((h) => h.id === id)
  if (idx < 0) return habits
  const next = idx + direction
  if (next < 0 || next >= habits.length) return habits
  const copy = [...habits]
  ;[copy[idx], copy[next]] = [copy[next], copy[idx]]
  return copy
}
