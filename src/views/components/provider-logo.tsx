import { useState } from "react"

import {
  siAlibabacloud,
  siAnthropic,
  siDeepseek,
  siGooglegemini,
  siKimi,
  siMinimax,
  siMistralai,
  siOllama,
  siOpenrouter,
  siPerplexity,
  siVercel,
  type SimpleIcon,
} from "simple-icons"

import { cn } from "@/lib/utils"

type ProviderLogoProps = {
  className?: string
}

export function getProviderBrandClassName(providerType: string) {
  switch (providerType) {
    case "openai":
      return "text-emerald-600"
    case "anthropic":
      return "text-orange-600"
    case "google":
      return "text-rose-500"
    case "deepseek":
      return "text-blue-600"
    case "bailian":
      return "text-amber-600"
    case "kimi":
      return "text-sky-500"
    case "siliconflow":
      return "text-fuchsia-600"
    case "volcengine":
      return "text-red-600"
    case "zhipu":
      return "text-cyan-600"
    case "minimax":
      return "text-orange-500"
    case "stepfun":
      return "text-lime-600"
    case "ollama":
      return "text-zinc-700"
    case "openrouter":
      return "text-violet-600"
    case "groq":
      return "text-emerald-500"
    case "xai":
      return "text-slate-900"
    case "mistral":
      return "text-orange-500"
    case "perplexity":
      return "text-cyan-500"
    case "together":
      return "text-indigo-600"
    case "fireworks":
      return "text-rose-600"
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

function FaviconLogo({ src, fallbackLetters, className }: { src: string; fallbackLetters: string; className?: string }) {
  const [isLoaded, setIsLoaded] = useState(false)
  const [hasError, setHasError] = useState(false)

  return (
    <span className={cn("relative inline-flex items-center justify-center overflow-hidden rounded-[4px] bg-muted/25", className)} aria-hidden="true">
      {!isLoaded || hasError ? <LetterLogo letters={fallbackLetters} className="text-[0.58em] font-semibold leading-none" /> : null}
      {!hasError ? (
        <img
          src={src}
          alt=""
          className={cn(
            "absolute inset-0 h-full w-full object-contain transition-opacity",
            isLoaded ? "opacity-100" : "opacity-0"
          )}
          loading="eager"
          decoding="async"
          referrerPolicy="no-referrer"
          onLoad={() => setIsLoaded(true)}
          onError={() => {
            setHasError(true)
            setIsLoaded(false)
          }}
        />
      ) : null}
    </span>
  )
}

function LetterLogo({ letters, className }: { letters: string; className?: string }) {
  return <span className={className}>{letters}</span>
}

export const OpenAILogo = ({ className }: ProviderLogoProps) => <FaviconLogo src="https://platform.openai.com/favicon.ico" fallbackLetters="OA" className={className} />
export const AnthropicLogo = ({ className }: ProviderLogoProps) => <BrandSvg icon={siAnthropic} className={className} />
export const OllamaLogo = ({ className }: ProviderLogoProps) => <BrandSvg icon={siOllama} className={className} />
export const OpenRouterLogo = ({ className }: ProviderLogoProps) => <BrandSvg icon={siOpenrouter} className={className} />
export const BailianLogo = ({ className }: ProviderLogoProps) => <BrandSvg icon={siAlibabacloud} className={className} />
export const DeepSeekLogo = ({ className }: ProviderLogoProps) => <BrandSvg icon={siDeepseek} className={className} />
export const KimiLogo = ({ className }: ProviderLogoProps) => <BrandSvg icon={siKimi} className={className} />
export const VercelLogo = ({ className }: ProviderLogoProps) => <BrandSvg icon={siVercel} className={className} />
export const AzureLogo = ({ className }: ProviderLogoProps) => <FaviconLogo src="https://azure.microsoft.com/favicon.ico" fallbackLetters="AZ" className={className} />
export const GoogleLogo = ({ className }: ProviderLogoProps) => <BrandSvg icon={siGooglegemini} className={className} />
export const SiliconFlowLogo = ({ className }: ProviderLogoProps) => <FaviconLogo src="https://cloud.siliconflow.cn/favicon.ico" fallbackLetters="SF" className={className} />
export const VolcengineLogo = ({ className }: ProviderLogoProps) => <FaviconLogo src="https://www.volcengine.com/favicon.ico" fallbackLetters="VE" className={className} />
export const ZhipuLogo = ({ className }: ProviderLogoProps) => <FaviconLogo src="https://open.bigmodel.cn/favicon.ico" fallbackLetters="ZP" className={className} />
export const MinimaxLogo = ({ className }: ProviderLogoProps) => <BrandSvg icon={siMinimax} className={className} />
export const StepFunLogo = ({ className }: ProviderLogoProps) => <FaviconLogo src="https://platform.stepfun.com/favicon.ico" fallbackLetters="ST" className={className} />
export const GroqLogo = ({ className }: ProviderLogoProps) => <FaviconLogo src="https://groq.com/favicon.ico" fallbackLetters="GQ" className={className} />
export const XAiLogo = ({ className }: ProviderLogoProps) => <FaviconLogo src="https://x.ai/favicon.ico" fallbackLetters="xA" className={className} />
export const MistralLogo = ({ className }: ProviderLogoProps) => <BrandSvg icon={siMistralai} className={className} />
export const PerplexityLogo = ({ className }: ProviderLogoProps) => <BrandSvg icon={siPerplexity} className={className} />
export const TogetherLogo = ({ className }: ProviderLogoProps) => <FaviconLogo src="https://www.together.ai/favicon.ico" fallbackLetters="TG" className={className} />
export const FireworksLogo = ({ className }: ProviderLogoProps) => <FaviconLogo src="https://fireworks.ai/favicon.ico" fallbackLetters="FW" className={className} />
export const CustomProviderLogo = ({ className }: ProviderLogoProps) => <LetterLogo letters="CU" className={className} />
export const UnknownProviderLogo = ({ className }: ProviderLogoProps) => <LetterLogo letters="DS" className={className} />

export function getProviderLogo(providerType: string) {
  switch (providerType) {
    case "openai":
      return OpenAILogo
    case "anthropic":
      return AnthropicLogo
    case "google":
      return GoogleLogo
    case "deepseek":
      return DeepSeekLogo
    case "bailian":
      return BailianLogo
    case "kimi":
      return KimiLogo
    case "siliconflow":
      return SiliconFlowLogo
    case "volcengine":
      return VolcengineLogo
    case "zhipu":
      return ZhipuLogo
    case "minimax":
      return MinimaxLogo
    case "stepfun":
      return StepFunLogo
    case "ollama":
      return OllamaLogo
    case "openrouter":
      return OpenRouterLogo
    case "groq":
      return GroqLogo
    case "xai":
      return XAiLogo
    case "mistral":
      return MistralLogo
    case "perplexity":
      return PerplexityLogo
    case "together":
      return TogetherLogo
    case "fireworks":
      return FireworksLogo
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

export function getProviderSidebarLogo(providerType: string) {
  const ProviderLogo = getProviderLogo(providerType)
  const brandClassName = getProviderBrandClassName(providerType)
  return ({ className }: ProviderLogoProps) => <ProviderLogo className={cn(brandClassName, className)} />
}