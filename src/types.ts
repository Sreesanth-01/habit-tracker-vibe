export interface Habit {
  id: string
  name: string
  emoji: string
  color: string
  note?: string
  createdAt: string
}

export interface HabitLog {
  habitId: string
  date: string
}

export type Theme = 'dark' | 'light'
export type SortMode = 'default' | 'streak' | 'name' | 'weekly'

export interface AppSettings {
  theme: Theme
  sort: SortMode
}

export interface AppState {
  habits: Habit[]
  logs: HabitLog[]
  settings: AppSettings
}

export interface UndoSnapshot {
  habit: Habit
  logs: HabitLog[]
}
