import { useEffect, useId, useRef } from 'react'
import { useAppStore } from '@/store/appStore'
import { ICON_DATA, IconifyIcon } from '@/components/icons/IconifyIcons'
import { useI18n } from '@/hooks/useI18n'
import { confirm } from '@/services/confirmDialog'

interface OnboardingStepDef {
  titleKey: string
  titleDefault: string
  descriptionKey: string
  descriptionDefault: string
  icon: string
}

const STEPS: OnboardingStepDef[] = [
  {
    titleKey: 'onboarding.welcome.title',
    titleDefault: 'Welcome to Suora',
    descriptionKey: 'onboarding.welcome.description',
    descriptionDefault: 'Your AI-powered desktop companion. Let\'s get you set up in a few quick steps.',
    icon: 'ui-welcome',
  },
  {
    titleKey: 'onboarding.provider.title',
    titleDefault: 'Configure a Model Provider',
    descriptionKey: 'onboarding.provider.description',
    descriptionDefault: 'Add an AI provider (OpenAI, Anthropic, Google, etc.) to start chatting. After this walkthrough, head to Models to add your first provider.',
    icon: 'action-models',
  },
  {
    titleKey: 'onboarding.agents.title',
    titleDefault: 'Meet Your Agents',
    descriptionKey: 'onboarding.agents.description',
    descriptionDefault: 'Agents are AI assistants with custom personalities and skills. Create specialized agents for coding, writing, analysis, and more.',
    icon: 'agent-robot',
  },
  {
    titleKey: 'onboarding.skills.title',
    titleDefault: 'Explore Skills',
    descriptionKey: 'onboarding.skills.description',
    descriptionDefault: 'Skills give agents capabilities like file management, web browsing, and code execution. Browse the marketplace for more.',
    icon: 'action-skills',
  },
  {
    titleKey: 'onboarding.done.title',
    titleDefault: 'You\'re All Set!',
    descriptionKey: 'onboarding.done.description',
    descriptionDefault: 'Start chatting, create agents, or explore settings. You can re-run this walkthrough from Settings > System.',
    icon: 'ui-celebrate',
  },
]

export function OnboardingWizard() {
  const { t } = useI18n()
  const { onboarding, setOnboarding } = useAppStore()
  const dialogRef = useRef<HTMLDivElement>(null)
  const titleId = useId()
  const descriptionId = useId()

  useEffect(() => {
    if (!onboarding.completed && !onboarding.skipped) {
      dialogRef.current?.focus()
    }
  }, [onboarding.completed, onboarding.skipped])

  if (onboarding.completed || onboarding.skipped) return null

  const step = Math.max(0, Math.min(onboarding.currentStep || 0, STEPS.length - 1))
  const currentStep = STEPS[step]
  const isLast = step === STEPS.length - 1

  const complete = (destination?: 'models') => {
    setOnboarding({ completed: true, skipped: false, currentStep: step })
    if (destination === 'models' && typeof window !== 'undefined') {
      window.location.hash = '#/models'
    }
  }

  const next = () => {
    if (isLast) {
      complete()
    } else {
      setOnboarding({ currentStep: step + 1 })
    }
  }

  const skip = async () => {
    const ok = await confirm({
      title: t('onboarding.skipConfirm.title', 'Skip setup?'),
      body: t(
        'onboarding.skipConfirm.body',
        "You can re-run this walkthrough any time from Settings > System.",
      ),
      confirmText: t('onboarding.skip', 'Skip setup'),
      cancelText: t('common.cancel', 'Cancel'),
    })
    if (ok) setOnboarding({ skipped: true })
  }

  return (
    <div className="fixed inset-0 z-9999 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        tabIndex={-1}
        className="bg-surface-1 rounded-2xl border border-border shadow-2xl w-full max-w-md overflow-hidden animate-fade-in focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/30"
      >
        {/* Progress bar */}
        <div className="h-1 bg-surface-3">
          {/* Dynamic width requires inline style for runtime-computed percentage */}
          <div
            className="h-full bg-accent transition-all duration-300"
            {...{
              style: { width: `${((step + 1) / STEPS.length) * 100}%` },
              'aria-valuenow': step + 1,
              'aria-valuemin': 1,
              'aria-valuemax': STEPS.length,
              'aria-valuetext': `${t('onboarding.stepPrefix', 'Step')} ${step + 1} / ${STEPS.length}`,
            }}
            role="progressbar"
            aria-label={t('onboarding.progress', 'Onboarding progress')}
          />
        </div>

        <div className="p-8 text-center">
          <div className="text-5xl mb-6">{ICON_DATA[currentStep.icon] ? <IconifyIcon name={currentStep.icon} size={48} /> : currentStep.icon}</div>
          <h2 id={titleId} className="text-lg font-semibold text-text-primary mb-3 text-balance">
            {t(currentStep.titleKey, currentStep.titleDefault)}
          </h2>
          <p id={descriptionId} className="text-sm text-text-secondary leading-relaxed mb-8 text-pretty">
            {t(currentStep.descriptionKey, currentStep.descriptionDefault)}
          </p>

          {/* Step indicators */}
          <div aria-hidden="true" className="flex justify-center gap-1.5 mb-6">
            {STEPS.map((_, i) => (
              <div
                key={i}
                className={`w-2 h-2 rounded-full transition-all ${
                  i === step ? 'bg-accent w-6' : i < step ? 'bg-accent/40' : 'bg-surface-3'
                }`}
              />
            ))}
          </div>

          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={skip}
              className="text-xs text-text-muted hover:text-text-secondary transition-colors"
            >
              {t('onboarding.skip', 'Skip setup')}
            </button>
            <div className="flex items-center gap-2">
              {step > 0 && (
                <button
                  type="button"
                  onClick={() => setOnboarding({ currentStep: step - 1 })}
                  className="px-4 py-2.5 rounded-xl bg-surface-3 text-text-secondary text-sm font-medium hover:bg-surface-3/80 transition-colors"
                >
                  {t('onboarding.back', 'Back')}
                </button>
              )}
              {isLast && (
                <button
                  type="button"
                  onClick={() => complete('models')}
                  className="px-4 py-2.5 rounded-xl bg-surface-3 text-text-secondary text-sm font-medium hover:bg-surface-3/80 transition-colors"
                >
                  {t('onboarding.openModels', 'Open Models')}
                </button>
              )}
              <button
                type="button"
                onClick={next}
                className={`text-sm font-medium transition-colors ${
                  isLast
                    ? 'px-4 py-2.5 rounded-xl bg-accent text-white hover:bg-accent/90'
                    : 'px-6 py-2.5 rounded-xl bg-accent text-white hover:bg-accent/90'
                }`}
              >
                {isLast ? t('onboarding.getStarted', 'Get Started') : t('onboarding.next', 'Next')}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
