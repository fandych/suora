import suoraLogoUrl from "@/assets/suora-logo.svg"

export function SuoraLogo({ className = "size-8" }: { className?: string }) {
  return <img src={suoraLogoUrl} alt="" aria-hidden="true" className={className} />
}
