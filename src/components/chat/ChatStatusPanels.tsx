import type { ReactNode } from 'react'
import { AgentAvatar, IconifyIcon } from '@/components/icons/IconifyIcons'
import { Button as UiButton } from '@/components/shared/button'
import { workbenchPrimaryButtonClass, workbenchSectionEyebrowClass } from '@/components/workbench/styles'
import { useI18n } from '@/hooks/useI18n'
import { ChatInput } from './ChatInput'
import type { MessageAttachment } from '@/types'

type StarterPrompt = {
  icon: string
  label: string
  detail: string
  prompt: string
}

export function SurfaceBadge({
  children,
  tone = 'default',
}: {
  children: ReactNode
  tone?: 'default' | 'accent' | 'warning' | 'success'
}) {
  const toneClass = tone === 'accent'
    ? 'border-accent/20 bg-accent/10 text-accent'
    : tone === 'warning'
      ? 'border-warning/20 bg-warning/10 text-warning'
      : tone === 'success'
        ? 'border-success/20 bg-success/10 text-success'
        : 'border-border-subtle/55 bg-surface-0/60 text-text-secondary'

  return <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-medium ${toneClass}`}>{children}</span>
}

export function PromptActionCard({
  icon,
  title,
  detail,
  onClick,
  disabled,
}: {
  icon: string
  title: string
  detail: string
  onClick: () => void
  disabled?: boolean
}) {
  return (
    <UiButton unstyled type="button" onClick={onClick} disabled={disabled} className="group rounded-md border border-border-subtle/45 bg-surface-0/42 p-3 text-left transition-all duration-200 hover:border-accent/24 hover:bg-surface-0/70 disabled:opacity-45">
      <div className="flex h-8 w-8 items-center justify-center rounded-md bg-accent/10 text-accent transition-colors group-hover:bg-accent/14">
        <IconifyIcon name={icon} size={16} color="currentColor" />
      </div>
      <div className="mt-2.5 text-[13px] font-semibold text-text-primary">{title}</div>
      <p className="mt-1 text-[12px] leading-5 text-text-secondary/72">{detail}</p>
    </UiButton>
  )
}

export function StreamingStatus({
  isStreaming,
  label,
}: {
  isStreaming: boolean
  label: string
}) {
  if (!isStreaming) return null

  return (
    <div className="px-6 pb-3 pt-2 xl:px-8">
      <div className="mx-auto max-w-384">
        <div role="status" aria-live="polite" className="inline-flex max-w-full items-center gap-3 rounded-full border border-accent/18 bg-surface-0/72 px-4 py-2 text-[11.5px] text-text-secondary shadow-[0_12px_30px_rgba(var(--t-accent-rgb),0.08)] backdrop-blur-xl">
          <span className="relative flex h-2.5 w-2.5" aria-hidden="true">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent/60 opacity-75" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-accent" />
          </span>
          <span className="truncate">{label}</span>
        </div>
      </div>
    </div>
  )
}

export function EmptyChatState({
  starterPrompts,
  sessionAgentAvatar,
  displayAgentName,
  displayAgentGreeting,
  isStreaming,
  onPromptSelect,
  hintsTitle,
  pipelineHint,
  pasteHint,
}: {
  starterPrompts: StarterPrompt[]
  sessionAgentAvatar: string
  displayAgentName: string
  displayAgentGreeting: string
  isStreaming: boolean
  onPromptSelect: (prompt: string) => void
  hintsTitle: string
  pipelineHint: string
  pasteHint: string
}) {
  const { t } = useI18n()

  return (
    <div className="space-y-4">
      <section className="chat-stage-panel relative overflow-hidden rounded-md border border-border-subtle/35 bg-surface-1/28">
        <div className="relative z-10 p-4 xl:p-5">
          <div className="flex h-12 w-12 items-center justify-center rounded-md bg-accent/10 text-accent">
            <AgentAvatar avatar={sessionAgentAvatar} size={32} />
          </div>
          <div className="mt-4 max-w-2xl">
            <div className={workbenchSectionEyebrowClass}>{t('common.ready', 'Ready')}</div>
            <h2 className="mt-1.5 text-[22px] font-semibold text-text-primary">{displayAgentName}</h2>
            <p className="mt-2 text-[13px] leading-5 text-text-secondary/78">{displayAgentGreeting}</p>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {starterPrompts.map((suggestion) => (
              <PromptActionCard
                key={suggestion.label}
                icon={suggestion.icon}
                title={suggestion.label}
                detail={suggestion.detail}
                onClick={() => onPromptSelect(suggestion.prompt)}
                disabled={isStreaming}
              />
            ))}
          </div>
        </div>
      </section>

      <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="rounded-md border border-border-subtle/40 bg-surface-1/32 p-3.5 text-[12px] leading-6 text-text-secondary/78">
          <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-text-muted/45">{hintsTitle}</div>
          <div className="mt-2.5 space-y-1.5">
            <div>{pipelineHint}</div>
            <div>{pasteHint}</div>
          </div>
        </div>
      </div>
    </div>
  )
}

export function NewSessionHero({
  starterPrompts,
  onPromptSelect,
  createSessionAndSend,
  canChat,
  hintsTitle,
  pipelineHint,
  pasteHint,
  badgeOne,
  badgeTwo,
  promptEyebrow,
  title,
  description,
  promptTitle,
  promptDescription,
  footer,
}: {
  starterPrompts: StarterPrompt[]
  onPromptSelect: (prompt: string) => void
  createSessionAndSend: (text: string, attachments?: MessageAttachment[]) => void
  canChat: boolean
  hintsTitle: string
  pipelineHint: string
  pasteHint: string
  badgeOne: string
  badgeTwo: string
  promptEyebrow: string
  title: string
  description: string
  promptTitle: string
  promptDescription: string
  footer: ReactNode
}) {
  const { t } = useI18n()

  return (
    <>
      <section className="chat-stage-panel relative overflow-hidden rounded-md border border-border-subtle/35 bg-surface-1/28">
        <div className="relative z-10 p-4 xl:p-5">
          <div>
            <div className="flex flex-wrap gap-2">
              <SurfaceBadge tone="accent">{badgeOne}</SurfaceBadge>
              <SurfaceBadge>{badgeTwo}</SurfaceBadge>
            </div>

            <div className="mt-4 max-w-3xl">
              <h1 className="text-[28px] font-semibold leading-tight text-text-primary xl:text-[32px]">{title}</h1>
              <p className="mt-2 max-w-2xl text-[13px] leading-6 text-text-secondary/80">{description}</p>
            </div>

            <div className="mt-5 grid gap-2 sm:grid-cols-2">
              {starterPrompts.map((prompt) => (
                <PromptActionCard key={prompt.label} icon={prompt.icon} title={prompt.label} detail={prompt.detail} onClick={() => onPromptSelect(prompt.prompt)} />
              ))}
            </div>
          </div>
        </div>
      </section>
      <section className="rounded-md border border-border-subtle/40 bg-surface-1/30 p-4 xl:p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-2xl">
            <div className={workbenchSectionEyebrowClass}>{promptEyebrow}</div>
            <h2 className="mt-1 text-[18px] font-semibold text-text-primary">{promptTitle}</h2>
            <p className="mt-1 text-[12.5px] leading-5 text-text-secondary/78">{promptDescription}</p>
          </div>
          {!canChat && (<UiButton unstyled type="button" onClick={() => {
            if (typeof window !== 'undefined') {
              window.location.hash = '#/models/providers'
            }
          }} className={workbenchPrimaryButtonClass}>
              {t('onboarding.openModels', 'Open Models')}
            </UiButton>)}
        </div>

        <div className="mt-4">
          <ChatInput onSend={createSessionAndSend} disabled={false} noModel={!canChat} footer={footer} />
        </div>
      </section>
      <div className="rounded-md border border-border-subtle/40 bg-surface-1/24 p-3.5 text-[12px] leading-6 text-text-secondary/78">
        <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-text-muted/45">{hintsTitle}</div>
        <div className="mt-2.5 space-y-1.5">
          <div>{pipelineHint}</div>
          <div>{pasteHint}</div>
        </div>
      </div>
    </>
  )
}
