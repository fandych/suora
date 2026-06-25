import { useEffect, useId, useRef } from 'react';
import { useAppStore } from '@/store/appStore';
import { ICON_DATA, IconifyIcon } from '@/components/icons/IconifyIcons';
import { useI18n } from '@/hooks/useI18n';
import { confirm } from '@/services/confirmDialog';
import { Button as UiButton } from "@/components/catalyst-ui/button";
import { workbenchNeutralButtonClass, workbenchPrimaryButtonClass, workbenchSectionEyebrowClass } from '@/components/catalyst-ui/workbench';
interface OnboardingStepDef {
    titleKey: string;
    titleDefault: string;
    descriptionKey: string;
    descriptionDefault: string;
    icon: string;
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
];
export function OnboardingWizard() {
    const { t } = useI18n();
    const { onboarding, setOnboarding } = useAppStore();
    const dialogRef = useRef<HTMLDivElement>(null);
    const titleId = useId();
    const descriptionId = useId();
    useEffect(() => {
        if (!onboarding.completed && !onboarding.skipped) {
            dialogRef.current?.focus();
        }
    }, [onboarding.completed, onboarding.skipped]);
    if (onboarding.completed || onboarding.skipped)
        return null;
    const step = Math.max(0, Math.min(onboarding.currentStep || 0, STEPS.length - 1));
    const currentStep = STEPS[step];
    const isLast = step === STEPS.length - 1;
    const complete = (destination?: 'models') => {
        setOnboarding({ completed: true, skipped: false, currentStep: step });
        if (destination === 'models' && typeof window !== 'undefined') {
            window.location.hash = '#/models';
        }
    };
    const next = () => {
        if (isLast) {
            complete();
        }
        else {
            setOnboarding({ currentStep: step + 1 });
        }
    };
    const skip = async () => {
        const ok = await confirm({
            title: t('onboarding.skipConfirm.title', 'Skip setup?'),
            body: t('onboarding.skipConfirm.body', 'You can re-run this walkthrough any time from Settings > System.'),
            confirmText: t('onboarding.skip', 'Skip setup'),
            cancelText: t('common.cancel', 'Cancel'),
        });
        if (ok)
            setOnboarding({ skipped: true });
    };
    return (<div className="fixed inset-0 z-9999 flex items-center justify-center bg-surface-0/78 px-4 py-6 backdrop-blur-md">
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={descriptionId} tabIndex={-1} className="chat-stage-panel w-full max-w-3xl overflow-hidden rounded-md border border-border-subtle/55 bg-surface-1/92 shadow-2xl animate-fade-in focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/30">
        <div className="h-1 bg-surface-3/90">
          <div className="h-full bg-accent transition-all duration-300" style={{ width: `${((step + 1) / STEPS.length) * 100}%` }} aria-valuenow={step + 1} aria-valuemin={1} aria-valuemax={STEPS.length} aria-valuetext={`${t('onboarding.stepPrefix', 'Step')} ${step + 1} / ${STEPS.length}`} role="progressbar" aria-label={t('onboarding.progress', 'Onboarding progress')}/>
        </div>

        <div className="grid gap-0 xl:grid-cols-[minmax(0,1.15fr)_18rem]">
          <div className="p-5 xl:p-7">
            <div className="flex flex-wrap gap-2">
              <span className="inline-flex items-center rounded-full border border-accent/18 bg-accent/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-accent">
                {t('onboarding.stepPrefix', 'Step')} {step + 1} / {STEPS.length}
              </span>
              <span className="inline-flex items-center rounded-full border border-border-subtle/50 bg-surface-0/46 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-text-muted/72">
                Suora setup
              </span>
            </div>

            <div className="mt-5 flex h-14 w-14 items-center justify-center rounded-md border border-accent/18 bg-accent/10 text-accent shadow-sm">
              {ICON_DATA[currentStep.icon] ? <IconifyIcon name={currentStep.icon} size={30}/> : currentStep.icon}
            </div>

            <h2 id={titleId} className="mt-5 max-w-2xl text-[24px] font-semibold leading-tight text-text-primary text-balance xl:text-[28px]">
              {t(currentStep.titleKey, currentStep.titleDefault)}
            </h2>
            <p id={descriptionId} className="mt-3 max-w-2xl text-[13px] leading-6 text-text-secondary/82 text-pretty">
              {t(currentStep.descriptionKey, currentStep.descriptionDefault)}
            </p>

            <div aria-hidden="true" className="mt-6 flex flex-wrap gap-2">
              {STEPS.map((item, index) => (<div key={item.titleKey} className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-medium transition-all ${index === step
                ? 'border-accent/20 bg-accent/12 text-accent'
                : index < step
                    ? 'border-success/20 bg-success/10 text-success'
                    : 'border-border-subtle/45 bg-surface-0/34 text-text-muted/72'}`}>
                  {index + 1}
                </div>))}
            </div>

            <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-border-subtle/40 pt-4">
              <UiButton unstyled type="button" onClick={skip} className="text-[12px] font-medium text-text-muted transition-colors hover:text-text-secondary">
                {t('onboarding.skip', 'Skip setup')}
              </UiButton>

              <div className="flex flex-wrap items-center gap-2">
                {step > 0 && (<UiButton unstyled type="button" onClick={() => setOnboarding({ currentStep: step - 1 })} className={workbenchNeutralButtonClass}>
                    {t('onboarding.back', 'Back')}
                  </UiButton>)}
                {isLast && (<UiButton unstyled type="button" onClick={() => complete('models')} className={workbenchNeutralButtonClass}>
                    {t('onboarding.openModels', 'Open Models')}
                  </UiButton>)}
                <UiButton unstyled type="button" onClick={next} className={workbenchPrimaryButtonClass}>
                  {isLast ? t('onboarding.getStarted', 'Get Started') : t('onboarding.next', 'Next')}
                </UiButton>
              </div>
            </div>
          </div>

          <aside className="border-t border-border-subtle/40 bg-surface-0/34 p-5 xl:border-l xl:border-t-0 xl:p-6">
            <div className={workbenchSectionEyebrowClass}>
              Setup flow
            </div>
            <div className="mt-3 space-y-2.5">
              {STEPS.map((item, index) => {
            const isCurrent = index === step;
            const isCompleted = index < step;
            return (<div key={item.titleKey} className={`rounded-md border px-3 py-2.5 ${isCurrent
                    ? 'border-accent/20 bg-accent/10'
                    : isCompleted
                        ? 'border-success/18 bg-success/8'
                        : 'border-border-subtle/45 bg-surface-0/28'}`}>
                    <div className="flex items-start gap-2.5">
                      <div className={`mt-0.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full text-[10px] font-semibold ${isCurrent
                    ? 'bg-accent text-white'
                    : isCompleted
                        ? 'bg-success text-surface-0'
                        : 'bg-surface-2 text-text-muted'}`}>
                        {index + 1}
                      </div>
                      <div className="min-w-0">
                        <div className={`text-[12px] font-semibold ${isCurrent ? 'text-text-primary' : 'text-text-secondary'}`}>
                          {t(item.titleKey, item.titleDefault)}
                        </div>
                        <div className="mt-1 text-[11px] leading-5 text-text-muted/78">
                          {t(item.descriptionKey, item.descriptionDefault)}
                        </div>
                      </div>
                    </div>
                  </div>);
        })}
            </div>
          </aside>
        </div>
      </div>
    </div>);
}

