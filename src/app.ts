import { burstConfetti } from './confetti'
import { showToast } from './toast'
import type { AppState, Habit, SortMode, Theme, UndoSnapshot } from './types'
import {
  HABIT_COLORS,
  HABIT_EMOJIS,
  HABIT_PRESETS,
  calcBestStreak,
  calcStreak,
  completionRate,
  createHabit,
  dailyQuote,
  dayCompletionPercent,
  dayLabel,
  exportData,
  getLastNDays,
  getMonthDays,
  importData,
  isCompleted,
  loadState,
  moveHabit,
  parseDateKey,
  saveState,
  sortHabits,
  todayKey,
  todayProgress,
  toggleLog,
  updateHabit,
  weeklyStats,
} from './utils'

let state: AppState = loadState()
let selectedEmoji = HABIT_EMOJIS[0] as string
let selectedColor = HABIT_COLORS[0] as string
let editingHabit: Habit | null = null
let editEmoji = HABIT_EMOJIS[0] as string
let editColor = HABIT_COLORS[0] as string
let undoSnapshot: UndoSnapshot | null = null
let searchQuery = ''
let addFormOpen = state.habits.length === 0
let expandedHabitId: string | null = null
let lastAllDone = false

const root = document.getElementById('app')!

function setState(next: AppState, opts?: { skipConfetti?: boolean }): void {
  const { done, total } = todayProgress(next)
  const allDone = total > 0 && done === total

  state = next
  saveState(state)
  applyTheme(state.settings.theme)

  if (allDone && !lastAllDone && !opts?.skipConfetti) {
    burstConfetti()
  }
  lastAllDone = allDone

  render()
}

function applyTheme(theme: Theme): void {
  document.documentElement.classList.toggle('theme-light', theme === 'light')
}

function escapeHtml(text: string): string {
  const div = document.createElement('div')
  div.textContent = text
  return div.innerHTML
}

function iconBtn(label: string, inner: string, extra = ''): string {
  return `<button type="button" aria-label="${label}" class="p-2 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)] transition ${extra}">${inner}</button>`
}

function pickerRow(
  type: 'emoji' | 'color',
  items: readonly string[],
  selected: string,
  prefix: string,
): string {
  if (type === 'emoji') {
    return items
      .map(
        (e) => `
        <button type="button" data-${prefix}-emoji="${e}"
          class="${prefix}-emoji w-10 h-10 rounded-xl text-lg transition ${e === selected ? 'picker-active' : 'picker-idle'}">
          ${e}
        </button>`,
      )
      .join('')
  }
  return items
    .map(
      (c) => `
      <button type="button" data-${prefix}-color="${c}"
        class="${prefix}-color w-8 h-8 rounded-full transition ring-offset-2 ring-offset-[var(--bg-base)]
          ${c === selected ? 'ring-2 ring-[var(--text-primary)] scale-110' : 'hover:scale-110'}"
        style="background:${c}"></button>`,
    )
    .join('')
}

function progressRing(percent: number, size = 120): string {
  const r = (size - 12) / 2
  const circ = 2 * Math.PI * r
  const offset = circ - (percent / 100) * circ
  return `
    <svg width="${size}" height="${size}" class="-rotate-90">
      <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="var(--ring-track)" stroke-width="8"/>
      <circle class="habit-ring" cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none"
        stroke="url(#ringGrad)" stroke-width="8" stroke-linecap="round"
        stroke-dasharray="${circ}" stroke-dashoffset="${offset}"/>
      <defs>
        <linearGradient id="ringGrad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stop-color="#818cf8"/>
          <stop offset="100%" stop-color="#c084fc"/>
        </linearGradient>
      </defs>
    </svg>
  `
}

function heatmap30(habit: Habit): string {
  const days = getLastNDays(30)
  return `
    <div class="grid grid-cols-15 gap-1 sm:gap-1.5 mt-3 pt-3 border-t border-[var(--border)]">
      ${days
        .map((d) => {
          const done = isCompleted(state.logs, habit.id, d)
          return `<span class="aspect-square rounded-sm ${done ? '' : 'opacity-25'}"
            style="background:${done ? habit.color : 'var(--dot-empty)'}"
            title="${dayLabel(d)}"></span>`
        })
        .join('')}
    </div>
  `
}

function weekDots(habit: Habit): string {
  const days = getLastNDays(7)
  return days
    .map((d) => {
      const done = isCompleted(state.logs, habit.id, d)
      const isToday = d === todayKey()
      return `<span
        class="w-2.5 h-2.5 rounded-full transition-all duration-300 ${done ? 'scale-110' : 'opacity-30'}
        ${isToday ? 'ring-2 ring-[var(--text-primary)]/30 ring-offset-1 ring-offset-transparent' : ''}"
        style="background: ${done ? habit.color : 'var(--dot-empty)'}"
        title="${dayLabel(d)}"></span>`
    })
    .join('')
}

function habitCard(habit: Habit): string {
  const today = todayKey()
  const done = isCompleted(state.logs, habit.id, today)
  const streak = calcStreak(state.logs, habit.id)
  const best = calcBestStreak(state.logs, habit.id)
  const weekDays = getLastNDays(7)
  const rate = completionRate(state.logs, habit.id, weekDays)
  const expanded = expandedHabitId === habit.id

  return `
    <article class="glass rounded-2xl p-5 flex flex-col gap-3 group hover:border-[var(--border-strong)] transition-colors animate-fade-in"
      data-habit-id="${habit.id}">
      <div class="flex items-start gap-4">
        <button type="button" data-toggle="${habit.id}"
          class="habit-check shrink-0 w-14 h-14 rounded-2xl flex items-center justify-center text-2xl transition-all duration-300
            ${done ? 'habit-check-done scale-105' : 'hover:scale-105'}"
          style="--habit-color:${habit.color}; background:${done ? habit.color : 'var(--surface)'}; box-shadow:${done ? `0 8px 24px ${habit.color}55` : 'none'}"
          aria-pressed="${done}">
          ${habit.emoji}
        </button>
        <div class="flex-1 min-w-0">
          <div class="flex items-start justify-between gap-2">
            <div class="min-w-0">
              <h3 class="font-display font-semibold text-lg text-[var(--text-primary)] truncate">${escapeHtml(habit.name)}</h3>
              ${habit.note ? `<p class="text-sm text-[var(--text-muted)] mt-0.5 line-clamp-2">${escapeHtml(habit.note)}</p>` : ''}
            </div>
            <div class="flex items-center gap-0.5 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
              ${iconBtn('Move up', '↑', `data-move-up="${habit.id}" text-xs font-bold`)}
              ${iconBtn('Move down', '↓', `data-move-down="${habit.id}" text-xs font-bold`)}
              ${iconBtn(
                'Edit',
                '<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>',
                `data-edit="${habit.id}"`,
              )}
              ${iconBtn(
                'Delete',
                '<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>',
                `data-delete="${habit.id}" hover:!text-rose-400`,
              )}
            </div>
          </div>
          <div class="flex flex-wrap gap-x-3 gap-y-1 text-sm text-[var(--text-muted)] mt-1.5">
            ${streak > 0 ? `<span class="text-amber-500 font-medium">🔥 ${streak} day streak</span>` : '<span>No active streak</span>'}
            <span>·</span>
            <span>${rate}% this week</span>
            ${best > streak ? `<span>·</span><span>Best: ${best}</span>` : ''}
          </div>
        </div>
      </div>
      <div class="flex items-center justify-between">
        <div class="flex gap-1.5">${weekDots(habit)}</div>
        <button type="button" data-expand="${habit.id}" class="text-xs text-[var(--text-muted)] font-medium uppercase tracking-wider hover:text-indigo-400 transition">
          ${expanded ? 'Hide' : '30 days'} ▾
        </button>
      </div>
      ${expanded ? heatmap30(habit) : ''}
    </article>
  `
}

function statsBar(): string {
  const stats = weeklyStats(state)
  const { done, total } = todayProgress(state)

  return `
    <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
      <div class="stat-card glass rounded-xl p-4">
        <p class="text-xs text-[var(--text-muted)] uppercase tracking-wider">Today</p>
        <p class="font-display text-2xl font-bold text-[var(--text-primary)] mt-1">${done}/${total}</p>
      </div>
      <div class="stat-card glass rounded-xl p-4">
        <p class="text-xs text-[var(--text-muted)] uppercase tracking-wider">This week</p>
        <p class="font-display text-2xl font-bold text-[var(--text-primary)] mt-1">${stats.completions}</p>
        <p class="text-xs text-[var(--text-muted)]">check-ins</p>
      </div>
      <div class="stat-card glass rounded-xl p-4">
        <p class="text-xs text-[var(--text-muted)] uppercase tracking-wider">Best streak</p>
        <p class="font-display text-2xl font-bold text-amber-500 mt-1">${stats.bestStreak}</p>
        <p class="text-xs text-[var(--text-muted)]">days</p>
      </div>
      <div class="stat-card glass rounded-xl p-4">
        <p class="text-xs text-[var(--text-muted)] uppercase tracking-wider">Perfect days</p>
        <p class="font-display text-2xl font-bold text-emerald-500 mt-1">${stats.perfectDays}</p>
        <p class="text-xs text-[var(--text-muted)]">this week</p>
      </div>
    </div>
  `
}

function monthCalendar(): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth()
  const days = getMonthDays(year, month)
  const firstDow = new Date(year, month, 1).getDay()
  const monthName = now.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
  const today = todayKey()

  const blanks = Array.from({ length: firstDow }, () => '<span></span>')
  const cells = days.map((d) => {
    const pct = dayCompletionPercent(state, d)
    const isToday = d === today
    const isFuture = d > today
    const level =
      pct === 0 ? 0 : pct < 50 ? 1 : pct < 100 ? 2 : 3
    return `<span
      class="cal-cell cal-level-${level} ${isToday ? 'cal-today' : ''} ${isFuture ? 'cal-future' : ''}"
      title="${dayLabel(d)}: ${state.habits.length ? pct + '%' : '—'}">${parseDateKey(d).getDate()}</span>`
  })

  return `
    <section class="glass rounded-2xl p-5 mb-8">
      <div class="flex items-center justify-between mb-4">
        <h2 class="font-display font-semibold text-[var(--text-primary)]">${monthName}</h2>
        <span class="text-xs text-[var(--text-muted)]">Daily completion</span>
      </div>
      <div class="grid grid-cols-7 gap-1 text-center text-[10px] text-[var(--text-muted)] mb-2">
        ${['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d) => `<span>${d}</span>`).join('')}
      </div>
      <div class="grid grid-cols-7 gap-1.5">
        ${blanks.join('')}${cells.join('')}
      </div>
      <div class="flex items-center justify-end gap-2 mt-4 text-[10px] text-[var(--text-muted)]">
        <span>Less</span>
        ${[0, 1, 2, 3].map((l) => `<span class="cal-cell cal-level-${l} w-4 h-4 !text-transparent rounded">.</span>`).join('')}
        <span>More</span>
      </div>
    </section>
  `
}

function filteredHabits(): Habit[] {
  let habits = sortHabits(state.habits, state.logs, state.settings.sort)
  const q = searchQuery.trim().toLowerCase()
  if (q) {
    habits = habits.filter(
      (h) => h.name.toLowerCase().includes(q) || h.note?.toLowerCase().includes(q),
    )
  }
  return habits
}

function editModal(): string {
  if (!editingHabit) return ''
  const h = editingHabit
  return `
    <div class="modal-backdrop" id="edit-modal" role="dialog" aria-modal="true" aria-labelledby="edit-title">
      <div class="modal-panel glass rounded-2xl p-6 w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto">
        <h2 id="edit-title" class="font-display text-xl font-semibold text-[var(--text-primary)] mb-4">Edit habit</h2>
        <form id="edit-habit-form" class="flex flex-col gap-4">
          <input type="text" name="name" required maxlength="40" value="${escapeHtml(h.name)}"
            class="input-field"/>
          <input type="text" name="note" maxlength="80" value="${escapeHtml(h.note ?? '')}" placeholder="Optional note"
            class="input-field"/>
          <div>
            <p class="label-sm">Icon</p>
            <div class="flex flex-wrap gap-2 mt-2">${pickerRow('emoji', HABIT_EMOJIS, editEmoji, 'edit')}</div>
          </div>
          <div>
            <p class="label-sm">Color</p>
            <div class="flex flex-wrap gap-2 mt-2">${pickerRow('color', HABIT_COLORS, editColor, 'edit')}</div>
          </div>
          <div class="flex gap-3 pt-2">
            <button type="button" id="cancel-edit" class="btn-secondary flex-1">Cancel</button>
            <button type="submit" class="btn-primary flex-1">Save</button>
          </div>
        </form>
      </div>
    </div>
  `
}

function addHabitSection(): string {
  return `
    <section class="glass rounded-2xl overflow-hidden mb-8">
      <button type="button" id="toggle-add-form" class="w-full flex items-center justify-between p-5 text-left hover:bg-[var(--surface-hover)] transition">
        <h2 class="font-display font-semibold text-lg text-[var(--text-primary)]">${addFormOpen ? 'Add a habit' : '+ Add new habit'}</h2>
        <span class="text-[var(--text-muted)] transition-transform ${addFormOpen ? 'rotate-180' : ''}">▾</span>
      </button>
      <div class="${addFormOpen ? '' : 'hidden'} px-5 pb-5 border-t border-[var(--border)]">
        <p class="label-sm mt-4 mb-2">Quick add</p>
        <div class="flex flex-wrap gap-2 mb-4">
          ${HABIT_PRESETS.map(
            (p) => `
            <button type="button" data-preset="${escapeHtml(p.name)}" data-preset-emoji="${p.emoji}" data-preset-color="${p.color}"
              class="px-3 py-1.5 rounded-full text-sm bg-[var(--surface)] border border-[var(--border)] hover:border-indigo-400/50 transition text-[var(--text-secondary)]">
              ${p.emoji} ${escapeHtml(p.name)}
            </button>`,
          ).join('')}
        </div>
        <form id="add-habit-form" class="flex flex-col gap-4">
          <input type="text" name="name" required maxlength="40" placeholder="Habit name"
            class="input-field"/>
          <input type="text" name="note" maxlength="80" placeholder="Optional note (e.g. 2 glasses before noon)"
            class="input-field"/>
          <div>
            <p class="label-sm">Icon</p>
            <div class="flex flex-wrap gap-2 mt-2">${pickerRow('emoji', HABIT_EMOJIS, selectedEmoji, 'add')}</div>
          </div>
          <div>
            <p class="label-sm">Color</p>
            <div class="flex flex-wrap gap-2 mt-2">${pickerRow('color', HABIT_COLORS, selectedColor, 'add')}</div>
          </div>
          <button type="submit" class="btn-primary w-full">Add habit</button>
        </form>
      </div>
    </section>
  `
}

function render(): void {
  const { done, total } = todayProgress(state)
  const percent = total === 0 ? 0 : Math.round((done / total) * 100)
  const today = new Date().toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  })
  const habits = filteredHabits()
  const isLight = state.settings.theme === 'light'

  root.innerHTML = `
    <div class="min-h-svh max-w-2xl mx-auto px-4 py-8 sm:py-12 pb-24">
      <header class="mb-8 flex items-start justify-between gap-4">
        <div>
          <p class="text-indigo-400 text-sm font-medium tracking-wide uppercase mb-1">Daily habits</p>
          <h1 class="font-display text-3xl sm:text-4xl font-bold text-[var(--text-primary)] tracking-tight">Habit Tracker</h1>
          <p class="text-[var(--text-muted)] mt-1">${today}</p>
        </div>
        <button type="button" id="theme-toggle" class="shrink-0 w-11 h-11 rounded-xl glass flex items-center justify-center text-lg hover:scale-105 transition"
          aria-label="Switch to ${isLight ? 'dark' : 'light'} mode">
          ${isLight ? '🌙' : '☀️'}
        </button>
      </header>

      <blockquote class="glass rounded-xl px-4 py-3 mb-8 border-l-4 border-indigo-500/60">
        <p class="text-sm text-[var(--text-secondary)] italic">"${dailyQuote()}"</p>
      </blockquote>

      <section class="glass rounded-3xl p-6 sm:p-8 mb-8 flex items-center gap-6 sm:gap-8 ${percent === 100 && total > 0 ? 'celebrate-glow' : ''}">
        <div class="relative shrink-0">
          ${progressRing(percent)}
          <div class="absolute inset-0 flex flex-col items-center justify-center">
            <span class="font-display text-2xl font-bold text-[var(--text-primary)]">${percent}%</span>
            <span class="text-xs text-[var(--text-muted)]">today</span>
          </div>
        </div>
        <div>
          <p class="font-display text-2xl font-semibold text-[var(--text-primary)]">${done}<span class="text-[var(--text-muted)] font-normal"> / ${total}</span></p>
          <p class="text-[var(--text-muted)] mt-1 text-sm">
            ${total === 0 ? 'Add habits to track your progress' : done === total ? '🎉 All habits done for today!' : `${total - done} habit${total - done === 1 ? '' : 's'} left`}
          </p>
        </div>
      </section>

      ${state.habits.length > 0 ? statsBar() : ''}
      ${state.habits.length > 0 ? monthCalendar() : ''}

      ${state.habits.length > 0 ? `
        <div class="flex flex-col sm:flex-row gap-3 mb-4">
          <input type="search" id="habit-search" value="${escapeHtml(searchQuery)}" placeholder="Search habits…"
            class="input-field flex-1"/>
          <select id="sort-select" class="input-field sm:w-40">
            <option value="default" ${state.settings.sort === 'default' ? 'selected' : ''}>Default order</option>
            <option value="streak" ${state.settings.sort === 'streak' ? 'selected' : ''}>By streak</option>
            <option value="weekly" ${state.settings.sort === 'weekly' ? 'selected' : ''}>By weekly %</option>
            <option value="name" ${state.settings.sort === 'name' ? 'selected' : ''}>By name</option>
          </select>
        </div>
      ` : ''}

      <div class="grid gap-4 mb-8" id="habit-list">
        ${state.habits.length === 0 ? emptyState() : habits.length === 0 ? `
          <div class="glass rounded-2xl p-8 text-center text-[var(--text-muted)]">No habits match your search.</div>
        ` : habits.map(habitCard).join('')}
      </div>

      ${addHabitSection()}

      <section class="glass rounded-2xl p-5 flex flex-wrap gap-3 justify-center">
        <button type="button" id="export-btn" class="btn-secondary text-sm">Export backup</button>
        <label class="btn-secondary text-sm cursor-pointer">
          Import backup
          <input type="file" id="import-file" accept=".json,application/json" class="hidden"/>
        </label>
      </section>

      <footer class="text-center text-[var(--text-muted)] text-xs mt-8 pb-4 space-y-1">
        <p>Data saved locally in your browser</p>
        <p class="opacity-70">Tip: press <kbd class="kbd">N</kbd> to add a habit</p>
      </footer>
    </div>
    ${editModal()}
    <input type="file" id="import-file-hidden" class="hidden" accept=".json"/>
  `

  bindEvents()
}

function emptyState(): string {
  return `
    <div class="glass rounded-2xl p-12 text-center col-span-full">
      <div class="text-5xl mb-4">🌱</div>
      <h3 class="font-display text-xl font-semibold text-[var(--text-primary)] mb-2">No habits yet</h3>
      <p class="text-[var(--text-muted)] max-w-sm mx-auto">Add your first habit below — or pick a quick preset to get started.</p>
    </div>
  `
}

function bindEvents(): void {
  document.getElementById('theme-toggle')?.addEventListener('click', () => {
    const theme: Theme = state.settings.theme === 'dark' ? 'light' : 'dark'
    setState({ ...state, settings: { ...state.settings, theme } }, { skipConfetti: true })
  })

  document.getElementById('toggle-add-form')?.addEventListener('click', () => {
    addFormOpen = !addFormOpen
    render()
  })

  document.getElementById('habit-search')?.addEventListener('input', (e) => {
    searchQuery = (e.target as HTMLInputElement).value
    render()
    const input = document.getElementById('habit-search') as HTMLInputElement
    input?.focus()
    input?.setSelectionRange(input.value.length, input.value.length)
  })

  document.getElementById('sort-select')?.addEventListener('change', (e) => {
    const sort = (e.target as HTMLSelectElement).value as SortMode
    setState({ ...state, settings: { ...state.settings, sort } }, { skipConfetti: true })
  })

  root.querySelectorAll('[data-toggle]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = (btn as HTMLElement).dataset.toggle!
      setState(toggleLog(state, id, todayKey()))
    })
  })

  root.querySelectorAll('[data-expand]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = (btn as HTMLElement).dataset.expand!
      expandedHabitId = expandedHabitId === id ? null : id
      render()
    })
  })

  root.querySelectorAll('[data-edit]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = (btn as HTMLElement).dataset.edit!
      const habit = state.habits.find((h) => h.id === id)
      if (!habit) return
      editingHabit = { ...habit }
      editEmoji = habit.emoji
      editColor = habit.color
      render()
    })
  })

  root.querySelectorAll('[data-delete]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = (btn as HTMLElement).dataset.delete!
      const habit = state.habits.find((h) => h.id === id)
      if (!habit) return
      undoSnapshot = {
        habit,
        logs: state.logs.filter((l) => l.habitId === id),
      }
      setState({
        ...state,
        habits: state.habits.filter((h) => h.id !== id),
        logs: state.logs.filter((l) => l.habitId !== id),
      })
      showToast(`Deleted "${habit.name}"`, {
        label: 'Undo',
        onClick: () => {
          if (!undoSnapshot) return
          setState({
            ...state,
            habits: [...state.habits, undoSnapshot.habit],
            logs: [...state.logs, ...undoSnapshot.logs],
          })
          undoSnapshot = null
        },
      })
    })
  })

  root.querySelectorAll('[data-move-up]').forEach((btn) => {
    btn.addEventListener('click', () => {
      setState({ ...state, habits: moveHabit(state.habits, (btn as HTMLElement).dataset.moveUp!, -1) }, { skipConfetti: true })
    })
  })

  root.querySelectorAll('[data-move-down]').forEach((btn) => {
    btn.addEventListener('click', () => {
      setState({ ...state, habits: moveHabit(state.habits, (btn as HTMLElement).dataset.moveDown!, 1) }, { skipConfetti: true })
    })
  })

  bindPickers('add', (emoji, color) => {
    selectedEmoji = emoji ?? selectedEmoji
    selectedColor = color ?? selectedColor
    render()
  })

  bindPickers('edit', (emoji, color) => {
    editEmoji = emoji ?? editEmoji
    editColor = color ?? editColor
    render()
  })

  root.querySelectorAll('[data-preset]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const el = btn as HTMLElement
      const habit = createHabit(el.dataset.preset!, el.dataset.presetEmoji!, el.dataset.presetColor!)
      setState({ ...state, habits: [...state.habits, habit] })
      addFormOpen = false
    })
  })

  const addForm = document.getElementById('add-habit-form') as HTMLFormElement
  addForm?.addEventListener('submit', (e) => {
    e.preventDefault()
    const data = new FormData(addForm)
    const name = (data.get('name') as string)?.trim()
    const note = (data.get('note') as string)?.trim()
    if (!name) return
    setState({ ...state, habits: [...state.habits, createHabit(name, selectedEmoji, selectedColor, note)] })
    addForm.reset()
    selectedEmoji = HABIT_EMOJIS[Math.floor(Math.random() * HABIT_EMOJIS.length)]
    selectedColor = HABIT_COLORS[Math.floor(Math.random() * HABIT_COLORS.length)]
    addFormOpen = false
  })

  document.getElementById('cancel-edit')?.addEventListener('click', closeEdit)
  document.getElementById('edit-modal')?.addEventListener('click', (e) => {
    if ((e.target as HTMLElement).id === 'edit-modal') closeEdit()
  })

  const editForm = document.getElementById('edit-habit-form') as HTMLFormElement
  editForm?.addEventListener('submit', (e) => {
    e.preventDefault()
    if (!editingHabit) return
    const data = new FormData(editForm)
    const updated = updateHabit(editingHabit, {
      name: data.get('name') as string,
      note: data.get('note') as string,
      emoji: editEmoji,
      color: editColor,
    })
    setState({
      ...state,
      habits: state.habits.map((h) => (h.id === updated.id ? updated : h)),
    }, { skipConfetti: true })
    closeEdit()
  })

  document.getElementById('export-btn')?.addEventListener('click', () => {
    const blob = new Blob([exportData(state)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `habits-backup-${todayKey()}.json`
    a.click()
    URL.revokeObjectURL(url)
    showToast('Backup downloaded')
  })

  document.getElementById('import-file')?.addEventListener('change', async (e) => {
    const file = (e.target as HTMLInputElement).files?.[0]
    if (!file) return
    try {
      const text = await file.text()
      if (!confirm('Import will replace all current habits and history. Continue?')) return
      setState(importData(text), { skipConfetti: true })
      showToast('Backup imported successfully')
    } catch {
      showToast('Invalid backup file')
    }
    ;(e.target as HTMLInputElement).value = ''
  })
}

function bindPickers(
  prefix: string,
  onChange: (emoji?: string, color?: string) => void,
): void {
  root.querySelectorAll(`[data-${prefix}-emoji]`).forEach((btn) => {
    btn.addEventListener('click', () => onChange((btn as HTMLElement).dataset[`${prefix}Emoji`], undefined))
  })
  root.querySelectorAll(`[data-${prefix}-color]`).forEach((btn) => {
    btn.addEventListener('click', () => onChange(undefined, (btn as HTMLElement).dataset[`${prefix}Color`]))
  })
}

function closeEdit(): void {
  editingHabit = null
  render()
}

function bindKeyboard(): void {
  document.addEventListener('keydown', (e) => {
    if (e.key === 'n' && !e.ctrlKey && !e.metaKey && document.activeElement?.tagName !== 'INPUT') {
      addFormOpen = true
      render()
      document.querySelector<HTMLInputElement>('#add-habit-form input[name="name"]')?.focus()
    }
    if (e.key === 'Escape' && editingHabit) closeEdit()
  })
}

export function init(): void {
  applyTheme(state.settings.theme)
  lastAllDone = todayProgress(state).done === todayProgress(state).total && state.habits.length > 0
  bindKeyboard()
  render()
}
