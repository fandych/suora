import {
  siAlibabacloud,
  siAnthropic,
  siDeepseek,
  siKimi,
  siOllama,
  siOpenrouter,
  siVercel,
  type SimpleIcon,
} from "simple-icons"

type ProviderLogoProps = {
  className?: string
}

export function getProviderBrandClassName(providerType: string) {
  switch (providerType) {
    case "openai":
      return "text-emerald-600"
    case "anthropic":
      return "text-orange-600"
    case "deepseek":
      return "text-blue-600"
    case "bailian":
      return "text-amber-600"
    case "kimi":
      return "text-sky-500"
    case "ollama":
      return "text-zinc-700"
    case "openrouter":
      return "text-violet-600"
    case "vercel":
      return "text-black"
    case "azure":
      return "text-cyan-600"
    case "custom":
      return "text-rose-600"
    default:
      return "text-slate-500"
  }
}

function BrandSvg({ icon, className }: { icon: SimpleIcon; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d={icon.path} />
    </svg>
  )
}

function FaviconLogo({ src, className }: { src: string; className?: string }) {
  return <img src={src} alt="" className={className} loading="lazy" />
}

function LetterLogo({ letters, className }: { letters: string; className?: string }) {
  return <span className={className}>{letters}</span>
}

export const OpenAILogo = ({ className }: ProviderLogoProps) => <FaviconLogo src="https://platform.openai.com/favicon.ico" className={className} />
export const AnthropicLogo = ({ className }: ProviderLogoProps) => <BrandSvg icon={siAnthropic} className={className} />
export const OllamaLogo = ({ className }: ProviderLogoProps) => <BrandSvg icon={siOllama} className={className} />
export const OpenRouterLogo = ({ className }: ProviderLogoProps) => <BrandSvg icon={siOpenrouter} className={className} />
export const BailianLogo = ({ className }: ProviderLogoProps) => <BrandSvg icon={siAlibabacloud} className={className} />
export const DeepSeekLogo = ({ className }: ProviderLogoProps) => <BrandSvg icon={siDeepseek} className={className} />
export const KimiLogo = ({ className }: ProviderLogoProps) => <BrandSvg icon={siKimi} className={className} />
export const VercelLogo = ({ className }: ProviderLogoProps) => <BrandSvg icon={siVercel} className={className} />
export const AzureLogo = ({ className }: ProviderLogoProps) => <FaviconLogo src="https://azure.microsoft.com/favicon.ico" className={className} />
export const CustomProviderLogo = ({ className }: ProviderLogoProps) => <LetterLogo letters="CU" className={className} />
export const UnknownProviderLogo = ({ className }: ProviderLogoProps) => <LetterLogo letters="DS" className={className} />

export function getProviderLogo(providerType: string) {
  switch (providerType) {
    case "openai":
      return OpenAILogo
    case "anthropic":
      return AnthropicLogo
    case "deepseek":
      return DeepSeekLogo
    case "bailian":
      return BailianLogo
    case "kimi":
      return KimiLogo
    case "ollama":
      return OllamaLogo
    case "openrouter":
      return OpenRouterLogo
    case "vercel":
      return VercelLogo
    case "azure":
      return AzureLogo
    case "custom":
      return CustomProviderLogo
    default:
      return UnknownProviderLogo
  }
}