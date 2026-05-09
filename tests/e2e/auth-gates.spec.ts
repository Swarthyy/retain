import { expect, test } from '@playwright/test'

test('login renders email OTP entry point', async ({ page }) => {
  await page.goto('/login')
  await expect(page.getByText('retain')).toBeVisible()
  await expect(page.getByPlaceholder('email')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Email me a code' })).toBeVisible()
})

test('protected app routes redirect unauthenticated users to login', async ({ page }) => {
  for (const route of ['/today', '/leaderboard', '/feed', '/profile']) {
    await page.goto(route)
    await expect(page).toHaveURL(/\/login$/)
    await expect(page.getByRole('button', { name: 'Email me a code' })).toBeVisible()
  }
})
