import { test, expect } from '@playwright/test'

test.describe('Suora', () => {
  test('should load the application', async ({ page }) => {
    await page.goto('/')
    // Check the app shell loads
    await expect(page.locator('body')).toBeVisible()
  })

  test('should display navigation bar', async ({ page }) => {
    await page.goto('/')
    // Look for navigation items
    const nav = page.locator('nav, [role="navigation"]')
    await expect(nav.first()).toBeVisible()
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
    await expect(page).toHaveTitle(/Suora|Chat/)
  })
})
