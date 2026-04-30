import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { OnboardingWizard } from './OnboardingWizard'
import { useAppStore } from '@/store/appStore'

describe('OnboardingWizard', () => {
  beforeEach(() => {
    useAppStore.setState({
      onboarding: { completed: false, currentStep: 0, skipped: false },
    })
  })

  it('renders the first setup step when onboarding is incomplete', () => {
    render(<OnboardingWizard />)

    expect(screen.getByRole('dialog', { name: 'Welcome to Suora' })).toBeVisible()
    expect(screen.getByRole('progressbar', { name: 'Onboarding progress' })).toHaveAttribute('aria-valuenow', '1')
  })

  it('advances through steps and marks onboarding completed', async () => {
    const user = userEvent.setup()
    render(<OnboardingWizard />)

    for (let i = 0; i < 4; i++) {
      await user.click(screen.getByRole('button', { name: 'Next' }))
    }
    await user.click(screen.getByRole('button', { name: 'Get Started' }))

    expect(useAppStore.getState().onboarding.completed).toBe(true)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})
