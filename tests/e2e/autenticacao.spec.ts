import { test, expect, type Page } from '@playwright/test'

const usuario = {
  id: 1, nome_completo: 'Ana Teste', cpf: '12345678901',
  vinculo_institucional: 'MAT123', email: 'ana@example.com', perfil: 'Membro', ativo: true,
}
const token = (agora: number, segundos = 900) => `a.${Buffer.from(JSON.stringify({ exp: Math.floor(agora / 1000) + segundos })).toString('base64url')}.c`

async function simularApi(page: Page, opcoes: { autenticado?: boolean; loginInvalido?: boolean; logoutFalha?: boolean; expiraEm?: number; perfil?: 'Membro' | 'Administrador' } = {}) {
  let autenticado = opcoes.autenticado ?? false
  const usuarioDaSessao = { ...usuario, perfil: opcoes.perfil ?? 'Membro' }
  const chamadas: { caminho: string; corpo: unknown; authorization?: string }[] = []
  // Na composição com o catálogo, o login também monta a consulta de espaços.
  await page.route('**/espacos/?*', route => route.fulfill({ status: 200, json: [] }))
  await page.route('**/usuarios/**', async route => {
    const request = route.request()
    const caminho = new URL(request.url()).pathname
    chamadas.push({ caminho, corpo: request.postDataJSON(), authorization: request.headers().authorization })
    const json = (status: number, body: unknown, headers = {}) => route.fulfill({ status, json: body, headers })
    if (caminho === '/usuarios/login') {
      if (opcoes.loginInvalido) return json(401, { detail: 'Credenciais inválidas.' })
      autenticado = true
      return json(200, { access_token: token(await page.evaluate(() => Date.now()), opcoes.expiraEm), token_type: 'bearer', usuario: usuarioDaSessao }, { 'set-cookie': 'refresh_token=simulado; HttpOnly; Path=/usuarios; SameSite=Lax' })
    }
    if (caminho === '/usuarios/refresh') return autenticado
      ? json(200, { access_token: token(await page.evaluate(() => Date.now())), token_type: 'bearer', usuario: usuarioDaSessao })
      : json(401, { detail: 'Sessão expirada' })
    if (caminho === '/usuarios/me') return autenticado ? json(200, usuarioDaSessao) : json(401, {})
    if (caminho === '/usuarios/recuperar-senha') return json(202, { detail: 'Instruções enviadas' })
    if (caminho === '/usuarios/redefinir-senha') return route.fulfill({ status: 204 })
    if (caminho === '/usuarios/') return json(201, usuario)
    if (caminho === '/usuarios/logout') {
      if (opcoes.logoutFalha) return route.abort('failed')
      autenticado = false
      return route.fulfill({ status: 204, headers: { 'set-cookie': 'refresh_token=; Max-Age=0; Path=/usuarios; HttpOnly' } })
    }
    return json(404, {})
  })
  return chamadas
}

async function entrar(page: Page) {
  await page.getByLabel('E-mail ou CPF').fill('ana@example.com')
  await page.getByLabel('Senha', { exact: true }).fill('SenhaValida123!')
  await page.getByRole('button', { name: 'Entrar', exact: true }).click()
}

for (const caminho of ['/', '/laboratorios/1', '/laboratorios/1/agendamento', '/laboratorios/1/agendamento/detalhes', '/meus-agendamentos', '/admin']) {
  test(`bloqueia acesso sem sessão a ${caminho}`, async ({ page }) => {
    await simularApi(page)
    await page.goto(caminho)
    await expect(page).toHaveURL(/\/login$/)
    await expect(page.getByText('Faça login para acessar o sistema.')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Sair', exact: true })).toHaveCount(0)
  })
}

test('login volta à agenda solicitada e mantém filtros e navegação dos colegas', async ({ page }) => {
  const chamadas = await simularApi(page)
  await page.goto('/meus-agendamentos')
  await entrar(page)
  await expect(page).toHaveURL(/\/meus-agendamentos$/)
  await expect(page.getByRole('heading', { name: 'Agendamentos', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Pendente', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Pendente', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await page.getByRole('link', { name: 'Laboratórios', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Encontre o laboratório ideal' })).toBeVisible()
  expect(chamadas.find(c => c.caminho === '/usuarios/me')?.authorization).toMatch(/^Bearer /)
  const cookies = await page.context().cookies()
  expect(cookies.find(c => c.name === 'refresh_token')?.httpOnly).toBe(true)
  expect(await page.evaluate(() => document.cookie)).not.toContain('refresh_token')
})

test('membro não acessa o painel do gestor', async ({ page }) => {
  await simularApi(page, { autenticado: true, perfil: 'Membro' })
  await page.goto('/admin')
  await expect(page.getByRole('heading', { name: 'Acesso restrito' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Painel do gestor' })).toHaveCount(0)
  await expect(page.getByRole('link', { name: 'Painel do gestor' })).toHaveCount(0)
})

test('administrador acessa o painel do gestor', async ({ page }) => {
  await simularApi(page, { autenticado: true, perfil: 'Administrador' })
  await page.goto('/admin')
  await expect(page.getByRole('heading', { name: 'Painel do gestor' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Painel do gestor' })).toBeVisible()
  await expect(page.getByRole('tab', { name: 'Aprovações' })).toBeVisible()
  await page.getByRole('tab', { name: 'Agenda' }).click()
  await expect(page.getByText('Nenhuma reserva carregada.')).toBeVisible()
})

test('gestor consegue acessar sair em telas menores', async ({ page }) => {
  await simularApi(page, { autenticado: true, perfil: 'Administrador' })
  const botaoSair = page.getByRole('button', { name: 'Sair', exact: true })
  for (const largura of [767, 390, 320]) {
    await page.setViewportSize({ width: largura, height: 695 })
    await page.goto('/admin')
    await expect(botaoSair).toBeVisible()
    const limites = await botaoSair.boundingBox()
    if (!limites) throw new Error('O botão Sair não possui uma posição visível na página.')
    expect(limites.x).toBeGreaterThanOrEqual(0)
    expect(limites.x + limites.width).toBeLessThanOrEqual(largura)
    if (largura <= 560) {
      expect(limites.width).toBeGreaterThan(200)
      expect(limites.height).toBeGreaterThanOrEqual(44)
    }
  }

  await botaoSair.click()
  await expect(page).toHaveURL(/\/login$/)
})

test('datas livres do calendário sempre apresentam horários para selecionar', async ({ page }) => {
  await simularApi(page, { autenticado: true })
  await page.goto('/laboratorios/1/agendamento')

  for (let mes = 0; mes < 4; mes += 1) {
    const diasLivres = page.locator('button.booking-calendar__day--livre:not([disabled])')
    const quantidade = await diasLivres.count()
    for (let dia = 0; dia < quantidade; dia += 1) {
      await diasLivres.nth(dia).click()
      await expect(page.locator('button.booking-time-slot--livre').first()).toBeVisible()
    }
    if (mes < 3) await page.getByRole('button', { name: 'Próximo mês' }).click()
  }
})

test('simulador local permite o ciclo professor → solicitação → decisão do gestor', async ({ page }) => {
  test.skip(process.env.VITE_LOCAL_SIMULATOR !== 'true', 'Execute com VITE_LOCAL_SIMULATOR=true.')
  await page.goto('/login')
  await page.evaluate(() => localStorage.clear())
  await page.getByLabel('E-mail ou CPF').fill('professor@teste.local')
  await page.getByLabel('Senha', { exact: true }).fill('Professor123!')
  await page.getByRole('button', { name: 'Entrar', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Encontre o laboratório ideal' })).toBeVisible()

  await page.getByRole('link', { name: 'Ver laboratório' }).first().click()
  await page.getByRole('link', { name: 'Solicitar agendamento' }).click()
  await page.locator('button.booking-calendar__day--livre:not([disabled])').first().click()
  const primeiroHorarioLivre = page.locator('button.booking-time-slot--livre').first()
  await primeiroHorarioLivre.click()
  await primeiroHorarioLivre.click()
  await page.getByRole('button', { name: 'Continuar para os detalhes' }).click()
  await page.getByLabel('Finalidade da solicitação *').fill('Aula de teste local')
  await page.getByRole('button', { name: 'Revisar solicitação' }).click()
  await page.getByRole('button', { name: 'Enviar solicitação de teste' }).click()
  await expect(page).toHaveURL(/\/meus-agendamentos$/)
  await expect(page.getByText('Aula de teste local')).toBeVisible()

  await page.getByRole('button', { name: 'Sair', exact: true }).click()
  await expect(page).toHaveURL(/\/login$/)
  await page.getByLabel('E-mail ou CPF').fill('gestor@teste.local')
  await page.getByLabel('Senha', { exact: true }).fill('Gestor123!')
  await page.getByRole('button', { name: 'Entrar', exact: true }).click()
  await page.goto('/admin')
  await expect(page.locator('p').filter({ hasText: 'Finalidade: Aula de teste local' })).toBeVisible()
  await page.getByRole('button', { name: 'Aprovar' }).click()
  await expect(page.getByText('Aprovado', { exact: true })).toBeVisible()
})

test('credenciais incorretas mostram erro sem abrir telas protegidas', async ({ page }) => {
  await simularApi(page, { loginInvalido: true })
  await page.goto('/login')
  await entrar(page)
  await expect(page.getByRole('alert')).toHaveText('Credenciais inválidas.')
  await expect(page).toHaveURL(/\/login$/)
})

test('cadastro valida confirmação e envia CPF normalizado sem perfil', async ({ page }) => {
  const chamadas = await simularApi(page)
  await page.goto('/cadastro')
  await page.getByLabel('Nome completo').fill('Ana Teste')
  await page.getByLabel('CPF', { exact: true }).fill('123.456.789-01')
  await page.getByLabel('Vínculo institucional (matrícula ou registro)').fill('MAT123')
  await page.getByLabel('E-mail', { exact: true }).fill('ana@example.com')
  await page.getByLabel('Senha (mínimo 8 caracteres)', { exact: true }).fill('SenhaValida123!')
  await page.getByLabel('Confirmar senha').fill('outra')
  await page.getByRole('button', { name: 'Criar conta' }).click()
  await expect(page.getByRole('alert')).toHaveText('As senhas não coincidem.')
  expect(chamadas).toHaveLength(0)
  await page.getByLabel('Confirmar senha').fill('SenhaValida123!')
  await page.getByRole('button', { name: 'Criar conta' }).click()
  await expect(page).toHaveURL(/\/login$/)
  expect(chamadas[0].corpo).toEqual({ nome_completo: 'Ana Teste', cpf: '12345678901', vinculo_institucional: 'MAT123', email: 'ana@example.com', senha: 'SenhaValida123!' })
})

test('cookie recupera sessão após recarregar sem access token local', async ({ page }) => {
  const chamadas = await simularApi(page, { autenticado: true })
  await page.goto('/meus-agendamentos')
  await expect(page.getByRole('heading', { name: 'Agendamentos', exact: true })).toBeVisible()
  await page.evaluate(() => sessionStorage.clear())
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Agendamentos', exact: true })).toBeVisible()
  expect(chamadas.filter(c => c.caminho === '/usuarios/refresh')).toHaveLength(2)
})

test('renova automaticamente antes da expiração com página aberta', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-01-01T10:00:00Z') })
  await page.clock.pauseAt(new Date('2026-01-01T10:01:00Z'))
  const chamadas = await simularApi(page, { expiraEm: 90 })
  await page.goto('/login')
  await entrar(page)
  await expect(page.getByRole('button', { name: 'Sair', exact: true })).toBeVisible()
  const inicial = await page.evaluate(() => sessionStorage.getItem('labagenda.access_token'))
  await page.clock.fastForward(59_000)
  expect(chamadas.filter(c => c.caminho === '/usuarios/refresh')).toHaveLength(0)
  await page.clock.fastForward(1_000)
  await expect.poll(() => chamadas.filter(c => c.caminho === '/usuarios/me').length).toBe(2)
  const renovado = await page.evaluate(() => sessionStorage.getItem('labagenda.access_token'))
  expect(renovado).toBeTruthy()
  expect(renovado).not.toBe(inicial)
  expect(chamadas.filter(c => c.caminho === '/usuarios/me').at(-1)?.authorization).toBe('Bearer ' + renovado)
  await page.clock.fastForward(60_000)
  expect(chamadas.filter(c => c.caminho === '/usuarios/refresh')).toHaveLength(1)
  await expect(page.getByRole('heading', { name: 'Encontre o laboratório ideal' })).toBeVisible()
})

test('logout remove sessão e impede restauração ao voltar e recarregar', async ({ page }) => {
  const chamadas = await simularApi(page)
  await page.goto('/login')
  await entrar(page)
  await page.getByRole('button', { name: 'Sair', exact: true }).click()
  await expect(page.getByText('Sessão encerrada.', { exact: true })).toBeVisible()
  expect(await page.evaluate(() => sessionStorage.getItem('labagenda.access_token'))).toBeNull()
  await page.goto('/meus-agendamentos')
  await expect(page).toHaveURL(/\/login$/)
  expect(chamadas.filter(c => c.caminho === '/usuarios/logout')).toHaveLength(1)
  expect(chamadas.filter(c => c.caminho === '/usuarios/refresh')).toHaveLength(0)
})

test('logout offline informa falha e oferece nova tentativa', async ({ page }) => {
  await simularApi(page, { logoutFalha: true })
  await page.goto('/login')
  await entrar(page)
  await page.getByRole('button', { name: 'Sair', exact: true }).click()
  await expect(page.getByText(/Não foi possível confirmar o logout/)).toBeVisible()
  await expect(page.getByRole('button', { name: 'Tentar encerrar sessão novamente' })).toBeVisible()
  await page.route('**/usuarios/logout', route => route.fulfill({ status: 204 }))
  await page.getByRole('button', { name: 'Tentar encerrar sessão novamente' }).click()
  await expect(page.getByText('Sessão encerrada.', { exact: true })).toBeVisible()
})

test('indisponibilidade da API permite tentar novamente sem mostrar conteúdo protegido', async ({ page }) => {
  await page.route('**/usuarios/**', route => route.abort('failed'))
  await page.goto('/meus-agendamentos')
  await expect(page.getByRole('heading', { name: 'Não foi possível verificar sua sessão' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Agendamentos', exact: true })).toHaveCount(0)
  await simularApi(page, { autenticado: true })
  await page.getByRole('button', { name: 'Tentar novamente', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Agendamentos', exact: true })).toBeVisible()
})

test('recuperação de senha solicita link e login cabe em tela móvel', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await simularApi(page)
  await page.goto('/recuperar-senha')
  await page.getByLabel('E-mail cadastrado').fill('membro@ifal.edu.br')
  await page.getByRole('button', { name: 'Enviar link de recuperação' }).click()
  await expect(page.getByText(/Se o e-mail estiver cadastrado e ativo/)).toBeVisible()
  await page.getByRole('link', { name: 'Voltar ao login' }).click()
  await expect(page.getByRole('button', { name: 'Entrar', exact: true })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.screenshot({ path: 'test-results/login-mobile.png', fullPage: true })
})

test('redefinição via token envia nova senha e remove token do endereço', async ({ page }) => {
  const chamadas = await simularApi(page)
  await page.goto('/recuperar-senha?token=' + 't'.repeat(43))
  await page.getByLabel('Nova senha (mínimo 8 caracteres)').fill('SenhaNova123!')
  await page.getByLabel('Confirmar nova senha').fill('SenhaNova123!')
  await page.getByRole('button', { name: 'Salvar nova senha' }).click()
  await expect(page).toHaveURL(/\/login$/)
  await expect(page.getByText('Senha redefinida com sucesso. Entre com a nova senha.')).toBeVisible()
  expect(chamadas.find(c => c.caminho === '/usuarios/redefinir-senha')?.corpo).toEqual({ token: 't'.repeat(43), nova_senha: 'SenhaNova123!' })
})

test('retorno à aba revalida uma sessão revogada e volta ao login', async ({ page }) => {
  const chamadas = await simularApi(page, { autenticado: true })
  await page.goto('/meus-agendamentos')
  await expect(page.getByRole('button', { name: 'Sair', exact: true })).toBeVisible()
  await page.route('**/usuarios/me', route => route.fulfill({ status: 401, json: {} }))
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')))
  await expect(page).toHaveURL(/\/login$/)
  expect(chamadas.filter(c => c.caminho === '/usuarios/refresh')).toHaveLength(2)
  expect(await page.evaluate(() => sessionStorage.getItem('labagenda.access_token'))).toBeNull()
})

test('link expirado permite solicitar outro sem levar o erro e a senha', async ({ page }) => {
  await page.route('**/usuarios/redefinir-senha', route => route.fulfill({ status: 400, json: {} }))
  await page.goto('/recuperar-senha?token=' + 't'.repeat(43))
  await page.getByLabel('Nova senha (mínimo 8 caracteres)').fill('Teste1234!')
  await page.getByLabel('Confirmar nova senha').fill('Teste12345!')
  await page.getByRole('button', { name: 'Salvar nova senha' }).click()
  await expect(page.getByRole('alert')).toHaveText('As senhas não coincidem.')
  await page.getByLabel('Confirmar nova senha').fill('Teste1234!')
  await page.getByRole('button', { name: 'Salvar nova senha' }).click()
  await expect(page.getByRole('alert')).toContainText('inválido ou expirado')
  await page.getByRole('link', { name: 'Solicitar outro link' }).click()
  await expect(page).toHaveURL(/\/recuperar-senha$/)
  await expect(page.getByLabel('E-mail cadastrado')).toBeEmpty()
  await expect(page.getByRole('alert')).toHaveCount(0)
})
