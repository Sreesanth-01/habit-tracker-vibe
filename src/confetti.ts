const COLORS = ['#818cf8', '#c084fc', '#f472b6', '#fbbf24', '#34d399', '#38bdf8']

export function burstConfetti(): void {
  const count = 48
  for (let i = 0; i < count; i++) {
    const el = document.createElement('div')
    el.className = 'confetti-piece'
    el.style.left = `${45 + Math.random() * 10}%`
    el.style.top = '40%'
    el.style.background = COLORS[Math.floor(Math.random() * COLORS.length)]
    el.style.setProperty('--tx', `${(Math.random() - 0.5) * 320}px`)
    el.style.setProperty('--ty', `${-80 - Math.random() * 280}px`)
    el.style.setProperty('--rot', `${Math.random() * 720}deg`)
    el.style.animationDelay = `${Math.random() * 0.15}s`
    document.body.appendChild(el)
    setTimeout(() => el.remove(), 1600)
  }
}
