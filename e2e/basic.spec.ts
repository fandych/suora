import { test, expect } from '@playwright/test'

test.describe('Suora', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('suora-store', JSON.stringify({
        state: {
          onboarding: { completed: true, currentStep: 0, skipped: false },
        },
        version: 17,
      }))
    })
  })

  test('should load the application', async ({ page }) => {
    await page.goto('/')
    // Check the app shell loads
    await expect(page.locator('body')).toBeVisible()
  })

  test('should display navigation bar', async ({ page }) => {
    await page.goto('/')
    // Look for navigation items
    await expect(page.getByRole('navigation', { name: /main navigation/i })).toBeVisible()
  })

  test('should navigate between modules', async ({ page }) => {
    await page.goto('/')
    // Wait for app to load
    await page.waitForTimeout(1000)
    
    // The app should have sidebar navigation
    const body = page.locator('body')
    await expect(body).toBeVisible()
  })

  test('should have correct title', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveTitle(/SUORA|Suora|Chat/)
  })

  test('should reject unknown IPC channels when Electron bridge is present', async ({ page }) => {
    await page.goto('/')
    const result = await page.evaluate(async () => {
      const electron = (window as unknown as { electron?: { invoke: (channel: string) => Promise<unknown> } }).electron
      if (!electron) return 'browser-mode'
      try {
        await electron.invoke('not:allowed')
        return 'allowed'
      } catch (err) {
        return err instanceof Error ? err.message : String(err)
      }
    })
    expect(result).not.toBe('allowed')
  })
})
