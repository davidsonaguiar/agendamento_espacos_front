import { test, expect, type Page } from '@playwright/test'

const usuario = {
  id: 1, nome_completo: 'Ana Teste', cpf: '12345678901',
  vinculo_institucional: 'MAT123', email: 'ana@example.com', perfil: 'Membro', ativo: true,
}
const espacoApi = {
  id: 77, nome: 'Laboratório API 77', descricao: 'Dados simulados para teste da integração', capacidade: 20, bloco: 'Bloco X', disponibilidade: true,
  recursos: [{ id: 501, nome: 'Impressora 3D', tipo: 'Equipamento', autorizacao_necessaria: true, disponibilidade: false, reserva_independente: true, id_espaco: 77 }],
  horarios_funcionamento: [], pausas_funcionamento: [], usuarios_vinculados: [],
}
const token = (segundos = 900, agora = Date.now()) => `a.${Buffer.from(JSON.stringify({ exp: Math.floor(agora / 1000) + segundos })).toString('base64url')}.c`

async function simularApi(page: Page, opcoes: { autenticado?: boolean; loginInvalido?: boolean; logoutFalha?: boolean; expiraEm?: number; perfil?: 'Membro' | 'Administrador' } = {}) {
  let autenticado = opcoes.autenticado ?? false
  const usuarioDaSessao = { ...usuario, perfil: opcoes.perfil ?? 'Membro' }
  const chamadas: { caminho: string; corpo: unknown; authorization?: string }[] = []
  await page.route('**/usuarios/**', async route => {
    const request = route.request()
    const caminho = new URL(request.url()).pathname
    chamadas.push({ caminho, corpo: request.postDataJSON(), authorization: request.headers().authorization })
    const json = (status: number, body: unknown, headers = {}) => route.fulfill({ status, json: body, headers })
    if (caminho === '/usuarios/login') {
      if (opcoes.loginInvalido) return json(401, { detail: 'Credenciais inválidas.' })
      autenticado = true
      return json(200, { access_token: token(opcoes.expiraEm, await page.evaluate(() => Date.now())), token_type: 'bearer', usuario: usuarioDaSessao }, { 'set-cookie': 'refresh_token=simulado; HttpOnly; Path=/usuarios; SameSite=Lax' })
    }
    if (caminho === '/usuarios/refresh') return autenticado
      ? json(200, { access_token: token(900, await page.evaluate(() => Date.now())), token_type: 'bearer', usuario: usuarioDaSessao })
      : json(401, { detail: 'Sessão expirada' })
    if (caminho === '/usuarios/recuperar-senha') return json(202, { detail: 'Instruções enviadas' })
    if (caminho === '/usuarios/redefinir-senha') return route.fulfill({ status: 204 })
    if (caminho === '/usuarios/me') return autenticado ? json(200, usuarioDaSessao) : json(401, {})
    if (caminho === '/usuarios/') return json(201, usuario)
    if (caminho === '/usuarios/logout') {
      if (opcoes.logoutFalha) return route.abort('failed')
      autenticado = false
      return route.fulfill({ status: 204, headers: { 'set-cookie': 'refresh_token=; Max-Age=0; Path=/usuarios; HttpOnly' } })
    }
    return json(404, {})
  })
  const espacos = [espacoApi]
  await page.route('**/espacos/**', async route => {
    const request = route.request()
    const url = new URL(request.url())
    chamadas.push({ caminho: url.pathname + url.search, corpo: request.postDataJSON(), authorization: request.headers().authorization })
    if (!autenticado || !request.headers().authorization?.startsWith('Bearer ')) {
      return route.fulfill({ status: 401, json: { detail: 'Sessão expirada' } })
    }
    if (request.method() === 'POST') {
      const criado = { ...espacoApi, ...request.postDataJSON(), id: 78 }
      espacos.push(criado)
      return route.fulfill({ status: 201, json: criado })
    }
    expect(request.method()).toBe('GET')
    return route.fulfill({ status: 200, json: Number(url.searchParams.get('skip')) === 0 ? espacos : [] })
  })
  await page.route('**/agendamentos/**', async route => {
    expect(route.request().method()).toBe('GET')
    return route.fulfill({ status: 200, json: [] })
  })
  await page.route('**/solicitacoes/**', async route => {
    expect(route.request().method()).toBe('GET')
    return route.fulfill({ status: autenticado ? 200 : 401, json: autenticado ? [] : { detail: 'Sessão expirada' } })
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
  await expect(page.getByText('Nenhuma reserva confirmada neste período.')).toBeVisible()
})

test('administrador lista e cadastra laboratório pela API', async ({ page }) => {
  const chamadas = await simularApi(page, { autenticado: true, perfil: 'Administrador' })
  await page.goto('/admin')
  await page.getByRole('tab', { name: 'Laboratórios' }).click()
  await expect(page.getByRole('heading', { name: 'Laboratórios cadastrados' })).toBeVisible()
  await expect(page.getByRole('heading', { name: espacoApi.nome })).toBeVisible()

  await page.getByLabel('Nome *').fill('Laboratório de Teste')
  await page.getByLabel('Descrição').fill('Bancadas para aulas')
  await page.getByLabel('Capacidade').fill('24')
  await page.getByLabel('Bloco').fill('Bloco D')
  await page.getByRole('button', { name: 'Cadastrar laboratório' }).click()

  await expect(page.getByRole('status').filter({ hasText: 'cadastrado com sucesso' })).toHaveText('Espaço "Laboratório de Teste" cadastrado com sucesso.')
  await expect(page.getByRole('heading', { name: 'Laboratório de Teste' })).toBeVisible()
  const chamada = chamadas.find(item => item.caminho === '/espacos/' && item.corpo !== null)
  expect(chamada?.corpo).toEqual({
    nome: 'Laboratório de Teste',
    descricao: 'Bancadas para aulas',
    capacidade: 24,
    bloco: 'Bloco D',
    disponibilidade: true,
  })
  expect(chamada?.authorization).toMatch(/^Bearer /)
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
  await page.clock.install({ time: new Date('2027-02-10T08:00:00') })
  await page.route('**/agendamentos/horarios-disponiveis?**', route => {
    const query = new URL(route.request().url()).searchParams
    expect(query.get('id_espaco')).toBe('77')
    const mes = query.get('data_fim')!.slice(0, 7)
    return route.fulfill({ json: ['15', '20'].map(dia => ({
      data_hora_inicio: mes + '-' + dia + 'T09:00:00', data_hora_fim: mes + '-' + dia + 'T10:00:00',
    })) })
  })
  await page.goto('/laboratorios/77/agendamento')

  for (let mes = 0; mes < 4; mes += 1) {
    const diasLivres = page.locator('button.booking-calendar__day--livre:not([disabled])')
    await expect(diasLivres).toHaveCount(2)
    const quantidade = await diasLivres.count()
    for (let dia = 0; dia < quantidade; dia += 1) {
      await diasLivres.nth(dia).click()
      await expect(page.locator('button.booking-time-slot:not([disabled])').first()).toBeVisible()
    }
    if (mes < 3) await page.getByRole('button', { name: 'Próximo mês' }).click()
  }
})

test('simulador local permite o ciclo professor → solicitação → decisão do gestor', async ({ page }) => {
  const chamadasApi: string[] = []
  page.on('request', req => {
    if (/^\/(usuarios|espacos|agendamentos|solicitacoes)\//.test(new URL(req.url()).pathname)) chamadasApi.push(req.url())
  })
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
  expect(chamadasApi).toEqual([])
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

test('recuperação de senha informa quando API não oferece endpoint', async ({ page }) => {
  await page.route('**/usuarios/recuperar-senha', route => route.fulfill({ status: 404, json: { detail: 'Not Found' } }))
  await page.goto('/recuperar-senha')
  await page.getByLabel('E-mail cadastrado').fill('membro@ifal.edu.br')
  await page.getByRole('button', { name: 'Enviar link de recuperação' }).click()
  await expect(page.getByRole('alert')).toContainText('ainda não está disponível nesta versão da API')
})


test('catálogo autenticado busca recurso sem apresentar fixture ou reserva independente', async ({ page }) => {
  const chamadas = await simularApi(page, { autenticado: true })
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Laboratório API 77' })).toBeVisible()
  await page.getByRole('searchbox', { name: 'Buscar laboratório ou recurso' }).fill('IMPRESSORA 3D')
  await expect(page.getByRole('heading', { name: 'Laboratório API 77' })).toBeVisible()
  await expect(page.getByText(/Impressora 3D — Indisponível/)).toBeVisible()
  await expect(page.getByRole('button', { name: /Reservar equipamento/ })).toHaveCount(0)
  expect(chamadas.find(c => c.caminho.startsWith('/espacos/'))?.authorization).toMatch(/^Bearer /)
})

test('login retorna a detalhes reais pelo ID e preserva query string interna', async ({ page }) => {
  const chamadas = await simularApi(page)
  await page.goto('/laboratorios/77?origem=catalogo')
  await entrar(page)
  await expect(page).toHaveURL(/\/laboratorios\/77\?origem=catalogo$/)
  await expect(page.getByRole('heading', { name: 'Laboratório API 77', exact: true })).toBeVisible()
  await expect(page.locator('.breadcrumb')).toContainText('Detalhes do laboratório')
  await expect(page.getByText(espacoApi.descricao, { exact: true })).toBeVisible()
  await expect(page.getByText('Bloco X', { exact: true })).toBeVisible()
  await expect(page.getByText('20 pessoas', { exact: true })).toBeVisible()
  await expect(page.getByText(/Impressora 3D.*Indisponível/)).toBeVisible()
  await expect(page.getByText('Horários de funcionamento não informados.', { exact: true })).toBeVisible()
  await expect(page.getByText('COLAB', { exact: true })).toHaveCount(0)
  expect(chamadas.find(c => c.caminho.startsWith('/espacos/'))?.authorization).toMatch(/^Bearer /)
  await page.getByRole('link', { name: 'Consultar horários disponíveis', exact: true }).click()
  await expect(page).toHaveURL(/\/laboratorios\/77\/agendamento$/)
  await expect(page.getByRole('heading', { name: 'Escolha a data e o horário' })).toBeVisible()
  await expect(page.getByText('Nenhum horário disponível neste período.', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Continuar para os detalhes' })).toBeDisabled()
})

test('calendário integrado consulta ID real, trata falha e vazio e navega até a prévia', async ({ page }) => {
  await simularApi(page, { autenticado: true })
  let falhar = true
  let liberar!: () => void
  const espera = new Promise<void>(resolve => { liberar = resolve })
  const consultas: URL[] = []
  await page.route('**/agendamentos/**', async route => {
    const request = route.request()
    const url = new URL(request.url())
    expect(request.method()).toBe('GET')
    expect(url.pathname).toBe('/agendamentos/horarios-disponiveis')
    expect(url.searchParams.get('id_espaco')).toBe('77')
    expect(request.headers().authorization).toMatch(/^Bearer /)
    consultas.push(url)
    if (falhar) {
      await espera
      return route.fulfill({ status: 500, json: { detail: 'Disponibilidade indisponível no teste' } })
    }
    const data = '2090-01-07'
    return route.fulfill({ status: 200, json: url.searchParams.get('data_inicio')! <= data && url.searchParams.get('data_fim')! >= data ? [
      { data_hora_inicio: `${data}T08:00:00`, data_hora_fim: `${data}T09:00:00` },
    ] : [] })
  })
  await page.goto('/laboratorios/77/agendamento?mes=2090-01')
  await expect(page.getByText('Carregando disponibilidade...', { exact: true })).toBeVisible()
  await expect.poll(() => consultas.length).toBeGreaterThan(0)
  liberar()
  await expect(page.getByRole('alert')).toContainText('Disponibilidade indisponível no teste')
  await expect(page.getByRole('button', { name: 'Continuar para os detalhes' })).toBeDisabled()
  falhar = false
  await page.getByRole('button', { name: 'Tentar novamente', exact: true }).click()
  const dia = page.getByRole('button', { name: /7 de janeiro de 2090: horários disponíveis/ })
  await expect(dia).toBeEnabled()
  expect(consultas.some(url => url.searchParams.get('data_inicio') === '2090-01-01' && url.searchParams.get('data_fim') === '2090-01-31')).toBe(true)
  await expect(page.getByRole('button', { name: /, 8 de janeiro de 2090: sem horários disponíveis$/ })).toBeDisabled()
  await page.getByRole('button', { name: 'Próximo mês' }).click()
  await expect(page.getByText('Nenhum horário disponível neste período.', { exact: true })).toBeVisible()
  expect(consultas.some(url => url.searchParams.get('data_inicio') === '2090-02-01' && url.searchParams.get('data_fim') === '2090-02-28')).toBe(true)
  await page.getByRole('button', { name: 'Mês anterior' }).click()
  await dia.click()
  const slot = page.getByRole('button', { name: /08:00–09:00/ })
  await slot.click()
  await slot.click()
  await expect(page.getByRole('region', { name: 'Resumo do intervalo' })).toContainText('2090-01-07 · 08:00–09:00')
  await page.getByRole('button', { name: 'Continuar para os detalhes' }).click()
  await expect(page).toHaveURL(/\/laboratorios\/77\/agendamento\/detalhes\?/)
  const selecao = new URL(page.url()).searchParams
  expect(selecao.get('data')).toBe('2090-01-07')
  expect(selecao.get('inicio')).toBe('08:00:00')
  expect(selecao.get('fim')).toBe('09:00:00')
  await expect(page.getByRole('heading', { name: 'Resumo da seleção' })).toBeVisible()
  expect(consultas.some(url => url.searchParams.get('data_inicio') === '2090-01-07' && url.searchParams.get('data_fim') === '2090-01-07')).toBe(true)
  await expect(page.getByRole('button', { name: 'Enviar solicitação', exact: true })).toBeDisabled()
})

test('prévia integrada revalida seleção pela API e bloqueia intervalo inválido', async ({ page }) => {
  await simularApi(page, { autenticado: true })
  const consultas: URL[] = []
  let escritas = 0
  await page.route('**/solicitacoes/**', async route => {
    if (route.request().method() !== 'GET') escritas++
    await route.abort('blockedbyclient')
  })
  await page.route('**/agendamentos/**', async route => {
    const request = route.request()
    const url = new URL(request.url())
    expect(request.method()).toBe('GET')
    expect(url.pathname).toBe('/agendamentos/horarios-disponiveis')
    expect(url.searchParams.get('id_espaco')).toBe('77')
    expect(request.headers().authorization).toMatch(/^Bearer /)
    consultas.push(url)
    return route.fulfill({ status: 200, json: [
      { data_hora_inicio: '2090-01-07T08:00:00', data_hora_fim: '2090-01-07T09:00:00' },
    ] })
  })
  const base = '/laboratorios/77/agendamento/detalhes'
  await page.goto(base)
  await expect(page.getByRole('heading', { name: 'Prévia da solicitação' })).toBeVisible()
  await expect(page.getByRole('alert')).toContainText('Seleção ausente ou inválida')
  await expect(page.getByLabel('Finalidade da solicitação', { exact: true })).toHaveCount(0)
  expect(consultas).toHaveLength(0)
  await page.goto(`${base}?mes=2090-01&data=2090-01-07&inicio=08:00:00&fim=09:00:00`)
  await expect(page.getByRole('heading', { name: 'Resumo da seleção' })).toBeVisible()
  const resumo = page.locator('.booking-details-summary')
  await expect(resumo).toContainText('Laboratório API 77')
  await expect(resumo).toContainText('2090-01-07')
  await expect(resumo).toContainText('08:00')
  await expect(resumo).toContainText('09:00')
  expect(consultas.some(url => url.searchParams.get('data_inicio') === '2090-01-07' && url.searchParams.get('data_fim') === '2090-01-07')).toBe(true)
  await expect(page.getByLabel('Finalidade da solicitação', { exact: true })).toBeEditable()
  await expect(page.getByRole('button', { name: 'Enviar solicitação', exact: true })).toBeDisabled()
  await page.getByRole('link', { name: 'Voltar ao calendário' }).click()
  const retorno = new URL(page.url())
  expect(retorno.pathname).toBe('/laboratorios/77/agendamento')
  expect(retorno.searchParams.get('data')).toBe('2090-01-07')
  expect(retorno.searchParams.get('inicio')).toBe('08:00:00')
  expect(retorno.searchParams.get('fim')).toBe('09:00:00')
  await page.goto(`${base}?data=2090-01-07&inicio=08:00:00&fim=10:00:00`)
  await expect(page.getByRole('alert')).toContainText('Seleção ausente ou inválida')
  await expect(page.getByRole('heading', { name: 'Resumo da seleção' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Revisar solicitação' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Enviar solicitação', exact: true })).toHaveCount(0)
  expect(consultas.length).toBeGreaterThanOrEqual(2)
  expect(escritas).toBe(0)
})

test('catálogo recupera 401 com refresh e repete somente a página que falhou', async ({ page }) => {
  await simularApi(page, { autenticado: true })
  let rotacoes = 0
  const tokens: string[] = []
  await page.route('**/usuarios/refresh', async route => {
    expect(route.request().method()).toBe('POST')
    const access_token = token(900 + ++rotacoes, await page.evaluate(() => Date.now()))
    tokens.push(access_token)
    return route.fulfill({ status: 200, json: { access_token, token_type: 'bearer', usuario } })
  })
  const autorizacoes: string[] = []
  // Catalogo e AcessoGestor paginam independentemente (o segundo consulta
  // vinculos para o cabecalho). Ambas as leituras devem compartilhar o refresh.
  // O token antigo recebe 401 em toda consulta da segunda pagina; nao apenas
  // na primeira chamada global, que poderia pertencer a qualquer consumidor.
  await page.route('**/espacos/**', async route => {
    const request = route.request()
    const url = new URL(request.url())
    expect(request.method()).toBe('GET')
    expect(url.searchParams.get('limit')).toBe('100')
    if (url.searchParams.get('skip') === '0') {
      return route.fulfill({ status: 200, json: Array.from({ length: 100 }, (_, i) => ({ ...espacoApi, id: 1000 + i, nome: `Espaço paginado ${i}`, recursos: [] })) })
    }
    expect(url.searchParams.get('skip')).toBe('100')
    autorizacoes.push(request.headers().authorization)
    return route.fulfill(request.headers().authorization === `Bearer ${tokens[0]}`
      ? { status: 401, json: { detail: 'Access token expirado' } }
      : { status: 200, json: [espacoApi] })
  })
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Laboratório API 77', exact: true })).toBeVisible()
  expect(rotacoes).toBe(2)
  expect(autorizacoes).toContain(`Bearer ${tokens[0]}`)
  expect(autorizacoes).toContain(`Bearer ${tokens[1]}`)
  expect(autorizacoes.every(acesso => tokens.some(valor => acesso === `Bearer ${valor}`))).toBe(true)
  expect(tokens[0]).not.toBe(tokens[1])
  // Verifica o resultado completo, sem impor contagem global aos consumidores.
  await expect(page.getByRole('heading', { name: /^Espaço paginado \d+$/ })).toHaveCount(100)
})


const consultaAgenda = (id = 3, autor = 1) => ({
  id, finalidade: `Finalidade API ${id}`, urgencia: false, status: 'Pendente', decisao_justificativa: null,
  id_projeto: null, id_solicitante: autor, id_espaco: 2, espaco_reservado: true,
  espaco: { id: 2, nome: 'Sala de reuniões (seed)', descricao: null, capacidade: 12, bloco: null, disponibilidade: true },
  projeto: null, solicitante: null, usuarios_envolvidos: [], ids_recursos: [], anexos: [], interacoes: [],
  horarios: [{ id: 3, data_reserva: '2026-11-22', hora_inicio: '13:00:00.000001', hora_fim: '14:00:00.000002' }],
})

test('D5B lista própria real simulada filtra e atualiza sem criar solicitação', async ({ page }) => {
  await simularApi(page, { autenticado: true })
  let lista = [consultaAgenda(), consultaAgenda(4, 99)]
  let leituras = 0
  await page.route('**/solicitacoes/**', async route => {
    expect(route.request().method()).toBe('GET')
    expect(route.request().postData()).toBeNull()
    leituras++
    return route.fulfill({ status: 200, json: lista })
  })
  await page.goto('/meus-agendamentos')
  await expect(page.getByText('Solicitação #3', { exact: true })).toBeVisible()
  await expect(page.getByText('Finalidade API 4', { exact: true })).toHaveCount(0)
  await expect(page.getByText('Duração: 1 h 0,000001 s', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Rejeitado', exact: true }).click()
  await expect(page.getByText(/Nenhuma solicitação corresponde/)).toBeVisible()
  await page.getByRole('button', { name: 'Todos', exact: true }).click()
  lista = []
  const antesDeAtualizar = leituras
  await page.getByRole('button', { name: 'Atualizar', exact: true }).click()
  await expect(page.getByText('Você ainda não possui solicitações.')).toBeVisible()
  expect(leituras - antesDeAtualizar).toBe(1)
})

test('D5B troca de usuário limpa cartões no navegador sem polling', async ({ page }) => {
  await simularApi(page, { autenticado: true })
  await page.route('**/solicitacoes/**', async route => {
    expect(route.request().method()).toBe('GET')
    return route.fulfill({ status: 200, json: [consultaAgenda(), consultaAgenda(4, 99)] })
  })
  await page.goto('/meus-agendamentos')
  await expect(page.getByText('Solicitação #3', { exact: true })).toBeVisible()
  await page.evaluate(() => {
    const salvo = JSON.parse(sessionStorage.getItem('labagenda.usuario')!)
    sessionStorage.setItem('labagenda.usuario', JSON.stringify({ ...salvo, id: 99 }))
  })
  await expect(page.getByText('Solicitação #3', { exact: true })).toHaveCount(0)
  await expect(page.getByText('Solicitação #4', { exact: true })).toBeVisible()
  await page.evaluate(() => { sessionStorage.removeItem('labagenda.usuario'); sessionStorage.removeItem('labagenda.access_token') })
  await expect(page.getByRole('article')).toHaveCount(0)
  await expect(page.getByRole('link', { name: 'Entrar novamente' })).toBeVisible()
})


test.describe('D5C filtros e apresentação', () => {
  test.use({ timezoneId: 'America/Sao_Paulo' })
  async function prepararAgenda(page: Page) {
    await simularApi(page, { autenticado: true })
    await page.addInitScript(({ usuario, access }) => {
      sessionStorage.setItem('labagenda.usuario', JSON.stringify(usuario))
      sessionStorage.setItem('labagenda.access_token', access)
    }, { usuario, access: token(315360000) })
    let leituras = 0
    await page.route('**/solicitacoes/**', async route => {
      expect(route.request().method()).toBe('GET')
      leituras++
      return route.fulfill({ status: 200, json: [consultaAgenda(), { ...consultaAgenda(5), status: 'Rejeitado', horarios: [{ id: 5, data_reserva: '2026-11-19', hora_inicio: '00:00:00', hora_fim: '01:00:00' }] }] })
    })
    return () => leituras
  }
  test('controles rotulados, teclado e combinação de filtros sem nova consulta', async ({ page }) => {
    const leituras = await prepararAgenda(page)
    await page.goto('/meus-agendamentos')
    await expect(page.getByText('Solicitação #3', { exact: true })).toBeVisible()
    const antes = leituras()
    await page.getByLabel('Período de utilização').selectOption('personalizado')
    await expect(page.getByRole('alert')).toContainText('Informe a data inicial')
    await expect(page.getByRole('article')).toHaveCount(0)
    await page.getByLabel('Data inicial').fill('2026-11-23')
    await page.getByLabel('Data final').fill('2026-11-22')
    await expect(page.getByRole('alert')).toContainText('igual ou posterior')
    await page.getByLabel('Data inicial').fill('2026-11-22')
    await expect(page.getByRole('article')).toHaveCount(1)
    await page.getByRole('button', { name: 'Rejeitado', exact: true }).click()
    await expect(page.getByRole('article')).toHaveCount(0)
    await page.getByRole('button', { name: 'Todos', exact: true }).click()
    await page.getByLabel('Período de utilização').focus()
    await page.keyboard.press('Tab')
    await expect(page.getByLabel('Ordenação')).toBeFocused()
    expect(await page.getByLabel('Ordenação').evaluate(el => getComputedStyle(el).outlineStyle)).not.toBe('none')
    expect(leituras()).toBe(antes)
  })
  test('virada do dia local em tela aberta recalcula Passados', async ({ page }) => {
    await page.clock.install({ time: new Date('2026-11-20T02:59:59Z') })
    const leituras = await prepararAgenda(page)
    await page.goto('/meus-agendamentos')
    await expect(page.getByText('Solicitação #5', { exact: true })).toBeVisible()
    await page.getByLabel('Período de utilização').selectOption('passados')
    await expect(page.getByRole('article')).toHaveCount(0)
    const antes = leituras()
    await page.clock.fastForward(2000)
    await expect(page.getByText('Solicitação #5', { exact: true })).toBeVisible()
    expect(leituras()).toBe(antes)
  })
  test('layout a 320, 375, 393 e 768px com controles personalizados e zoom 200%', async ({ page }) => {
    await prepararAgenda(page)
    await page.goto('/meus-agendamentos')
    await expect(page.getByText('Solicitação #3', { exact: true })).toBeVisible()
    await page.getByLabel('Período de utilização').selectOption('personalizado')
    await page.getByLabel('Data inicial').fill('2026-11-22')
    await page.getByLabel('Data final').fill('2026-11-22')
    for (const largura of [320, 375, 393, 768]) {
      await page.setViewportSize({ width: largura, height: 900 })
      expect(await page.evaluate(() => Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) <= innerWidth + 1), `overflow a ${largura}px`).toBe(true)
      const botao = await page.getByRole('button', { name: 'Atualizar', exact: true }).boundingBox()
      expect(botao!.height).toBeGreaterThanOrEqual(44)
      expect(botao!.width).toBeLessThan(160)
      for (const nome of ['Período de utilização', 'Ordenação', 'Data inicial', 'Data final']) {
        const box = await page.getByLabel(nome).boundingBox()
        expect(box!.x).toBeGreaterThanOrEqual(0)
        expect(box!.x + box!.width).toBeLessThanOrEqual(largura)
      }
      await page.screenshot({ path: `test-results/agenda-d5c-${largura}.png`, fullPage: true })
    }
    await page.evaluate(() => { document.documentElement.style.zoom = '2' })
    await page.screenshot({ path: 'test-results/agenda-d5c-zoom-200.png', fullPage: true })
    const transbordos = await page.evaluate(() => [...document.querySelectorAll('*')].filter(el => el.getBoundingClientRect().right > innerWidth + 1).slice(0, 8).map(el => `${el.tagName}.${el.className}`))
    expect(await page.evaluate(() => Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) <= innerWidth + 1), `overflow com zoom CSS 200%: ${transbordos.join(', ')}`).toBe(true)
    await expect(page.getByLabel('Data final')).toBeVisible()
    await page.screenshot({ path: 'test-results/agenda-d5c-zoom-200.png', fullPage: true })
  })
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

test('membro envia um intervalo do catálogo e consulta o resultado na agenda pessoal', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 700 })
  await page.clock.install({ time: new Date('2027-02-10T08:00:00') })
  await simularApi(page, { autenticado: true })
  const dia = '2027-02-18'
  const horarios = ['09', '10', '13'].map(h => ({
    data_hora_inicio: dia + 'T' + h + ':00:00',
    data_hora_fim: dia + 'T' + String(Number(h) + 1) + ':00:00',
  }))
  await page.route('**/agendamentos/horarios-disponiveis?**', route => route.fulfill({ json: horarios }))
  const horariosSelecionados = [{ data_reserva: dia, hora_inicio: '09:00:00', hora_fim: '11:00:00' }]
  const pedido = { ...consultaAgenda(92), id_espaco: 77, finalidade: 'Pesquisa de campo',
    espaco: { ...consultaAgenda().espaco, id: 77, nome: espacoApi.nome },
    horarios: horariosSelecionados.map(h => ({ id: 92, ...h })) }

  let criados = 0
  await page.route('**/solicitacoes/', async route => {
    if (route.request().method() === 'POST') {
      expect(route.request().postDataJSON()).toEqual({ finalidade: pedido.finalidade, id_espaco: 77, horarios: horariosSelecionados })
      criados++
      return route.fulfill({ status: 201, json: pedido })
    }
    return route.fulfill({ json: [pedido, { ...pedido, id: 93, id_solicitante: 5, finalidade: 'Outro solicitante' }] })
  })
  await page.goto('/')
  await page.getByRole('link', { name: 'Ver laboratório' }).click()
  await page.getByRole('link', { name: 'Consultar horários disponíveis' }).click()
  await page.getByRole('button', { name: /18 de fevereiro de 2027:.*dispon/  }).click()
  await page.getByRole('button', { name: /09:00–10:00/ }).click()
  await page.getByRole('button', { name: /10:00–11:00/ }).click()
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375)
  await page.getByRole('button', { name: 'Continuar para os detalhes' }).click()
  await page.getByLabel('Finalidade da solicitação').fill(pedido.finalidade)
  await page.getByRole('button', { name: 'Revisar solicitação' }).click()
  await page.getByRole('button', { name: 'Enviar solicitação', exact: true }).click()
  await expect(page.getByText('Solicitação enviada e aguardando análise.')).toBeVisible()
  await page.getByRole('link', { name: 'Consultar minhas solicitações' }).click()
  await expect(page).toHaveURL(/\/meus-agendamentos$/)
  await expect(page.getByText(pedido.finalidade)).toBeVisible()
  await expect(page.getByText('Outro solicitante')).toHaveCount(0)
  expect(criados).toBe(1)
  pedido.status = 'Aprovado'
  await page.getByRole('button', { name: 'Atualizar' }).click()
  await expect(page.getByRole('article')).toContainText('Aprovado')
})
