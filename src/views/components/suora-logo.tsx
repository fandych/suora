export function SuoraLogo({ className = "size-6" }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true" fill="none">
      <rect x="8" y="8" width="48" height="48" rx="16" fill="currentColor" opacity="0.12" />
      <path d="M20 24C20 19.5817 23.5817 16 28 16H42V24H28V40H44C44 44.4183 40.4183 48 36 48H22V40H36V24H20Z" fill="currentColor" />
    </svg>
  )
}