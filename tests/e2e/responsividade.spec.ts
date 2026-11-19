import { test, expect } from '@playwright/test'

const telas = [
  { caminho: '/login', titulo: 'Entrar' },
  { caminho: '/cadastro', titulo: 'Criar conta' },
  { caminho: '/recuperar-senha', titulo: 'Recuperar senha' },
  { caminho: '/recuperar-senha?token=' + 't'.repeat(43), titulo: 'Definir nova senha' },
]

for (const [width, height] of [[320, 568], [375, 480], [390, 844], [420, 740], [768, 1024], [1024, 768], [1366, 768]]) {
  test(`formulários de acesso a ${width} × ${height} com navegação por teclado`, async ({ page }, info) => {
    await page.setViewportSize({ width, height })
    for (const { caminho, titulo } of telas) {
      await page.goto(caminho)
      await expect(page.getByRole('heading', { name: titulo, exact: true })).toBeVisible()
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width)
      const controles = page.locator('input, button, a[href]')
      for (const controle of await controles.all()) {
        await page.keyboard.press('Tab')
        await expect(controle).toBeFocused()
        await expect(controle).toBeInViewport({ ratio: 1 })
        const caixa = await controle.boundingBox()
        expect(caixa!.x).toBeGreaterThanOrEqual(0)
        expect(caixa!.x + caixa!.width).toBeLessThanOrEqual(width)
      }
      if (width === 320 || width === 1366) {
        await page.screenshot({ path: info.outputPath(titulo + '.png'), fullPage: true })
      }
    }
  })
}
