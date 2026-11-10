import assert from 'node:assert/strict'
import { test, afterEach, beforeEach } from 'node:test'
import { render, screen, cleanup, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import App from '../src/App'

const usuario = { id: 1, nome_completo: 'Ana Teste', cpf: '12345678901', vinculo_institucional: 'MAT123', email: 'ana@example.com', perfil: 'Membro', ativo: true }
const jwt = () => `a.${Buffer.from(JSON.stringify({ exp: Date.now() / 1000 + 900 })).toString('base64url')}.c`
let autenticado = false
let chamadas: { url: string; body: unknown }[] = []

beforeEach(() => {
  sessionStorage.clear()
  autenticado = false
  chamadas = []
  globalThis.fetch = async (input, options) => {
    const url = String(input)
    chamadas.push({ url, body: options?.body ? JSON.parse(String(options.body)) : null })
    if (url.endsWith('/login')) autenticado = true
    if (url.endsWith('/logout')) { autenticado = false; return new Response(null, { status: 204 }) }
    if (url.endsWith('/usuarios/')) return Response.json(usuario, { status: 201 })
    if (!autenticado) return Response.json({ detail: 'Sessão expirada' }, { status: 401 })
    return Response.json(url.endsWith('/me') ? usuario : { access_token: jwt(), token_type: 'bearer', usuario })
  }
})
afterEach(cleanup)
const abrir = (caminho: string) => render(<MemoryRouter initialEntries={[caminho]}><App /></MemoryRouter>)

for (const caminho of ['/', '/laboratorios/1', '/laboratorios/1/agendamento', '/laboratorios/1/agendamento/detalhes', '/meus-agendamentos']) {
  test(`protege rota ${caminho} sem sessão`, async () => {
    abrir(caminho)
    await screen.findByText('Faça login para acessar o sistema.')
    assert.ok(screen.getByRole('button', { name: 'Entrar', exact: true }))
    assert.equal(screen.queryByRole('button', { name: 'Sair', exact: true }), null)
  })
}

test('login preserva destino da agenda, filtros e logout', async () => {
  const user = userEvent.setup()
  abrir('/meus-agendamentos')
  await screen.findByText('Faça login para acessar o sistema.')
  await user.type(screen.getByLabelText('E-mail ou CPF'), 'ana@example.com')
  await user.type(screen.getByLabelText('Senha', { exact: true }), 'SenhaValida123!')
  await user.click(screen.getByRole('button', { name: 'Entrar', exact: true }))
  await screen.findByRole('heading', { name: 'Agendamentos', exact: true })
  const filtro = screen.getByRole('button', { name: 'Pendente', exact: true })
  await user.click(filtro)
  assert.equal(filtro.getAttribute('aria-pressed'), 'true')
  await user.click(screen.getByRole('link', { name: 'Laboratórios', exact: true }))
  await screen.findByRole('heading', { name: 'Encontre o laboratório ideal' })
  await user.click(screen.getByRole('button', { name: 'Sair', exact: true }))
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
  assert.equal(screen.queryByRole('heading', { name: 'Agendamentos', exact: true }), null)
  autenticado = true
  globalThis.fetch = fetchValido
  await userEvent.setup().click(screen.getByRole('button', { name: 'Tentar novamente' }))
  await screen.findByRole('heading', { name: 'Agendamentos', exact: true })
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
  await userEvent.setup().click(screen.getByRole('button', { name: 'Sair', exact: true }))
  await screen.findByText(/Não foi possível confirmar o logout/)
  globalThis.fetch = fetchValido
  await userEvent.setup().click(screen.getByRole('button', { name: 'Tentar encerrar sessão novamente' }))
  await waitFor(() => assert.ok(screen.getByText('Sessão encerrada.')))
})
