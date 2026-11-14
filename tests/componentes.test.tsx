import assert from 'node:assert/strict'
import { test, afterEach, beforeEach } from 'node:test'
import { render, screen, cleanup, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import App from '../src/App'

const usuario = { id: 1, nome_completo: 'Ana Teste', cpf: '12345678901', vinculo_institucional: 'MAT123', email: 'ana@example.com', perfil: 'Membro', ativo: true }
const jwt = () => `a.${Buffer.from(JSON.stringify({ exp: Date.now() / 1000 + 900 })).toString('base64url')}.c`
const espacosTeste = [{ id: 77, nome: 'Laboratório API 77', descricao: null, capacidade: 20, bloco: 'Bloco X', disponibilidade: true,
  recursos: [{ id: 501, nome: 'Impressora 3D', tipo: 'Equipamento', autorizacao_necessaria: true, disponibilidade: false, reserva_independente: true, id_espaco: 77 }],
  horarios_funcionamento: [], pausas_funcionamento: [], usuarios_vinculados: [] }]
let espacosResposta: unknown = espacosTeste
let usuarioResposta = usuario
let autenticado = false
let chamadas: { url: string; body: unknown }[] = []

beforeEach(() => {
  sessionStorage.clear()
  autenticado = false
  usuarioResposta = usuario
  espacosResposta = espacosTeste
  chamadas = []
  globalThis.fetch = async (input, options) => {
    const url = String(input)
    chamadas.push({ url, body: options?.body ? JSON.parse(String(options.body)) : null })
    if (url.endsWith('/login')) autenticado = true
    if (url.endsWith('/logout')) { autenticado = false; return new Response(null, { status: 204 }) }
    if (url.endsWith('/usuarios/')) return Response.json(usuario, { status: 201 })
    if (!autenticado) return Response.json({ detail: 'Sessão expirada' }, { status: 401 })
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

test('detalhe usa ID real e calendário permanece bloqueado sem horários fictícios', async () => {
  autenticado = true
  const user = userEvent.setup()
  abrir('/')
  await user.click(await screen.findByRole('link', { name: 'Ver laboratório' }))
  await screen.findByRole('heading', { name: 'Laboratório API 77' })
  assert.ok(screen.getByRole('heading', { name: 'Detalhes do laboratório' }))
  await user.click(screen.getByRole('link', { name: 'Consultar situação do agendamento' }))
  await screen.findByRole('heading', { name: 'Agendamento ainda não integrado' })
  assert.equal(screen.queryByText(/09:00/), null)
  assert.equal(screen.queryByRole('button', { name: 'Revisar solicitação' }), null)
})

for (const caminho of ['/laboratorios/77/agendamento', '/laboratorios/77/agendamento/detalhes']) {
  test(`acesso direto mantém bloqueio explícito em ${caminho}`, async () => {
    autenticado = true
    abrir(caminho)
    await screen.findByRole('heading', { name: 'Agendamento ainda não integrado' })
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
