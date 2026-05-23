type ToastAction = { label: string; onClick: () => void }

let container: HTMLElement | null = null
let timer: ReturnType<typeof setTimeout> | null = null

function ensureContainer(): HTMLElement {
  if (!container) {
    container = document.createElement('div')
    container.id = 'toast-root'
    container.className = 'fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] flex flex-col gap-2 w-[min(100%,24rem)] px-4 pointer-events-none'
    document.body.appendChild(container)
  }
  return container
}

export function showToast(message: string, action?: ToastAction, duration = 5000): void {
  const root = ensureContainer()
  if (timer) clearTimeout(timer)

  root.innerHTML = `
    <div class="toast-enter glass rounded-xl px-4 py-3 flex items-center justify-between gap-3 pointer-events-auto shadow-2xl border-white/15">
      <span class="text-sm text-[var(--text-primary)]">${message}</span>
      ${
        action
          ? `<button type="button" class="toast-action shrink-0 text-sm font-semibold text-indigo-400 hover:text-indigo-300 transition">${action.label}</button>`
          : ''
      }
    </div>
  `

  const btn = root.querySelector('.toast-action')
  btn?.addEventListener('click', () => {
    action?.onClick()
    dismissToast()
  })

  timer = setTimeout(dismissToast, duration)
}

export function dismissToast(): void {
  if (timer) {
    clearTimeout(timer)
    timer = null
  }
  if (container) container.innerHTML = ''
}
