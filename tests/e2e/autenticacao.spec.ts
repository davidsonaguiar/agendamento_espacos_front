import { test, expect, type Page } from '@playwright/test'

const usuario = {
  id: 1, nome_completo: 'Ana Teste', cpf: '12345678901',
  vinculo_institucional: 'MAT123', email: 'ana@example.com', perfil: 'Membro', ativo: true,
}
const token = (segundos = 900) => `a.${Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + segundos })).toString('base64url')}.c`

async function simularApi(page: Page, opcoes: { autenticado?: boolean; loginInvalido?: boolean; logoutFalha?: boolean; expiraEm?: number } = {}) {
  let autenticado = opcoes.autenticado ?? false
  const chamadas: { caminho: string; corpo: unknown; authorization?: string }[] = []
  await page.route('**/usuarios/**', async route => {
    const request = route.request()
    const caminho = new URL(request.url()).pathname
    chamadas.push({ caminho, corpo: request.postDataJSON(), authorization: request.headers().authorization })
    const json = (status: number, body: unknown, headers = {}) => route.fulfill({ status, json: body, headers })
    if (caminho === '/usuarios/login') {
      if (opcoes.loginInvalido) return json(401, { detail: 'Credenciais inválidas.' })
      autenticado = true
      return json(200, { access_token: token(opcoes.expiraEm), token_type: 'bearer', usuario }, { 'set-cookie': 'refresh_token=simulado; HttpOnly; Path=/usuarios; SameSite=Lax' })
    }
    if (caminho === '/usuarios/refresh') return autenticado
      ? json(200, { access_token: token(), token_type: 'bearer', usuario })
      : json(401, { detail: 'Sessão expirada' })
    if (caminho === '/usuarios/me') return autenticado ? json(200, usuario) : json(401, {})
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

for (const caminho of ['/', '/laboratorios/1', '/laboratorios/1/agendamento', '/laboratorios/1/agendamento/detalhes', '/meus-agendamentos']) {
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
  await page.clock.install()
  const chamadas = await simularApi(page, { expiraEm: 90 })
  await page.goto('/login')
  await entrar(page)
  await expect(page.getByRole('button', { name: 'Sair', exact: true })).toBeVisible()
  await page.clock.fastForward(61_000)
  await expect.poll(() => chamadas.filter(c => c.caminho === '/usuarios/refresh').length).toBe(1)
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

test('recuperação de senha informa limite da API e login cabe em tela móvel', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/recuperar-senha')
  await expect(page.getByText(/A recuperação automática de senha ainda não está disponível/)).toBeVisible()
  await page.getByRole('link', { name: 'Voltar ao login' }).click()
  await expect(page.getByRole('button', { name: 'Entrar', exact: true })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.screenshot({ path: 'test-results/login-mobile.png', fullPage: true })
})
