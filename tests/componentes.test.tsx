import assert from 'node:assert/strict'
import { test, afterEach, beforeEach } from 'node:test'
import { render, screen, cleanup, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Router, Link, useLocation } from 'react-router-dom'
import App from '../src/App'
import { useEnvioSolicitacao } from '../src/hooks/useEnvioSolicitacao'
import { consultarHorarios, validarDisponibilidade } from '../src/services/disponibilidade'
import { dataLocal, datasPeriodo, intervaloValido, lerData, periodoMes, selecaoRealValida } from '../src/data/disponibilidade'

const usuario = { id: 1, nome_completo: 'Ana Teste', cpf: '12345678901', vinculo_institucional: 'MAT123', email: 'ana@example.com', perfil: 'Membro', ativo: true }
const jwt = () => `a.${Buffer.from(JSON.stringify({ exp: Date.now() / 1000 + 900 })).toString('base64url')}.c`
const espacosTeste = [{ id: 77, nome: 'Laboratório API 77', descricao: null, capacidade: 20, bloco: 'Bloco X', disponibilidade: true,
  recursos: [{ id: 501, nome: 'Impressora 3D', tipo: 'Equipamento', autorizacao_necessaria: true, disponibilidade: false, reserva_independente: true, id_espaco: 77 }],
  horarios_funcionamento: [], pausas_funcionamento: [], usuarios_vinculados: [] }]
let criacaoResposta: unknown = null
let criacaoStatus = 201
let horariosResposta: unknown = []
let espacosResposta: unknown = espacosTeste
let usuarioResposta = usuario
let autenticado = false
let chamadas: { url: string; body: unknown }[] = []

beforeEach(() => {
  sessionStorage.clear()
  autenticado = false
  usuarioResposta = usuario
  espacosResposta = espacosTeste
  horariosResposta = []
  criacaoResposta = null
  criacaoStatus = 201
  chamadas = []
  globalThis.fetch = async (input, options) => {
    const url = String(input)
    chamadas.push({ url, body: options?.body ? JSON.parse(String(options.body)) : null })
    if (url.endsWith('/login')) autenticado = true
    if (url.endsWith('/logout')) { autenticado = false; return new Response(null, { status: 204 }) }
    if (url.endsWith('/usuarios/')) return Response.json(usuario, { status: 201 })
    if (!autenticado) return Response.json({ detail: 'Sessão expirada' }, { status: 401 })
    if (new URL(url).pathname === '/solicitacoes/') {
      assert.equal(options?.method, 'POST')
      assert.match(new Headers(options?.headers).get('Authorization') ?? '', /^Bearer /)
      return Response.json(criacaoResposta ?? { ...JSON.parse(String(options?.body)), id: 901, status: 'Pendente', id_solicitante: usuarioResposta.id }, { status: criacaoStatus })
    }
    if (new URL(url).pathname === '/agendamentos/horarios-disponiveis') {
      assert.match(new Headers(options?.headers).get('Authorization') ?? '', /^Bearer /)
      assert.equal(options?.method, 'GET')
      assert.equal(options?.body, undefined)
      return Response.json(horariosResposta)
    }
    if (new URL(url).pathname === '/espacos/') {
      assert.match(new Headers(options?.headers).get('Authorization') ?? '', /^Bearer /)
      return Response.json(espacosResposta)
    }
    if (url.endsWith('/me')) return Response.json(usuarioResposta)
    if (url.endsWith('/login') || url.endsWith('/refresh')) return Response.json({ access_token: jwt(), token_type: 'bearer', usuario: usuarioResposta })
    throw Error('Requisição inesperada no teste: ' + url)
  }
})
afterEach(cleanup)
const abrir = (caminho: string) => render(<MemoryRouter initialEntries={[caminho]}><App /></MemoryRouter>)

for (const caminho of ['/', '/laboratorios/1', '/laboratorios/1/agendamento', '/laboratorios/1/agendamento/detalhes', '/meus-agendamentos', '/admin']) {
  test(`protege rota ${caminho} sem sessão`, async () => {
    abrir(caminho)
    await screen.findByText('Faça login para acessar o sistema.')
    assert.ok(screen.getByRole('button', { name: 'Entrar' }))
    assert.equal(screen.queryByRole('button', { name: 'Sair' }), null)
  })
}

test('login preserva destino da agenda, filtros e logout', async () => {
  const user = userEvent.setup()
  abrir('/meus-agendamentos')
  await screen.findByText('Faça login para acessar o sistema.')
  await user.type(screen.getByLabelText('E-mail ou CPF'), 'ana@example.com')
  await user.type(screen.getByLabelText('Senha', { exact: true }), 'SenhaValida123!')
  await user.click(screen.getByRole('button', { name: 'Entrar' }))
  await screen.findByRole('heading', { name: 'Agendamentos' })
  const filtro = screen.getByRole('button', { name: 'Pendente' })
  await user.click(filtro)
  assert.equal(filtro.getAttribute('aria-pressed'), 'true')
  await user.click(screen.getByRole('link', { name: 'Laboratórios' }))
  await screen.findByRole('heading', { name: 'Encontre o laboratório ideal' })
  await user.click(screen.getByRole('button', { name: 'Sair' }))
  await screen.findByText('Sessão encerrada.')
  assert.equal(sessionStorage.getItem('labagenda.access_token'), null)
  assert.equal(chamadas.filter(c => c.url.endsWith('/logout')).length, 1)
})

test('cadastro normaliza CPF, não envia perfil e valida confirmação', async () => {
  const user = userEvent.setup()
  abrir('/cadastro')
  await user.type(screen.getByLabelText('Nome completo'), 'Ana Teste')
  await user.type(screen.getByLabelText('CPF', { exact: true }), '123.456.789-01')
  await user.type(screen.getByLabelText('Vínculo institucional (matrícula ou registro)'), 'MAT123')
  await user.type(screen.getByLabelText('E-mail', { exact: true }), 'ana@example.com')
  await user.type(screen.getByLabelText('Senha (mínimo 8 caracteres)', { exact: true }), 'SenhaValida123!')
  await user.type(screen.getByLabelText('Confirmar senha'), 'outra')
  await user.click(screen.getByRole('button', { name: 'Criar conta' }))
  assert.equal(screen.getByRole('alert').textContent, 'As senhas não coincidem.')
  assert.equal(chamadas.length, 0)
  await user.clear(screen.getByLabelText('Confirmar senha'))
  await user.type(screen.getByLabelText('Confirmar senha'), 'SenhaValida123!')
  await user.click(screen.getByRole('button', { name: 'Criar conta' }))
  await screen.findByText('Cadastro concluído. Entre com suas credenciais.')
  assert.deepEqual(chamadas[0].body, { nome_completo: 'Ana Teste', cpf: '12345678901', vinculo_institucional: 'MAT123', email: 'ana@example.com', senha: 'SenhaValida123!' })
})

test('indisponibilidade oculta agenda e permite tentar novamente', async () => {
  const fetchValido = globalThis.fetch
  globalThis.fetch = async () => { throw Error('offline') }
  abrir('/meus-agendamentos')
  await screen.findByRole('heading', { name: 'Não foi possível verificar sua sessão' })
  assert.equal(screen.queryByRole('heading', { name: 'Agendamentos' }), null)
  autenticado = true
  globalThis.fetch = fetchValido
  await userEvent.setup().click(screen.getByRole('button', { name: 'Tentar novamente' }))
  await screen.findByRole('heading', { name: 'Agendamentos' })
})

test('recuperação de senha apresenta limitação real', async () => {
  abrir('/recuperar-senha')
  assert.match(screen.getByRole('status').textContent ?? '', /ainda não está disponível/)
})

test('logout offline exibe aviso e nova tentativa', async () => {
  autenticado = true
  const fetchValido = globalThis.fetch
  globalThis.fetch = async (input, options) => {
    if (String(input).endsWith('/logout')) throw Error('offline')
    return fetchValido(input, options)
  }
  abrir('/')
  await screen.findByRole('heading', { name: 'Encontre o laboratório ideal' })
  await userEvent.setup().click(screen.getByRole('button', { name: 'Sair' }))
  await screen.findByText(/Não foi possível confirmar o logout/)
  globalThis.fetch = fetchValido
  await userEvent.setup().click(screen.getByRole('button', { name: 'Tentar encerrar sessão novamente' }))
  await waitFor(() => assert.ok(screen.getByText('Sessão encerrada.')))
})

test('catálogo autenticado usa API, busca recursos e identifica indisponíveis', async () => {
  autenticado = true
  const user = userEvent.setup()
  abrir('/')
  await screen.findByRole('heading', { name: 'Laboratório API 77' })
  await user.type(screen.getByRole('searchbox', { name: 'Buscar laboratório ou recurso' }), 'IMPRESSORA 3D')
  assert.ok(screen.getByRole('heading', { name: 'Laboratório API 77' }))
  assert.match(screen.getByText(/Impressora 3D — Indisponível/).textContent ?? '', /Requer autorização/)
  await user.selectOptions(screen.getByLabelText('Filtrar por bloco'), 'Bloco X')
  assert.ok(screen.getByRole('link', { name: 'Ver laboratório' }))
  assert.equal(screen.queryByText('COLAB'), null)
})

test('detalhe navega para calendário real sem horários fictícios', async () => {
  autenticado = true
  const user = userEvent.setup()
  abrir('/')
  await user.click(await screen.findByRole('link', { name: 'Ver laboratório' }))
  await screen.findByRole('heading', { name: 'Laboratório API 77' })
  assert.equal(screen.getByRole('heading', { name: 'Laboratório API 77' }).tagName, 'H1')
  await user.click(screen.getByRole('link', { name: 'Consultar horários disponíveis' }))
  await screen.findByRole('heading', { name: 'Escolha a data e o horário' })
  assert.equal(screen.queryByText(/09:00/), null)
  assert.equal(screen.queryByRole('button', { name: 'Revisar solicitação' }), null)
})

for (const caminho of ['/laboratorios/77/agendamento', '/laboratorios/77/agendamento/detalhes']) {
  test(`acesso direto mantém envio bloqueado em ${caminho}`, async () => {
    autenticado = true
    abrir(caminho)
    await screen.findByRole('heading', { name: caminho.endsWith('/detalhes') ? 'Prévia da solicitação' : 'Escolha a data e o horário' })
    assert.equal(screen.queryByRole('textbox', { name: /Finalidade/ }), null)
    assert.equal(screen.queryByText(/09:00/), null)
  })
}

test('catálogo vazio não retorna às fixtures', async () => {
  autenticado = true
  espacosResposta = []
  abrir('/')
  await screen.findByText('Nenhum espaço retornado pela API para sua conta.')
  assert.equal(screen.queryByRole('link', { name: 'Ver laboratório' }), null)
})

test('resposta inválida do catálogo mostra erro e permite nova tentativa', async () => {
  autenticado = true
  espacosResposta = { items: espacosTeste }
  abrir('/')
  await screen.findByText('A API retornou um catálogo com dados inválidos.')
  espacosResposta = espacosTeste
  horariosResposta = []
  await userEvent.setup().click(screen.getByRole('button', { name: 'Tentar novamente' }))
  await screen.findByRole('heading', { name: 'Laboratório API 77' })
})


test('painel bloqueia Membro mesmo com Administrador adulterado no armazenamento local', async () => {
  autenticado = true
  sessionStorage.setItem('labagenda.access_token', jwt())
  sessionStorage.setItem('labagenda.usuario', JSON.stringify({ ...usuario, perfil: 'Administrador' }))
  abrir('/admin')
  await screen.findByRole('heading', { name: 'Acesso restrito' })
  assert.equal(screen.queryByRole('heading', { name: 'Painel do gestor' }), null)
  assert.ok(chamadas.some(c => c.url.endsWith('/me')))
  assert.equal(chamadas.some(c => /\/(solicitacoes|agendamentos|espacos)/.test(new URL(c.url).pathname)), false)
})

test('Administrador abre painel visual, alterna abas e mantém logout real sem API administrativa', async () => {
  autenticado = true
  usuarioResposta = { ...usuario, perfil: 'Administrador' }
  abrir('/admin')
  await screen.findByRole('heading', { name: 'Painel do gestor' })
  assert.ok(screen.getByText(/Nenhuma.*registrada/))
  const user = userEvent.setup()
  await user.click(screen.getByRole('tab', { name: /^Agenda$/ }))
  assert.ok(screen.getByRole('heading', { name: 'Agenda mestre' }))
  assert.equal(chamadas.some(c => /\/(solicitacoes|agendamentos|espacos)/.test(new URL(c.url).pathname)), false)
  await user.click(screen.getByRole('button', { name: 'Sair' }))
  await screen.findByText('Sessão encerrada.')
  assert.equal(chamadas.filter(c => c.url.endsWith('/logout')).length, 1)
  assert.equal(sessionStorage.getItem('labagenda.access_token'), null)
})


test('detalhes exibem dados e horários reais sem transformar funcionamento em disponibilidade', async () => {
  autenticado = true
  espacosResposta = [{ ...espacosTeste[0], descricao: 'Descrição oficial da API', capacidade: 0, disponibilidade: false,
    horarios_funcionamento: [
      { id: 2, dia_semana: 6, hora_abertura: '09:15:30', hora_fechamento: '12:30:00', ativo: false, id_espaco: 77 },
      { id: 1, dia_semana: 0, hora_abertura: '08:00:00', hora_fechamento: '11:00:00', ativo: true, id_espaco: 77 },
    ] }]
  abrir('/laboratorios/77')
  await screen.findByRole('heading', { name: 'Laboratório API 77' })
  assert.ok(screen.getByText('Descrição oficial da API'))
  assert.ok(screen.getByText('Bloco X'))
  assert.ok(screen.getByText('0 pessoas'))
  assert.ok(screen.getByText('Espaço indisponível'))
  assert.ok(screen.getByText('Impressora 3D'))
  assert.ok(screen.getByText(/Indisponível · Requer autorização/))
  const horarios = screen.getByRole('region', { name: 'Horário de funcionamento' })
  assert.deepEqual(Array.from(horarios.querySelectorAll('dt'), item => item.textContent), ['Domingo', 'Sábado'])
  assert.ok(screen.getByText('08:00:00 — 11:00:00'))
  assert.ok(screen.getByText('Inativo'))
  assert.equal(screen.queryByText('Segunda'), null)
  assert.equal(screen.queryByRole('button', { name: /Solicitar|Reservar/ }), null)
  assert.ok(chamadas.every(c => c.body === null))
})

test('detalhes tratam campos nulos, textos vazios e listas ausentes sem dados demonstrativos', async () => {
  autenticado = true
  espacosResposta = [{ id: 77, nome: 'Espaço mínimo', descricao: '  ', bloco: null, capacidade: null, disponibilidade: true }]
  abrir('/laboratorios/77')
  await screen.findByRole('heading', { name: 'Espaço mínimo' })
  for (const texto of ['Descrição não informada.', 'Localização não informada.', 'Capacidade não informada.', 'Nenhum recurso informado.', 'Horários de funcionamento não informados.']) {
    assert.ok(screen.getByText(texto))
  }
  assert.equal(screen.queryByText(/08:00|18:00|COLAB/), null)
  assert.equal(screen.queryByRole('button', { name: /Solicitar|Reservar/ }), null)
})

test('detalhes não resolvem um ID ausente usando fixtures', async () => {
  autenticado = true
  abrir('/laboratorios/1')
  await screen.findByText('Laboratório não encontrado no catálogo acessível à sua conta.')
  assert.equal(screen.queryByRole('heading', { name: 'Sobre o laboratório' }), null)
  assert.ok(screen.getByRole('link', { name: 'Voltar ao catálogo' }))
})

test('detalhes preservam carregamento e recuperação de erro na consulta', async () => {
  autenticado = true
  const fetchValido = globalThis.fetch
  let liberar: (() => void) | undefined
  const espera = new Promise<void>(resolve => { liberar = resolve })
  globalThis.fetch = async (input, options) => {
    if (new URL(String(input)).pathname === '/espacos/') {
      await espera
      return Response.json({ detail: 'Falha temporária do catálogo' }, { status: 503 })
    }
    return fetchValido(input, options)
  }
  abrir('/laboratorios/77')
  try {
    await screen.findByText('Carregando laboratório...')
  } finally {
    liberar?.()
  }
  await screen.findByRole('alert')
  assert.ok(screen.getByText('Falha temporária do catálogo'))
  globalThis.fetch = fetchValido
  await userEvent.setup().click(screen.getByRole('button', { name: 'Tentar novamente' }))
  await screen.findByRole('heading', { name: 'Laboratório API 77' })
  assert.ok(screen.getByText('Horários de funcionamento não informados.'))
})


const diaApi = '2090-01-07' // Sábado: disponibilidade é decidida pela API.
const slotApi = (data = diaApi, inicio = '08:00:00', fim = '09:00:00') => ({ data_hora_inicio: `${data}T${inicio}`, data_hora_fim: `${data}T${fim}` })
const consultaApi = () => chamadas.filter(c => c.url.includes('/horarios-disponiveis'))
const botaoDia = () => screen.getByRole('button', { name: /7 de janeiro de 2090: horários disponíveis/ })

test('serviço consulta ID real, preserva segundos locais e rejeita períodos maiores que 31 datas', async () => {
  autenticado = true
  sessionStorage.setItem('labagenda.access_token', jwt())
  horariosResposta = [slotApi(diaApi, '08:15:30.123456', '09:15:30.123456')]
  const slots = await consultarHorarios(77, '2090-01-01', '2090-01-31')
  assert.deepEqual(slots, [{ data: diaApi, inicio: '08:15:30.123456', fim: '09:15:30.123456' }])
  const query = new URL(consultaApi()[0].url).searchParams
  assert.equal(query.get('id_espaco'), '77')
  assert.equal(query.get('data_inicio'), '2090-01-01')
  assert.equal(query.get('data_fim'), '2090-01-31')
  await assert.rejects(consultarHorarios(77, '2090-01-01', '2090-02-01'), /31 datas/)
  assert.equal(consultaApi().length, 1)
})

test('validação rejeita resposta vazia, fuso, data inválida, duplicatas e intervalos incompatíveis', () => {
  for (const valor of [undefined, {}, [slotApi('2090-02-30')], [slotApi('2090-02-01')],
    [{ data_hora_inicio: `${diaApi}T08:00:00Z`, data_hora_fim: `${diaApi}T09:00:00Z` }],
    [slotApi(), slotApi()],
    [slotApi(diaApi, '09:00:00', '08:00:00')], [slotApi(diaApi, '08:00:00', '10:00:00')],
  ]) assert.throws(() => validarDisponibilidade(valor, '2090-01-01', '2090-01-31'), /inválidos/)
  assert.deepEqual(validarDisponibilidade([], '2090-01-01', '2090-01-31'), [])
})

test('seleção exige limites da API e continuidade; datas civis não sofrem conversão UTC', () => {
  const slots = validarDisponibilidade([slotApi(), slotApi(diaApi, '09:00:00', '10:00:00'), slotApi(diaApi, '11:00:00', '12:00:00')], diaApi, diaApi)
  assert.ok(intervaloValido(slots, diaApi, '08:00', '10:00'))
  assert.ok(intervaloValido(slots, diaApi, '08:00', '09:00'))
  for (const [a, b] of [['08:00', '12:00'], ['08:30', '09:00'], ['09:00', '08:00'], ['08:00', '08:30']]) assert.equal(intervaloValido(slots, diaApi, a, b), false)
  assert.equal(selecaoRealValida(slots, new URLSearchParams(`data=${diaApi}&data=${diaApi}&inicio=08:00&fim=09:00`)), false)
  assert.equal(dataLocal(lerData(diaApi)!), diaApi)
  assert.equal(lerData('2090-02-30'), null)
  assert.equal(datasPeriodo('2090-01-01', '2090-01-31').length, 31)
  assert.deepEqual(periodoMes(new Date(2090, 0, 1), '2090-01-15'), { inicio: '2090-01-15', fim: '2090-01-31' })
  assert.equal(periodoMes(new Date(2090, 0, 1), '2090-02-01').inicio, null)
})

test('calendário permite sábado real, seleciona intervalo contínuo e revalida a prévia sem enviar', async () => {
  autenticado = true
  horariosResposta = [slotApi(), slotApi(diaApi, '09:00:00', '10:00:00'), slotApi(diaApi, '11:00:00', '12:00:00')]
  const user = userEvent.setup()
  abrir('/laboratorios/77/agendamento?mes=2090-01')
  await waitFor(() => assert.equal(botaoDia().hasAttribute('disabled'), false))
  assert.match(botaoDia().getAttribute('aria-label')!, /sábado/)
  assert.ok(screen.getByRole('button', { name: /, 8 de janeiro de 2090: sem horários disponíveis/ }).hasAttribute('disabled'))
  await user.click(botaoDia())
  const inicio = screen.getByRole('button', { name: /08:00–09:00/ })
  inicio.focus()
  await user.keyboard('{Enter}')
  assert.equal(inicio.getAttribute('aria-pressed'), 'true')
  assert.ok(screen.getByRole('button', { name: /11:00–12:00/ }).hasAttribute('disabled'))
  await user.click(screen.getByRole('button', { name: /09:00–10:00/ }))
  assert.equal(screen.getByRole('button', { name: /09:00–10:00/ }).getAttribute('aria-pressed'), 'true')
  await user.click(screen.getByRole('button', { name: 'Continuar para os detalhes' }))
  await screen.findByRole('heading', { name: 'Resumo da seleção' })
  assert.ok(screen.getByText(diaApi))
  assert.ok(screen.getByText('08:00'))
  assert.ok(screen.getByText('10:00'))
  assert.ok(screen.getByRole('button', { name: 'Enviar solicitação' }).hasAttribute('disabled'))
  assert.equal(consultaApi().length, 2)
  assert.equal(new URL(consultaApi()[1].url).searchParams.get('data_inicio'), diaApi)
  assert.ok(chamadas.every(c => c.body === null))
})

test('seleção de uma hora e limpeza por teclado devolvem foco ao primeiro intervalo', async () => {
  autenticado = true
  horariosResposta = [slotApi()]
  const user = userEvent.setup()
  abrir(`/laboratorios/77/agendamento?mes=2090-01&data=${diaApi}`)
  await screen.findByRole('button', { name: /08:00–09:00/ })
  await user.click(screen.getByRole('button', { name: /08:00–09:00/ }))
  await user.click(screen.getByRole('button', { name: /08:00–09:00/ }))
  assert.equal(screen.getByRole('button', { name: 'Continuar para os detalhes' }).hasAttribute('disabled'), false)
  await user.click(screen.getByRole('button', { name: 'Limpar seleção' }))
  assert.equal(document.activeElement, screen.getByRole('button', { name: /08:00–09:00/ }))
  assert.ok(screen.getByRole('button', { name: 'Continuar para os detalhes' }).hasAttribute('disabled'))
})

test('falha da disponibilidade permite nova tentativa e mês vazio não inventa horários', async () => {
  autenticado = true
  const fetchValido = globalThis.fetch
  let falhar = true
  globalThis.fetch = async (input, options) => String(input).includes('/horarios-disponiveis') && falhar
    ? Response.json({ detail: 'Agenda temporariamente indisponível' }, { status: 503 }) : fetchValido(input, options)
  abrir('/laboratorios/77/agendamento?mes=2090-01')
  await screen.findByText('Agenda temporariamente indisponível')
  assert.ok(screen.getByRole('button', { name: 'Continuar para os detalhes' }).hasAttribute('disabled'))
  falhar = false
  await userEvent.setup().click(screen.getByRole('button', { name: 'Tentar novamente' }))
  await screen.findByText('Nenhum horário disponível neste período.')
  assert.equal(screen.queryByRole('button', { name: /08:00–09:00/ }), null)
})

test('mudança de mês cancela consulta e ignora resposta antiga mesmo se transporte não abortar', async () => {
  autenticado = true
  const fetchValido = globalThis.fetch
  let concluir: ((r: Response) => void) | undefined
  let signal: AbortSignal | undefined
  globalThis.fetch = async (input, options) => {
    const url = new URL(String(input))
    if (url.pathname.includes('/horarios-disponiveis') && url.searchParams.get('data_inicio') === '2090-01-01') {
      signal = options?.signal ?? undefined
      return new Promise<Response>(resolve => { concluir = resolve })
    }
    return fetchValido(input, options)
  }
  abrir('/laboratorios/77/agendamento?mes=2090-01')
  await waitFor(() => assert.ok(concluir))
  assert.ok(screen.getByText('Carregando disponibilidade...'))
  await userEvent.setup().click(screen.getByRole('button', { name: 'Próximo mês' }))
  await screen.findByRole('heading', { name: 'fevereiro de 2090' })
  await screen.findByText('Nenhum horário disponível neste período.')
  assert.equal(signal?.aborted, true)
  concluir!(Response.json([slotApi()]))
  await waitFor(() => assert.equal(screen.queryByText('Carregando disponibilidade...'), null))
  assert.equal(screen.queryByRole('button', { name: /7 de janeiro de 2090: horários disponíveis/ }), null)
  assert.ok(consultaApi().some(c => new URL(c.url).searchParams.get('data_fim') === '2090-02-28'))
})

for (const query of [
  `data=${diaApi}&inicio=08:00&fim=12:00`, `data=${diaApi}&inicio=08:30&fim=09:00`,
  `data=${diaApi}&data=${diaApi}&inicio=08:00&fim=09:00`, 'data=2090-02-30&inicio=08:00&fim=09:00',
  'data=2000-01-01&inicio=08:00&fim=09:00', `data=${diaApi}&inicio=08:00Z&fim=09:00`,
]) {
  test(`prévia recusa parâmetros não confirmados pela API: ${query}`, async () => {
    autenticado = true
    horariosResposta = [slotApi(), slotApi(diaApi, '11:00:00', '12:00:00')]
    abrir(`/laboratorios/77/agendamento/detalhes?${query}`)
    await screen.findByRole('heading', { name: 'Seleção ausente ou inválida' })
    assert.equal(screen.queryByRole('heading', { name: 'Resumo da seleção' }), null)
    assert.ok(chamadas.every(c => c.body === null))
  })
}

test('prévia reconsulta e rejeita horário que deixou de estar disponível após seleção', async () => {
  autenticado = true
  horariosResposta = [slotApi()]
  const user = userEvent.setup()
  abrir(`/laboratorios/77/agendamento?mes=2090-01&data=${diaApi}&inicio=08:00&fim=09:00`)
  await waitFor(() => assert.equal(screen.getByRole('button', { name: 'Continuar para os detalhes' }).hasAttribute('disabled'), false))
  horariosResposta = []
  await user.click(screen.getByRole('button', { name: 'Continuar para os detalhes' }))
  await screen.findByRole('heading', { name: 'Seleção ausente ou inválida' })
  assert.equal(screen.queryByRole('heading', { name: 'Resumo da seleção' }), null)
})

test('troca de laboratório aborta consulta antiga e não reutiliza disponibilidade de outro ID', async () => {
  autenticado = true
  espacosResposta = [espacosTeste[0], { ...espacosTeste[0], id: 88, nome: 'Laboratório API 88', recursos: [] }]
  const fetchValido = globalThis.fetch
  let concluir: ((r: Response) => void) | undefined
  let signal: AbortSignal | undefined
  globalThis.fetch = async (input, options) => {
    const url = new URL(String(input))
    if (url.pathname.includes('/horarios-disponiveis') && url.searchParams.get('id_espaco') === '77') {
      signal = options?.signal ?? undefined
      return new Promise<Response>(resolve => { concluir = resolve })
    }
    return fetchValido(input, options)
  }
  render(<MemoryRouter initialEntries={['/laboratorios/77/agendamento?mes=2090-01']}><Link to="/laboratorios/88/agendamento?mes=2090-01">Trocar laboratório</Link><App /></MemoryRouter>)
  await waitFor(() => assert.ok(concluir))
  await userEvent.setup().click(screen.getByRole('link', { name: 'Trocar laboratório' }))
  await screen.findByText('Disponibilidade de Laboratório API 88.')
  assert.equal(signal?.aborted, true)
  concluir!(Response.json([slotApi()]))
  await screen.findByText('Nenhum horário disponível neste período.')
  assert.equal(screen.queryByRole('button', { name: /7 de janeiro de 2090: horários disponíveis/ }), null)
})

test('mês passado, espaço ausente e espaço desativado não disparam consulta de horários', async () => {
  autenticado = true
  const tela = abrir('/laboratorios/77/agendamento?mes=2000-01')
  await screen.findByText('Nenhum horário disponível neste período.')
  assert.equal(consultaApi().length, 0)
  tela.unmount()
  espacosResposta = []
  const ausente = abrir('/laboratorios/1/agendamento?mes=2090-01')
  await screen.findByText('Laboratório não encontrado no catálogo acessível à sua conta.')
  assert.equal(consultaApi().length, 0)
  ausente.unmount()
  espacosResposta = [{ ...espacosTeste[0], disponibilidade: false }]
  abrir('/laboratorios/77/agendamento?mes=2090-01')
  await screen.findByText('Laboratório indisponível para agendamento.')
  assert.equal(consultaApi().length, 0)
})


test('intervalos sobrepostos retornados pela API preservam cadeias exatas sem inventar limites', () => {
  const slots = validarDisponibilidade([slotApi(), slotApi(diaApi, '08:30:00', '09:30:00'), slotApi(diaApi, '09:00:00', '10:00:00')], diaApi, diaApi)
  assert.ok(intervaloValido(slots, diaApi, '08:00', '10:00'))
  assert.ok(intervaloValido(slots, diaApi, '08:30', '09:30'))
  assert.equal(intervaloValido(slots, diaApi, '08:00', '09:30'), false)
})

test('serviço renova sessão uma vez após 401 e limita repetição persistente', async () => {
  autenticado = true
  sessionStorage.setItem('labagenda.access_token', jwt())
  const fetchValido = globalThis.fetch
  let consultas = 0, refresh = 0, persistente = false
  globalThis.fetch = async (input, options) => {
    const url = String(input)
    if (url.endsWith('/refresh')) refresh++
    if (url.includes('/horarios-disponiveis') && (++consultas === 1 || persistente)) return Response.json({ detail: 'Sessão inválida' }, { status: 401 })
    return fetchValido(input, options)
  }
  await consultarHorarios(77, diaApi, diaApi)
  assert.equal(consultas, 2)
  assert.equal(refresh, 1)
  consultas = 0
  refresh = 0
  persistente = true
  await assert.rejects(consultarHorarios(77, diaApi, diaApi), (erro: unknown) => erro instanceof Error && 'status' in erro && erro.status === 401)
  assert.equal(consultas, 2)
  assert.equal(refresh, 1)
  assert.equal(sessionStorage.getItem('labagenda.access_token'), null)
})

test('serviço descarta resposta após troca de sessão e respeita cancelamento antecipado', async () => {
  autenticado = true
  sessionStorage.setItem('labagenda.access_token', jwt())
  const controle = new AbortController()
  controle.abort()
  await assert.rejects(consultarHorarios(77, diaApi, diaApi, controle.signal), (erro: unknown) => erro instanceof Error && erro.name === 'AbortError')
  assert.equal(consultaApi().length, 0)
  const fetchValido = globalThis.fetch
  globalThis.fetch = async (input, options) => {
    if (String(input).includes('/horarios-disponiveis')) sessionStorage.setItem('labagenda.access_token', 'outra-sessao')
    return fetchValido(input, options)
  }
  await assert.rejects(consultarHorarios(77, diaApi, diaApi), /sessão mudou/)
  assert.equal(sessionStorage.getItem('labagenda.access_token'), 'outra-sessao')
})

test('cancelar durante refresh interrompe consumidor sem cancelar a renovação compartilhada', async () => {
  autenticado = true
  const fetchValido = globalThis.fetch
  let concluir: (() => void) | undefined
  let iniciou: (() => void) | undefined
  const inicioRefresh = new Promise<void>(resolve => { iniciou = resolve })
  const espera = new Promise<void>(resolve => { concluir = resolve })
  globalThis.fetch = async (input, options) => {
    if (String(input).endsWith('/refresh')) { iniciou!(); await espera }
    return fetchValido(input, options)
  }
  const controle = new AbortController()
  const consulta = consultarHorarios(77, diaApi, diaApi, controle.signal)
  const rejeitada = assert.rejects(consulta, (erro: unknown) => erro instanceof Error && erro.name === 'AbortError')
  await inicioRefresh
  controle.abort()
  await rejeitada
  assert.equal(consultaApi().length, 0)
  concluir!()
  await waitFor(() => assert.ok(sessionStorage.getItem('labagenda.access_token')))
})

test('desmontar calendário cancela consulta em andamento', async () => {
  autenticado = true
  const fetchValido = globalThis.fetch
  let concluir: ((r: Response) => void) | undefined
  let signal: AbortSignal | undefined
  globalThis.fetch = async (input, options) => {
    if (String(input).includes('/horarios-disponiveis')) {
      signal = options?.signal ?? undefined
      return new Promise<Response>(resolve => { concluir = resolve })
    }
    return fetchValido(input, options)
  }
  const tela = abrir('/laboratorios/77/agendamento?mes=2090-01')
  await waitFor(() => assert.ok(concluir))
  tela.unmount()
  assert.equal(signal?.aborted, true)
  concluir!(Response.json([slotApi()]))
})


function EstadoRotaTeste() {
  const location = useLocation()
  return <output data-testid="rota-atual">{location.pathname + location.search}</output>
}

test('formulário valida finalidade de forma acessível e prepara prévia apenas com GET', async () => {
  autenticado = true
  horariosResposta = [slotApi()]
  const user = userEvent.setup()
  abrir(`/laboratorios/77/agendamento/detalhes?data=${diaApi}&inicio=08:00&fim=09:00`)
  const campo = await screen.findByRole('textbox', { name: 'Finalidade da solicitação' })
  await user.click(screen.getByRole('button', { name: 'Revisar solicitação' }))
  assert.ok(screen.getByText('Informe a finalidade da solicitação.'))
  assert.equal(campo.getAttribute('aria-invalid'), 'true')
  assert.equal(document.activeElement, campo)
  await user.type(campo, ' x ')
  await user.tab()
  assert.ok(screen.getByText('A finalidade deve ter pelo menos 3 caracteres.'))
  await user.clear(campo)
  await user.paste('x'.repeat(256))
  await user.tab()
  assert.ok(screen.getByText('A finalidade deve ter no máximo 255 caracteres.'))
  await user.clear(campo)
  await user.type(campo, '  Reunião acadêmica  ')
  await user.click(screen.getByRole('button', { name: 'Revisar solicitação' }))
  await screen.findByText('Prévia preparada localmente. Nenhuma solicitação foi enviada.')
  assert.ok(screen.getByRole('region', { name: 'Finalidade revisada' }).textContent?.includes('Reunião acadêmica'))
  assert.equal(consultaApi().length, 2)
  assert.equal(screen.getByRole('button', { name: 'Enviar solicitação' }).hasAttribute('disabled'), false)
  assert.equal(chamadas.filter(c => c.url.includes('/solicitacoes')).length, 0)
  assert.ok(chamadas.every(c => c.body === null))
})

test('rascunho sobrevive à ida e volta com edição de horário sem entrar em URL ou storage', async () => {
  autenticado = true
  horariosResposta = [slotApi(), slotApi(diaApi, '09:00:00', '10:00:00')]
  const user = userEvent.setup()
  render(<MemoryRouter initialEntries={[`/laboratorios/77/agendamento/detalhes?mes=2090-01&data=${diaApi}&inicio=08:00&fim=09:00`]}><EstadoRotaTeste /><App /></MemoryRouter>)
  await user.type(await screen.findByRole('textbox', { name: 'Finalidade da solicitação' }), 'Reunião do grupo de estudo')
  await user.click(screen.getByRole('link', { name: 'Voltar ao calendário' }))
  await screen.findByRole('button', { name: /09:00–10:00/ })
  await user.click(screen.getByRole('button', { name: /09:00–10:00/ }))
  await user.click(screen.getByRole('button', { name: /09:00–10:00/ }))
  await user.click(screen.getByRole('button', { name: 'Continuar para os detalhes' }))
  assert.equal((await screen.findByRole('textbox', { name: 'Finalidade da solicitação' }) as HTMLTextAreaElement).value, 'Reunião do grupo de estudo')
  assert.ok(screen.getByText('09:00'))
  assert.ok(screen.getByText('10:00'))
  assert.doesNotMatch(screen.getByTestId('rota-atual').textContent ?? '', /finalidade|Reunião|estudo/)
  for (let i = 0; i < sessionStorage.length; i++) {
    assert.doesNotMatch(sessionStorage.getItem(sessionStorage.key(i)!) ?? '', /Reunião do grupo/)
  }
  assert.equal(chamadas.filter(c => c.url.includes('/solicitacoes')).length, 0)
})

for (const rascunho of [
  { idEspaco: '88', idUsuario: 1, finalidade: 'Texto de outro laboratório' },
  { idEspaco: '77', idUsuario: 99, finalidade: 'Texto de outro usuário' },
]) {
  test(`rascunho é isolado por usuário e laboratório: ${rascunho.idEspaco}/${rascunho.idUsuario}`, async () => {
    autenticado = true
    horariosResposta = [slotApi()]
    render(<MemoryRouter initialEntries={[{ pathname: '/laboratorios/77/agendamento/detalhes', search: `?data=${diaApi}&inicio=08:00&fim=09:00`, state: { rascunhoSolicitacao: rascunho } }]}><App /></MemoryRouter>)
    assert.equal((await screen.findByRole('textbox', { name: 'Finalidade da solicitação' }) as HTMLTextAreaElement).value, '')
  })
}

test('trocar de laboratório não reaproveita finalidade do formulário anterior', async () => {
  autenticado = true
  espacosResposta = [espacosTeste[0], { ...espacosTeste[0], id: 88, nome: 'Laboratório API 88', recursos: [] }]
  horariosResposta = [slotApi()]
  const user = userEvent.setup()
  render(<MemoryRouter initialEntries={[`/laboratorios/77/agendamento/detalhes?data=${diaApi}&inicio=08:00&fim=09:00`]}><Link to={`/laboratorios/88/agendamento/detalhes?data=${diaApi}&inicio=08:00&fim=09:00`}>Mudar espaço</Link><App /></MemoryRouter>)
  await user.type(await screen.findByRole('textbox', { name: 'Finalidade da solicitação' }), 'Finalidade do espaço 77')
  await user.click(screen.getByRole('link', { name: 'Mudar espaço' }))
  await screen.findByText('Laboratório API 88')
  assert.equal((await screen.findByRole('textbox', { name: 'Finalidade da solicitação' }) as HTMLTextAreaElement).value, '')
})

test('revisão reconsulta disponibilidade e impede payload de seleção que ficou indisponível', async () => {
  autenticado = true
  horariosResposta = [slotApi()]
  const user = userEvent.setup()
  abrir(`/laboratorios/77/agendamento/detalhes?data=${diaApi}&inicio=08:00&fim=09:00`)
  await user.type(await screen.findByRole('textbox', { name: 'Finalidade da solicitação' }), 'Uso acadêmico')
  horariosResposta = []
  await user.click(screen.getByRole('button', { name: 'Revisar solicitação' }))
  await screen.findByRole('heading', { name: 'Seleção ausente ou inválida' })
  assert.equal(screen.queryByText('Prévia preparada localmente. Nenhuma solicitação foi enviada.'), null)
  assert.equal(chamadas.filter(c => c.url.includes('/solicitacoes')).length, 0)
})

test('calendário e formulário recusam início vencido no dia atual e revalidam tela aberta', async t => {
  const agora = new Date(2026, 10, 18, 10, 30, 0)
  t.mock.timers.enable({ apis: ['Date'], now: agora.getTime() })
  autenticado = true
  const hoje = dataLocal(agora)
  horariosResposta = [slotApi(hoje, '08:00:00', '09:00:00'), slotApi(hoje, '10:30:01', '11:30:01')]
  const calendario = abrir(`/laboratorios/77/agendamento?data=${hoje}&inicio=08:00&fim=09:00`)
  await screen.findByText('Seleção ausente ou inválida. Escolha um intervalo disponível.')
  assert.equal(screen.queryByRole('button', { name: /08:00–09:00/ }), null)
  assert.ok(screen.getByRole('button', { name: /10:30:01–11:30:01/ }))
  assert.ok(screen.getByRole('button', { name: 'Continuar para os detalhes' }).hasAttribute('disabled'))
  calendario.unmount()
  abrir(`/laboratorios/77/agendamento/detalhes?data=${hoje}&inicio=10:30:01&fim=11:30:01`)
  await screen.findByRole('textbox', { name: 'Finalidade da solicitação' })
  await act(async () => {
    t.mock.timers.tick(2000)
    window.dispatchEvent(new Event('focus'))
  })
  await screen.findByRole('heading', { name: 'Seleção ausente ou inválida' })
  assert.equal(screen.queryByRole('button', { name: 'Revisar solicitação' }), null)
})

test('resposta antiga de revisão não prepara payload após mudança de data', async () => {
  autenticado = true
  horariosResposta = [slotApi()]
  const user = userEvent.setup()
  const fetchValido = globalThis.fetch
  let revisando = false
  let concluir: ((r: Response) => void) | undefined
  let signal: AbortSignal | undefined
  globalThis.fetch = async (input, options) => {
    const url = new URL(String(input))
    if (revisando && url.pathname.includes('/horarios-disponiveis') && url.searchParams.get('data_inicio') === diaApi) {
      signal = options?.signal ?? undefined
      return new Promise<Response>(resolve => { concluir = resolve })
    }
    if (url.pathname.includes('/horarios-disponiveis') && url.searchParams.get('data_inicio') === '2090-01-08') return Response.json([])
    return fetchValido(input, options)
  }
  render(<MemoryRouter initialEntries={[`/laboratorios/77/agendamento/detalhes?data=${diaApi}&inicio=08:00&fim=09:00`]}><Link to="/laboratorios/77/agendamento/detalhes?data=2090-01-08&inicio=08:00&fim=09:00">Alterar data diretamente</Link><App /></MemoryRouter>)
  await user.type(await screen.findByRole('textbox', { name: 'Finalidade da solicitação' }), 'Uso acadêmico')
  revisando = true
  await user.click(screen.getByRole('button', { name: 'Revisar solicitação' }))
  await waitFor(() => assert.ok(concluir))
  await user.click(screen.getByRole('link', { name: 'Alterar data diretamente' }))
  await screen.findByRole('heading', { name: 'Seleção ausente ou inválida' })
  assert.equal(signal?.aborted, true)
  concluir!(Response.json([slotApi()]))
  await act(async () => { await Promise.resolve() })
  assert.equal(screen.queryByText('Prévia preparada localmente. Nenhuma solicitação foi enviada.'), null)
})


const postsCriacao = () => chamadas.filter(c => new URL(c.url).pathname === '/solicitacoes/')
async function prepararEnvio() {
  const user = userEvent.setup()
  abrir(`/laboratorios/77/agendamento/detalhes?data=${diaApi}&inicio=08:00&fim=09:00`)
  await user.type(await screen.findByRole('textbox', { name: 'Finalidade da solicitação' }), 'Reunião acadêmica')
  await user.click(screen.getByRole('button', { name: 'Revisar solicitação' }))
  await screen.findByText('Prévia preparada localmente. Nenhuma solicitação foi enviada.')
  return user
}

test('envio faz um único POST em duplo clique e exibe confirmação real com ID e status', async () => {
  autenticado = true
  horariosResposta = [slotApi()]
  const user = await prepararEnvio()
  await user.dblClick(screen.getByRole('button', { name: 'Enviar solicitação' }))
  await screen.findByRole('heading', { name: 'Solicitação registrada' })
  assert.ok(screen.getByText('Solicitação enviada e aguardando análise.'))
  assert.ok(screen.getByText('901'))
  assert.ok(screen.getByText('Pendente'))
  assert.ok(screen.getByText('Este envio não confirma reserva de horário. A solicitação segue o processo de análise.'))
  assert.equal(postsCriacao().length, 1)
  assert.deepEqual(postsCriacao()[0].body, { id_espaco: 77, finalidade: 'Reunião acadêmica', horarios: [{ data_reserva: diaApi, hora_inicio: '08:00:00', hora_fim: '09:00:00' }] })
  assert.equal(screen.queryByRole('button', { name: 'Enviar solicitação' }), null)
  await user.keyboard('{Enter}')
  assert.equal(postsCriacao().length, 1)
})

test('Enter e re-render não duplicam POST em andamento; finalidade fica preservada', async () => {
  autenticado = true
  horariosResposta = [slotApi()]
  const user = await prepararEnvio()
  const fetchValido = globalThis.fetch
  let concluir: ((r: Response) => void) | undefined
  let corpo: Record<string, unknown> = {}
  let posts = 0
  globalThis.fetch = async (input, options) => {
    if (String(input).includes('/solicitacoes/')) {
      posts++
      corpo = JSON.parse(String(options?.body))
      return new Promise<Response>(resolve => { concluir = resolve })
    }
    return fetchValido(input, options)
  }
  const enviar = screen.getByRole('button', { name: 'Enviar solicitação' })
  enviar.focus()
  await user.keyboard('{Enter}{Enter}')
  await waitFor(() => assert.ok(concluir))
  assert.ok(screen.getByText('Enviando solicitação...'))
  assert.ok(screen.getByRole('button', { name: 'Enviar solicitação' }).hasAttribute('disabled'))
  await act(async () => { window.dispatchEvent(new Event('focus')) })
  assert.equal(posts, 1)
  concluir!(Response.json({ ...corpo, id: 902, status: 'Pendente', id_solicitante: 1 }, { status: 201 }))
  await screen.findByText('902')
  assert.equal(posts, 1)
})

for (const [status, detail, mensagem] of [
  [401, 'Expirada', 'Sessão expirada ou inválida. Entre novamente antes de tentar enviar.'],
  [403, 'Proibido', 'Você não tem permissão para criar esta solicitação.'],
  [404, 'Ausente', 'Laboratório não encontrado. Volte ao catálogo.'],
  [422, 'Finalidade inválida na API', 'Finalidade inválida na API'],
  [422, [{ loc: ['body', 'finalidade'], msg: 'Finalidade precisa ser corrigida' }], 'Finalidade precisa ser corrigida'],
] as const) {
  test(`erro confirmado ${status} preserva formulário sem repetir criação: ${mensagem}`, async () => {
    autenticado = true
    horariosResposta = [slotApi()]
    criacaoStatus = status
    criacaoResposta = { detail }
    const user = await prepararEnvio()
    const refreshAntes = chamadas.filter(c => c.url.endsWith('/refresh')).length
    await user.click(screen.getByRole('button', { name: 'Enviar solicitação' }))
    await screen.findByText(mensagem)
    assert.equal(postsCriacao().length, 1)
    assert.equal(chamadas.filter(c => c.url.endsWith('/refresh')).length, refreshAntes)
    assert.equal((screen.getByRole('textbox', { name: 'Finalidade da solicitação' }) as HTMLTextAreaElement).value, 'Reunião acadêmica')
    assert.equal(screen.queryByRole('heading', { name: 'Solicitação registrada' }), null)
  })
}

for (const modo of ['rede', '500', 'resposta-invalida', 'status-200']) {
  test(`resultado incerto ${modo} bloqueia reenvio e preserva finalidade editável`, async () => {
    autenticado = true
    horariosResposta = [slotApi()]
    const user = await prepararEnvio()
    const fetchValido = globalThis.fetch
    let posts = 0
    globalThis.fetch = async (input, options) => {
      if (String(input).includes('/solicitacoes/')) {
        posts++
        if (modo === 'rede') throw Error('offline')
        if (modo === '500') return Response.json({ detail: 'Falha interna' }, { status: 500 })
        if (modo === 'resposta-invalida') return Response.json({}, { status: 201 })
        return Response.json({ ...JSON.parse(String(options?.body)), id: 901, status: 'Pendente', id_solicitante: 1 }, { status: 200 })
      }
      return fetchValido(input, options)
    }
    await user.click(screen.getByRole('button', { name: 'Enviar solicitação' }))
    await screen.findByText('A solicitação pode ter sido registrada. Não reenvie automaticamente.')
    const campo = screen.getByRole('textbox', { name: 'Finalidade da solicitação' }) as HTMLTextAreaElement
    assert.equal(campo.value, 'Reunião acadêmica')
    await user.type(campo, ' editada')
    assert.ok(screen.getByRole('button', { name: 'Enviar solicitação' }).hasAttribute('disabled'))
    assert.equal(posts, 1)
    assert.equal(screen.queryByText('Prévia preparada localmente. Nenhuma solicitação foi enviada.'), null)
    assert.equal(screen.queryByRole('heading', { name: 'Solicitação registrada' }), null)
  })
}

test('falha antes do POST é identificada e disponibilidade alterada impede transmissão', async () => {
  autenticado = true
  horariosResposta = [slotApi()]
  const user = await prepararEnvio()
  horariosResposta = []
  await user.click(screen.getByRole('button', { name: 'Enviar solicitação' }))
  await screen.findByText('Selecione um intervalo futuro e disponível.')
  assert.equal(postsCriacao().length, 0)
  assert.equal((screen.getByRole('textbox', { name: 'Finalidade da solicitação' }) as HTMLTextAreaElement).value, 'Reunião acadêmica')
  assert.equal(screen.queryByText('A solicitação pode ter sido registrada. Não reenvie automaticamente.'), null)
})

test('confirmação fica preservada no estado da navegação e não permite novo envio ao remontar', async () => {
  autenticado = true
  horariosResposta = [slotApi()]
  const user = userEvent.setup()
  let salvo: unknown
  function CapturarEstado() { salvo = useLocation().state; return null }
  const tela = render(<MemoryRouter initialEntries={[`/laboratorios/77/agendamento/detalhes?data=${diaApi}&inicio=08:00&fim=09:00`]}><CapturarEstado /><App /></MemoryRouter>)
  await user.type(await screen.findByRole('textbox', { name: 'Finalidade da solicitação' }), 'Reunião acadêmica')
  await user.click(screen.getByRole('button', { name: 'Revisar solicitação' }))
  await screen.findByText('Prévia preparada localmente. Nenhuma solicitação foi enviada.')
  await user.click(screen.getByRole('button', { name: 'Enviar solicitação' }))
  await screen.findByRole('heading', { name: 'Solicitação registrada' })
  tela.unmount()
  render(<MemoryRouter initialEntries={[{ pathname: '/laboratorios/77/agendamento/detalhes', search: `?data=${diaApi}&inicio=08:00&fim=09:00`, state: salvo }]}><App /></MemoryRouter>)
  await screen.findByRole('heading', { name: 'Solicitação registrada' })
  assert.equal(screen.queryByRole('button', { name: 'Enviar solicitação' }), null)
  assert.equal(postsCriacao().length, 1)
})


test('timeout de criação mantém resultado incerto ao remontar a mesma navegação', async t => {
  autenticado = true
  horariosResposta = [slotApi()]
  let salvo: unknown
  function CapturarEstado() { salvo = useLocation().state; return null }
  const user = userEvent.setup()
  const tela = render(<MemoryRouter initialEntries={[`/laboratorios/77/agendamento/detalhes?data=${diaApi}&inicio=08:00&fim=09:00`]}><CapturarEstado /><App /></MemoryRouter>)
  await user.type(await screen.findByRole('textbox', { name: 'Finalidade da solicitação' }), 'Reunião acadêmica')
  await user.click(screen.getByRole('button', { name: 'Revisar solicitação' }))
  await screen.findByText('Prévia preparada localmente. Nenhuma solicitação foi enviada.')
  const timeoutOriginal = AbortSignal.timeout.bind(AbortSignal)
  t.mock.method(AbortSignal, 'timeout', () => timeoutOriginal(15))
  const fetchValido = globalThis.fetch
  let posts = 0
  globalThis.fetch = async (input, options) => {
    if (String(input).includes('/solicitacoes/')) {
      posts++
      return new Promise<Response>((_resolve, reject) => {
        options?.signal?.addEventListener('abort', () => reject(options.signal?.reason), { once: true })
      })
    }
    return fetchValido(input, options)
  }
  await user.click(screen.getByRole('button', { name: 'Enviar solicitação' }))
  await screen.findByText('A solicitação pode ter sido registrada. Não reenvie automaticamente.')
  assert.equal(posts, 1)
  tela.unmount()
  render(<MemoryRouter initialEntries={[{ pathname: '/laboratorios/77/agendamento/detalhes', search: `?data=${diaApi}&inicio=08:00&fim=09:00`, state: salvo }]}><App /></MemoryRouter>)
  await screen.findByRole('textbox', { name: 'Finalidade da solicitação' })
  await screen.findByText('A solicitação pode ter sido registrada. Não reenvie automaticamente.')
  assert.equal((screen.getByRole('textbox', { name: 'Finalidade da solicitação' }) as HTMLTextAreaElement).value, 'Reunião acadêmica')
  assert.ok(screen.getByRole('button', { name: 'Enviar solicitação' }).hasAttribute('disabled'))
  assert.equal(posts, 1)
})


test('botão explica finalidade inválida, revisão pendente e alteração após revisão sem enviar', async () => {
  autenticado = true
  horariosResposta = [slotApi()]
  const user = userEvent.setup()
  abrir(`/laboratorios/77/agendamento/detalhes?data=${diaApi}&inicio=08:00&fim=09:00`)
  const campo = await screen.findByRole('textbox', { name: 'Finalidade da solicitação' })
  const botao = () => screen.getByRole('button', { name: 'Enviar solicitação' })
  const ajuda = () => document.getElementById(botao().getAttribute('aria-describedby')!)!
  assert.ok(botao().hasAttribute('disabled'))
  assert.match(ajuda().textContent!, /Informe a finalidade/)
  assert.equal(ajuda().getAttribute('role'), 'status')
  await user.type(campo, 'Reunião acadêmica')
  assert.ok(botao().hasAttribute('disabled'))
  assert.match(ajuda().textContent!, /Clique em Revisar solicitação/)
  await user.click(botao())
  assert.equal(postsCriacao().length, 0)
  await user.click(screen.getByRole('button', { name: 'Revisar solicitação' }))
  await waitFor(() => assert.equal(botao().hasAttribute('disabled'), false))
  assert.match(ajuda().textContent!, /Dados revisados/)
  await user.type(screen.getByRole('textbox', { name: 'Finalidade da solicitação' }), ' editada')
  assert.ok(botao().hasAttribute('disabled'))
  assert.match(ajuda().textContent!, /mudou.*Revisar solicitação novamente/)
  await user.click(screen.getByRole('button', { name: 'Revisar solicitação' }))
  await waitFor(() => assert.equal(botao().hasAttribute('disabled'), false))
  assert.equal(postsCriacao().length, 0)
})

test('bloqueio por resultado incerto tem explicação associada mesmo após editar finalidade', async () => {
  autenticado = true
  horariosResposta = [slotApi()]
  const user = await prepararEnvio()
  criacaoStatus = 500
  await user.click(screen.getByRole('button', { name: 'Enviar solicitação' }))
  await screen.findByText('A solicitação pode ter sido registrada. Não reenvie automaticamente.')
  const botao = screen.getByRole('button', { name: 'Enviar solicitação' })
  const ajuda = document.getElementById(botao.getAttribute('aria-describedby')!)!
  assert.ok(botao.hasAttribute('disabled'))
  assert.match(ajuda.textContent!, /tentativa anterior sem confirmação/)
  await user.type(screen.getByRole('textbox', { name: 'Finalidade da solicitação' }), ' editada')
  assert.match(ajuda.textContent!, /tentativa anterior sem confirmação/)
  assert.equal(postsCriacao().length, 1)
})

test('falha da navegação inicial é tratada antes de qualquer consulta ou POST e libera trava', async () => {
  let preparacoes = 0
  let navegacoes = 0
  function ProvaEnvio() {
    const envio = useEnvioSolicitacao('teste-escopo', 1)
    return <><button disabled={envio.ocupado || envio.bloqueado} onClick={() => {
      void envio.enviar(async () => { preparacoes++; throw Error('Não deveria preparar') })
    }}>Testar envio</button>{envio.estado.tipo === 'erro' && <p role="alert">{envio.estado.mensagem}</p>}</>
  }
  const navigator = { createHref: () => '/', go: () => {}, push: () => {}, replace: () => { navegacoes++; throw Error('DataCloneError simulado') } }
  render(<Router location="/teste" navigator={navigator}><ProvaEnvio /></Router>)
  const user = userEvent.setup()
  await user.click(screen.getByRole('button', { name: 'Testar envio' }))
  await screen.findByText('Não foi possível atualizar a navegação antes do envio. Nenhuma criação foi enviada.')
  assert.equal(preparacoes, 0)
  assert.equal(chamadas.length, 0)
  assert.equal(screen.getByRole('button', { name: 'Testar envio' }).hasAttribute('disabled'), false)
  const anteriores = navegacoes
  await user.click(screen.getByRole('button', { name: 'Testar envio' }))
  assert.ok(navegacoes > anteriores)
  assert.equal(preparacoes, 0)
  assert.equal(chamadas.length, 0)
})
