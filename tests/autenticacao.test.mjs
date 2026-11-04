import assert from 'node:assert/strict'
import { test, beforeEach } from 'node:test'
import { readFile } from 'node:fs/promises'
import { stripTypeScriptTypes } from 'node:module'

// Compila o serviço real com a URL de teste, sem adicionar dependências ao projeto.
const fonte = (await readFile(new URL('../src/services/autenticacao.ts', import.meta.url), 'utf8'))
  .replace('import.meta.env.VITE_API_URL', JSON.stringify('http://localhost:8000'))
const compilado = stripTypeScriptTypes(fonte)
const api = await import(`data:text/javascript;base64,${Buffer.from(compilado).toString('base64')}`)

const dadosUsuario = {
  id: 1, nome_completo: 'Servidor de Teste', cpf: '00000000001',
  vinculo_institucional: 'MAT123', email: 'servidor@example.com', perfil: 'Servidor', ativo: true,
}
const respostaLogin = { access_token: 'token-de-teste', token_type: 'bearer', usuario: dadosUsuario }
const cache = new Map()
const storage = {
  getItem: chave => cache.get(chave) ?? null,
  setItem: (chave, valor) => cache.set(chave, String(valor)),
  removeItem: chave => cache.delete(chave),
}

globalThis.sessionStorage = storage

beforeEach(() => {
  cache.clear()
  globalThis.fetch = () => { throw Error('fetch não configurado') }
})

function resposta(status, corpo) {
  return { ok: status >= 200 && status < 300, status, json: async () => corpo }
}

test('POST /usuarios/login envia o payload real e salva JWT', async () => {
  globalThis.fetch = async (url, opcoes) => {
    assert.equal(url, 'http://localhost:8000/usuarios/login')
    assert.equal(opcoes.method, 'POST')
    assert.deepEqual(JSON.parse(opcoes.body), { identificacao: 'servidor@example.com', senha: 'SenhaValida123!' })
    return resposta(200, respostaLogin)
  }
  const dados = await api.autenticarUsuario('servidor@example.com', 'SenhaValida123!')
  assert.equal(dados.usuario.nome_completo, dadosUsuario.nome_completo)
  assert.equal(api.obterTokenAcesso(), 'token-de-teste')
  assert.equal(api.obterUsuarioAutenticado().perfil, 'Servidor')
})

test('401 de login não grava sessão', async () => {
  globalThis.fetch = async () => resposta(401, { detail: 'Credenciais inválidas.' })
  await assert.rejects(api.autenticarUsuario('a@b.com', 'errada'), /Credenciais inválidas/)
  assert.equal(api.obterTokenAcesso(), null)
})

test('403 de login mostra erro do backend', async () => {
  globalThis.fetch = async () => resposta(403, { detail: 'Usuário inativo.' })
  await assert.rejects(api.autenticarUsuario('a@b.com', 'certo'), /Usuário inativo/)
})

test('resposta 200 sem JWT é rejeitada e não cria sessão', async () => {
  globalThis.fetch = async () => resposta(200, { usuario: dadosUsuario })
  await assert.rejects(api.autenticarUsuario('a@b.com', 'certo'), /sessão inválida/)
  assert.equal(api.obterTokenAcesso(), null)
})

test('GET /usuarios/me envia Bearer e confirma a sessão', async () => {
  storage.setItem('labagenda.access_token', 'token-de-teste')
  globalThis.fetch = async (url, opcoes) => {
    assert.equal(url, 'http://localhost:8000/usuarios/me')
    assert.equal(opcoes.headers.Authorization, 'Bearer token-de-teste')
    return resposta(200, dadosUsuario)
  }
  assert.equal((await api.verificarSessao())?.id, 1)
})

test('401 em /usuarios/me remove sessão', async () => {
  storage.setItem('labagenda.access_token', 'token-de-teste')
  globalThis.fetch = async () => resposta(401, { detail: 'Credenciais inválidas.' })
  assert.equal(await api.verificarSessao(), null)
  assert.equal(api.obterTokenAcesso(), null)
})

test('falha de rede não apaga sessão sem confirmação do servidor', async () => {
  storage.setItem('labagenda.access_token', 'token-de-teste')
  globalThis.fetch = async () => { throw new Error('offline') }
  await assert.rejects(api.verificarSessao(), /Não foi possível conectar/)
  assert.equal(api.obterTokenAcesso(), 'token-de-teste')
})

test('JWT expirado não chama a API e remove a sessão', async () => {
  const token = `a.${Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) - 10 })).toString('base64url')}.c`
  storage.setItem('labagenda.access_token', token)
  let chamadas = 0
  globalThis.fetch = () => { chamadas++; return resposta(200, dadosUsuario) }
  assert.equal(api.tokenExpirou(token), true)
  assert.equal(await api.verificarSessao(), null)
  assert.equal(chamadas, 0)
  assert.equal(api.obterTokenAcesso(), null)
})

test('POST /usuarios/servidor envia o cadastro público autorizado', async () => {
  const entrada = { nome_completo:'Ana', cpf:'00000000001', vinculo_institucional:'SIAPE123', email:'ana@ifal.edu.br', senha:'SenhaForte123!' }
  globalThis.fetch = async (url, opcoes) => {
    assert.equal(url, 'http://localhost:8000/usuarios/servidor')
    assert.deepEqual(JSON.parse(opcoes.body), entrada)
    return resposta(201, dadosUsuario)
  }
  assert.equal((await api.cadastrarServidor(entrada)).perfil, 'Servidor')
})

test('409 no cadastro apresenta detalhe do backend', async () => {
  globalThis.fetch = async () => resposta(409, { detail: 'CPF já cadastrado.' })
  await assert.rejects(api.cadastrarServidor({}), /CPF já cadastrado/)
})

test('logout limpa os dados locais', () => {
  storage.setItem('labagenda.access_token', 'token')
  storage.setItem('labagenda.usuario', JSON.stringify(dadosUsuario))
  api.encerrarSessao()
  assert.equal(api.obterTokenAcesso(), null)
  assert.equal(api.obterUsuarioAutenticado(), null)
})
