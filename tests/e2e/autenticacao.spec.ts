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
  await page.route('**/espacos/**', async route => {
    const request = route.request()
    const url = new URL(request.url())
    chamadas.push({ caminho: url.pathname + url.search, corpo: null, authorization: request.headers().authorization })
    if (!autenticado || !request.headers().authorization?.startsWith('Bearer ')) {
      return route.fulfill({ status: 401, json: { detail: 'Sessão expirada' } })
    }
    return route.fulfill({ status: 200, json: Number(url.searchParams.get('skip')) === 0 ? [espacoApi] : [] })
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
  await simularApi(page)
  await page.goto('/laboratorios/77?origem=catalogo')
  await entrar(page)
  await expect(page).toHaveURL(/\/laboratorios\/77\?origem=catalogo$/)
  await expect(page.getByRole('heading', { name: 'Laboratório API 77' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Detalhes do laboratório' })).toBeVisible()
  await expect(page.getByText('COLAB', { exact: true })).toHaveCount(0)
  await page.getByRole('link', { name: 'Consultar situação do agendamento' }).click()
  await expect(page.getByRole('heading', { name: 'Agendamento ainda não integrado' })).toBeVisible()
})

for (const caminho of ['/laboratorios/77/agendamento', '/laboratorios/77/agendamento/detalhes']) {
  test(`rota bloqueada não expõe horários ou formulário fictícios: ${caminho}`, async ({ page }) => {
    await simularApi(page, { autenticado: true })
    await page.goto(caminho)
    await expect(page.getByRole('heading', { name: 'Agendamento ainda não integrado' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Revisar solicitação' })).toHaveCount(0)
    await expect(page.getByText(/09:00/)).toHaveCount(0)
  })
}

test('catálogo recupera 401 com refresh e repete somente a página que falhou', async ({ page }) => {
  const chamadas = await simularApi(page, { autenticado: true })
  let consultas = 0
  await page.route('**/espacos/**', async route => {
    consultas++
    if (consultas === 1) return route.fulfill({ status: 401, json: { detail: 'Access token expirado' } })
    return route.fulfill({ status: 200, json: [espacoApi] })
  })
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Laboratório API 77' })).toBeVisible()
  expect(consultas).toBe(2)
  // Recuperação inicial por cookie e renovação provocada pelo 401 do catálogo.
  expect(chamadas.filter(c => c.caminho === '/usuarios/refresh')).toHaveLength(2)
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
