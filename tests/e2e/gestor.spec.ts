import { expect, test, type Page } from '@playwright/test'

type Papel = 'Administrador' | 'Coordenador' | 'Monitor' | 'Membro'
async function montar(page: Page, papel: Papel, falharFila = false) {
  const usuario = { id: 7, nome_completo: 'Ana Gestora', perfil: papel === 'Administrador' ? papel : 'Membro',
    email: 'ana@example.com', cpf: '12345678901', vinculo_institucional: 'M123', ativo: true }
  const espacos = [1, 2].map(id => ({ id, nome: 'Laboratório ' + id, bloco: 'A', descricao: '', capacidade: 12,
    disponibilidade: true, horarios_funcionamento: [],
    usuarios_vinculados: id === 1 && ['Coordenador', 'Monitor'].includes(papel)
      ? [{ id_usuario: 7, nome_completo: usuario.nome_completo, perfil_espaco: papel }] : [] }))
  let status = 'Pendente'
  let conflito = true
  let leuFila = false
  await page.route(/\/(usuarios|espacos|solicitacoes|agendamentos)\//, async route => {
    const url = new URL(route.request().url())
    const json = (body: unknown, code = 200) => route.fulfill({ status: code, json: body })
    if (url.pathname === '/usuarios/refresh') return json({ access_token: 'token', token_type: 'bearer', usuario })
    if (url.pathname === '/usuarios/me') return json(usuario)
    if (url.pathname === '/espacos/') return json(espacos)
    if (url.pathname === '/solicitacoes/') {
      leuFila = true
      if (falharFila) return json({ detail: 'API indisponível' }, 503)
      return json(espacos.map(e => ({ id: e.id, id_espaco: e.id, status, finalidade: 'Aula ' + e.id, tipo: 'Espaço',
        solicitante: { nome_completo: 'Maria' }, horarios: [{ id: 1, data_reserva: '2030-01-15', hora_inicio: '09:00:00', hora_fim: '10:00:00' }] })))
    }
    if (url.pathname === '/solicitacoes/1/decisao') {
      if (conflito) { conflito = false; return json({ detail: 'Horário ocupado' }, 409) }
      status = route.request().postDataJSON().status
      return json({ status })
    }
    if (url.pathname === '/agendamentos/') return json([])
    return json({}, 404)
  })
  await page.goto('/admin')
  return {
    leuFila: () => leuFila,
    recuperar: () => { falharFila = false },
    revogarCoordenacao: () => { espacos[0].usuarios_vinculados = [] },
  }
}

for (const papel of ['Monitor', 'Membro'] as const) {
  test(papel + ' vê acesso restrito sem consultar solicitações', async ({ page }) => {
    const { leuFila } = await montar(page, papel)
    await expect(page.getByRole('heading', { name: 'Acesso restrito' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Painel do gestor' })).toHaveCount(0)
    expect(leuFila()).toBe(false)
  })
}

test('coordenador filtra, recupera falha de rede e decide sem aprovar em caso de conflito', async ({ page }) => {
  const api = await montar(page, 'Coordenador', true)
  await expect(page.getByRole('alert')).toContainText('API indisponível')
  api.recuperar()
  await page.getByRole('button', { name: 'Tentar novamente' }).click()
  await expect(page.getByRole('article')).toHaveCount(1)
  await page.getByLabel('Período').selectOption('Intervalo personalizado')
  await page.getByLabel('Data inicial').fill('2030-01-16')
  await expect(page.getByText('Nenhuma solicitação para os filtros selecionados.')).toBeVisible()
  await page.getByLabel('Data inicial').fill('2030-01-15')
  await page.getByRole('button', { name: 'Aprovar' }).click()
  await page.getByLabel('Justificativa').fill('Motivo para a decisão')
  await page.getByRole('button', { name: 'Confirmar' }).click()
  await expect(page.getByRole('dialog')).toContainText('Horário ocupado')
  await page.keyboard.press('Escape')
  await expect(page.getByRole('button', { name: 'Aprovar' })).toBeFocused()
  await page.getByRole('button', { name: 'Rejeitar' }).click()
  await page.getByLabel('Justificativa').fill('Horário ocupado.')
  await page.getByRole('button', { name: 'Confirmar' }).click()
  await expect(page.getByRole('article')).toContainText('Rejeitado')
  await expect(page.getByRole('button', { name: 'Aprovar' })).toHaveCount(0)
  await page.getByRole('tab', { name: 'Laboratórios' }).click()
  await expect(page.getByRole('button', { name: 'Cadastrar laboratório' })).toHaveCount(0)
  await expect(page.getByRole('article')).toHaveCount(1)
})

for (const width of [320, 768, 1366]) {
  test('administrador usa abas e modal pelo teclado em ' + width + ' px', async ({ page }) => {
    await page.setViewportSize({ width, height: 620 })
    await montar(page, 'Administrador')
    await expect(page.getByRole('article')).toHaveCount(2)
    await page.getByRole('tab', { name: 'Aprovações' }).focus()
    await page.keyboard.press('ArrowRight')
    await expect(page.getByRole('tab', { name: 'Agenda', exact: true })).toBeFocused()
    await expect(page.getByText('Nenhuma reserva confirmada neste período.')).toBeVisible()
    await page.keyboard.press('End')
    await page.getByRole('button', { name: 'Editar', exact: true }).first().click()
    const dialogo = page.getByRole('dialog')
    await expect(dialogo).toBeInViewport()
    await expect(dialogo.getByLabel('Nome', { exact: true })).toBeFocused()
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width)
    const caixa = await dialogo.boundingBox()
    expect(caixa!.x).toBeGreaterThanOrEqual(0)
    expect(caixa!.x + caixa!.width).toBeLessThanOrEqual(width)
    await page.keyboard.press('Escape')
    await expect(page.getByRole('button', { name: 'Editar', exact: true }).first()).toBeFocused()
  })
}


test('ao retornar à janela o coordenador perde o painel se o vínculo foi retirado', async ({ page }) => {
  const api = await montar(page, 'Coordenador')
  await page.getByRole('tab', { name: 'Agenda', exact: true }).click()
  await expect(page.getByText('Nenhuma reserva confirmada neste período.')).toBeVisible()
  api.revogarCoordenacao()
  await page.evaluate(() => window.dispatchEvent(new Event('focus')))
  await expect(page.getByRole('heading', { name: 'Acesso restrito' })).toBeVisible()
  await expect(page.getByRole('tablist')).toHaveCount(0)
})
