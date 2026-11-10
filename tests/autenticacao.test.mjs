import assert from 'node:assert/strict'
import { test, beforeEach } from 'node:test'
import { readFile } from 'node:fs/promises'
import { stripTypeScriptTypes } from 'node:module'

// Exercita os serviços reais, substituindo somente a configuração do Vite.
const fonteHttp = (await readFile(new URL('../src/services/http.ts', import.meta.url), 'utf8'))
  .replace('import.meta.env.VITE_API_URL', JSON.stringify('http://localhost:5173'))
const urlHttp = `data:text/javascript;base64,${Buffer.from(stripTypeScriptTypes(fonteHttp)).toString('base64')}`
const fonte = (await readFile(new URL('../src/services/autenticacao.ts', import.meta.url), 'utf8'))
  .replace("from './http'", `from '${urlHttp}'`)
const compilado = stripTypeScriptTypes(fonte)
const api = await import(`data:text/javascript;base64,${Buffer.from(compilado).toString('base64')}`)

const dadosUsuario = {
  id: 1, nome_completo: 'Membro de Teste', cpf: '00000000001',
  vinculo_institucional: 'MAT123', email: 'membro@example.com', perfil: 'Membro', ativo: true,
}
const respostaLogin = { access_token: 'token-de-teste', token_type: 'bearer', usuario: dadosUsuario }
const cache = new Map()
const storage = {
  getItem: chave => cache.get(chave) ?? null,
  setItem: (chave, valor) => cache.set(chave, String(valor)),
  removeItem: chave => cache.delete(chave),
}
globalThis.sessionStorage = storage
const resposta = (status, corpo) => new Response(corpo === undefined ? null : JSON.stringify(corpo), { status })
const jwt = exp => `a.${Buffer.from(JSON.stringify({ exp })).toString('base64url')}.c`

beforeEach(() => {
  cache.clear()
  globalThis.fetch = () => { throw Error('fetch não configurado') }
})

test('login POST envia credenciais, recebe cookie por include e salva JWT', async () => {
  globalThis.fetch = async (url, opcoes) => {
    assert.equal(url, 'http://localhost:5173/usuarios/login')
    assert.equal(opcoes.method, 'POST')
    assert.equal(opcoes.credentials, 'include')
    assert.deepEqual(JSON.parse(opcoes.body), { identificacao: 'membro@example.com', senha: 'SenhaValida123!' })
    return resposta(200, respostaLogin)
  }
  const dados = await api.autenticarUsuario('membro@example.com', 'SenhaValida123!')
  assert.equal(dados.usuario.perfil, 'Membro')
  assert.equal(api.obterTokenAcesso(), 'token-de-teste')
})

test('401 de login não cria sessão', async () => {
  globalThis.fetch = async () => resposta(401, { detail: 'Credenciais inválidas.' })
  await assert.rejects(api.autenticarUsuario('a@b.com', 'errada'), /Credenciais inválidas/)
  assert.equal(api.obterTokenAcesso(), null)
})

test('resposta inválida de login não é armazenada', async () => {
  globalThis.fetch = async () => resposta(200, { ...respostaLogin, usuario: { ...dadosUsuario, perfil: 'Servidor' } })
  await assert.rejects(api.autenticarUsuario('a@b.com', 'certa'), /sessão inválida/)
  assert.equal(api.obterTokenAcesso(), null)
})

test('cadastro usa POST /usuarios/ e exige perfil Membro', async () => {
  const entrada = { nome_completo: 'Ana', cpf: '00000000001', vinculo_institucional: 'MAT123', email: 'ana@ifal.edu.br', senha: 'SenhaValida123!' }
  globalThis.fetch = async (url, opcoes) => {
    assert.equal(url, 'http://localhost:5173/usuarios/')
    assert.equal(opcoes.method, 'POST')
    assert.deepEqual(JSON.parse(opcoes.body), entrada)
    return resposta(201, dadosUsuario)
  }
  assert.equal((await api.cadastrarMembro(entrada)).perfil, 'Membro')
})

test('409 de cadastro mostra detalhe real da API', async () => {
  globalThis.fetch = async () => resposta(409, { detail: 'CPF já cadastrado.' })
  await assert.rejects(api.cadastrarMembro({}), /CPF já cadastrado/)
})

test('GET /usuarios/me confere JWT e usuário', async () => {
  storage.setItem('labagenda.access_token', jwt(Math.floor(Date.now() / 1000) + 300))
  globalThis.fetch = async (url, opcoes) => {
    assert.equal(url, 'http://localhost:5173/usuarios/me')
    assert.ok(opcoes.headers.get('Authorization').startsWith('Bearer '))
    assert.equal(opcoes.credentials, 'include')
    return resposta(200, dadosUsuario)
  }
  assert.equal((await api.verificarSessao())?.id, 1)
})

test('access token expirado tenta renovar via cookie e validar /me', async () => {
  storage.setItem('labagenda.access_token', jwt(Math.floor(Date.now() / 1000) - 10))
  let chamados = []
  globalThis.fetch = async (url, opcoes) => {
    chamados.push(url)
    assert.equal(opcoes.credentials, 'include')
    if (url.endsWith('/refresh')) return resposta(200, respostaLogin)
    if (url.endsWith('/me')) return resposta(200, dadosUsuario)
    throw Error('Rota inesperada')
  }
  assert.equal((await api.verificarSessao())?.id, 1)
  assert.deepEqual(chamados, ['http://localhost:5173/usuarios/refresh', 'http://localhost:5173/usuarios/me'])
  assert.equal(api.obterTokenAcesso(), 'token-de-teste')
})

test('sem token acessível tenta recuperar sessão por cookie', async () => {
  let chamados = []
  globalThis.fetch = async url => {
    chamados.push(url)
    return url.endsWith('/refresh') ? resposta(200, respostaLogin) : resposta(200, dadosUsuario)
  }
  assert.equal((await api.verificarSessao())?.id, 1)
  assert.equal(chamados.length, 2)
})

test('401 em /usuarios/me tenta refresh uma vez e valida novamente', async () => {
  storage.setItem('labagenda.access_token', jwt(Math.floor(Date.now() / 1000) + 300))
  let chamadasMe = 0
  let chamadasRefresh = 0
  globalThis.fetch = async url => {
    if (url.endsWith('/refresh')) { chamadasRefresh++; return resposta(200, respostaLogin) }
    if (url.endsWith('/me')) { chamadasMe++; return chamadasMe === 1 ? resposta(401, { detail: 'revogado' }) : resposta(200, dadosUsuario) }
    throw Error('Rota inesperada')
  }
  assert.equal((await api.verificarSessao())?.id, 1)
  assert.equal(chamadasMe, 2)
  assert.equal(chamadasRefresh, 1)
})

test('refresh recusado remove dados locais', async () => {
  storage.setItem('labagenda.access_token', jwt(Math.floor(Date.now() / 1000) - 10))
  globalThis.fetch = async () => resposta(401, { detail: 'Sessão expirada' })
  assert.equal(await api.verificarSessao(), null)
  assert.equal(api.obterTokenAcesso(), null)
})

test('falha de rede no refresh mantém dados locais e permite tentar novamente', async () => {
  storage.setItem('labagenda.access_token', jwt(Math.floor(Date.now() / 1000) - 10))
  globalThis.fetch = async () => { throw Error('rede indisponível') }
  await assert.rejects(api.verificarSessao(), /Não foi possível conectar/)
  assert.ok(api.obterTokenAcesso())
})

test('renovações simultâneas usam apenas uma requisição /refresh', async () => {
  let liberar
  let chamadas = 0
  globalThis.fetch = async () => {
    chamadas++
    return new Promise(resolve => { liberar = () => resolve(resposta(200, respostaLogin)) })
  }
  const primeira = api.renovarSessao()
  const segunda = api.renovarSessao()
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(chamadas, 1)
  liberar()
  assert.equal((await primeira)?.usuario.id, 1)
  assert.equal((await segunda)?.usuario.id, 1)
  assert.equal(chamadas, 1)
})

test('logout chama o servidor e remove token local mesmo com 204 sem JSON', async () => {
  storage.setItem('labagenda.access_token', 'token')
  globalThis.fetch = async (url, opcoes) => {
    assert.equal(url, 'http://localhost:5173/usuarios/logout')
    assert.equal(opcoes.method, 'POST')
    assert.equal(opcoes.credentials, 'include')
    return new Response(null, { status: 204 })
  }
  await api.desconectarUsuario()
  assert.equal(api.obterTokenAcesso(), null)
})

test('logout indisponível limpa local mas informa impossibilidade de revogação', async () => {
  storage.setItem('labagenda.access_token', 'token')
  globalThis.fetch = async () => { throw Error('offline') }
  await assert.rejects(api.desconectarUsuario(), /Não foi possível conectar/)
  assert.equal(api.obterTokenAcesso(), null)
})

const proximoTurno = () => new Promise(resolve => setImmediate(resolve))

test('403 no login informa usuário inativo', async () => {
  globalThis.fetch = async () => resposta(403, { detail: 'Usuário inativo.' })
  await assert.rejects(api.autenticarUsuario('a@b.com', 'senha'), /Usuário inativo/)
})

test('422 mostra os detalhes de validação da API', async () => {
  globalThis.fetch = async () => resposta(422, { detail: [{ msg: 'Senha curta.' }, { msg: 'E-mail inválido.' }] })
  await assert.rejects(api.cadastrarMembro({}), /Senha curta. E-mail inválido./)
})

test('JSON inválido não cria sessão', async () => {
  globalThis.fetch = async () => new Response('{invalido', { status: 200 })
  await assert.rejects(api.autenticarUsuario('a', 'b'), /dados inesperados/)
  assert.equal(api.obterTokenAcesso(), null)
})

test('usuário inativo em resposta de login não autentica', async () => {
  globalThis.fetch = async () => resposta(200, { ...respostaLogin, usuario: { ...dadosUsuario, ativo: false } })
  await assert.rejects(api.autenticarUsuario('a', 'b'), /sessão inválida/)
})

test('403 em /me encerra sessão sem tentar refresh', async () => {
  storage.setItem('labagenda.access_token', jwt(Date.now() / 1000 + 300))
  globalThis.fetch = async url => {
    assert.ok(url.endsWith('/me'))
    return resposta(403, { detail: 'Inativo' })
  }
  assert.equal(await api.verificarSessao(), null)
  assert.equal(api.obterTokenAcesso(), null)
})

test('401 persistente limita a uma renovação, sem loop', async () => {
  storage.setItem('labagenda.access_token', jwt(Date.now() / 1000 + 300))
  let refresh = 0
  globalThis.fetch = async url => {
    if (url.endsWith('/refresh')) { refresh++; return resposta(200, respostaLogin) }
    return resposta(401, {})
  }
  assert.equal(await api.verificarSessao(), null)
  assert.equal(refresh, 1)
  assert.equal(api.obterTokenAcesso(), null)
})

test('verificações concorrentes compartilham /me', async () => {
  storage.setItem('labagenda.access_token', jwt(Date.now() / 1000 + 300))
  let chamadas = 0
  globalThis.fetch = async () => { chamadas++; return resposta(200, dadosUsuario) }
  await Promise.all([api.verificarSessao(), api.verificarSessao(), api.verificarSessao()])
  assert.equal(chamadas, 1)
})

test('logout aguarda refresh e impede restauração tardia', async () => {
  let liberar
  const rotas = []
  globalThis.fetch = async url => {
    rotas.push(url.split('/').at(-1))
    if (url.endsWith('/refresh')) return new Promise(resolve => { liberar = () => resolve(resposta(200, respostaLogin)) })
    return resposta(204)
  }
  const renovacao = api.renovarSessao()
  await proximoTurno()
  const logout = api.desconectarUsuario()
  assert.equal(api.obterTokenAcesso(), null)
  assert.equal(await api.verificarSessao(), null)
  liberar()
  assert.equal(await renovacao, null)
  await logout
  assert.deepEqual(rotas, ['refresh', 'logout'])
  assert.equal(api.obterTokenAcesso(), null)
})

test('resposta tardia de /me não restaura usuário após logout', async () => {
  storage.setItem('labagenda.access_token', jwt(Date.now() / 1000 + 300))
  let liberar
  globalThis.fetch = async url => url.endsWith('/me')
    ? new Promise(resolve => { liberar = () => resolve(resposta(200, dadosUsuario)) })
    : resposta(204)
  const verificacao = api.verificarSessao()
  await api.desconectarUsuario()
  liberar()
  assert.equal(await verificacao, null)
  assert.equal(api.obterUsuarioAutenticado(), null)
})

test('logout falho bloqueia recuperação automática até novo login explícito', async () => {
  globalThis.fetch = async () => { throw Error('offline') }
  await assert.rejects(api.desconectarUsuario())
  globalThis.fetch = () => { assert.fail('não deve chamar refresh após sair') }
  assert.equal(await api.verificarSessao(), null)
  assert.equal(await api.renovarSessao(), null)
  globalThis.fetch = async url => resposta(200, url.endsWith('/me') ? dadosUsuario : respostaLogin)
  await api.autenticarUsuario('a', 'b')
  assert.equal((await api.verificarSessao())?.id, 1)
})

test('logout concorrente envia uma única revogação', async () => {
  let chamadas = 0
  globalThis.fetch = async () => { chamadas++; return resposta(204) }
  await Promise.all([api.desconectarUsuario(), api.desconectarUsuario()])
  assert.equal(chamadas, 1)
})

test('login em andamento é invalidado e cookie revogado antes de concluir logout', async () => {
  let liberar
  const rotas = []
  globalThis.fetch = async url => {
    rotas.push(url.split('/').at(-1))
    if (url.endsWith('/login')) return new Promise(resolve => { liberar = () => resolve(resposta(200, respostaLogin)) })
    return resposta(204)
  }
  const login = api.autenticarUsuario('a', 'b')
  const rejeicao = assert.rejects(login, /sessão foi encerrada/)
  await proximoTurno()
  const logout = api.desconectarUsuario()
  liberar()
  await rejeicao
  await logout
  assert.deepEqual(rotas, ['login', 'logout'])
  assert.equal(api.obterTokenAcesso(), null)
})

test('JWT local só fornece expiração; assinatura continua validada por /me', async () => {
  assert.equal(api.obterExpiracaoToken('inválido'), null)
  storage.setItem('labagenda.access_token', jwt(Date.now() / 1000 + 3600))
  globalThis.fetch = async () => resposta(401, {})
  assert.equal(await api.verificarSessao(), null)
})

// Regressões preservadas da branch feature/integracao-api, atualizadas para Membro/refresh.
for (const corpo of [undefined, null, [], 'texto', 42]) {
  test(`login rejeita resposta sem objeto válido: ${JSON.stringify(corpo)}`, async () => {
    globalThis.fetch = async () => resposta(200, corpo)
    await assert.rejects(api.autenticarUsuario('a@b.com', 'teste'), api.ErroAutenticacao)
    assert.equal(api.obterTokenAcesso(), null)
  })
}

test('login rejeita 204 sem gravar sessão', async () => {
  globalThis.fetch = async () => new Response(null, { status: 204 })
  await assert.rejects(api.autenticarUsuario('a', 'b'), /dados inesperados/)
})

test('me com resposta vazia bloqueia sem apagar token por falha do servidor', async () => {
  storage.setItem('labagenda.access_token', 'token-de-teste')
  globalThis.fetch = async () => resposta(200)
  await assert.rejects(api.verificarSessao(), /dados inesperados/)
  assert.equal(api.obterTokenAcesso(), 'token-de-teste')
})

test('me rejeita usuário inativo, id ausente ou ativo textual', async () => {
  for (const usuario of [{ ...dadosUsuario, ativo: false }, { ativo: true }, { ...dadosUsuario, ativo: 'true' }]) {
    storage.setItem('labagenda.access_token', 'token-de-teste')
    globalThis.fetch = async () => resposta(200, usuario)
    assert.equal(await api.verificarSessao(), null)
    assert.equal(api.obterTokenAcesso(), null)
  }
})

test('cadastro rejeita objeto sem dados de usuário', async () => {
  globalThis.fetch = async () => resposta(201, {})
  await assert.rejects(api.cadastrarMembro({}), /dados inesperados/)
})

test('500 preserva sessão e status', async () => {
  storage.setItem('labagenda.access_token', 'token-de-teste')
  globalThis.fetch = async () => resposta(500, {})
  await assert.rejects(api.verificarSessao(), erro => erro.status === 500)
  assert.equal(api.obterTokenAcesso(), 'token-de-teste')
})

test('login rejeita token vazio, tipo incorreto e usuário incompleto', async () => {
  for (const dados of [
    { ...respostaLogin, access_token: '   ' },
    { ...respostaLogin, token_type: 'outro' },
    { ...respostaLogin, usuario: { id: 1 } },
    { ...respostaLogin, usuario: { ...dadosUsuario, ativo: 'true' } },
    { ...respostaLogin, usuario: { ...dadosUsuario, id: -1 } },
  ]) {
    globalThis.fetch = async () => resposta(200, dados)
    await assert.rejects(api.autenticarUsuario('a', 'b'), /sessão inválida/)
    assert.equal(api.obterTokenAcesso(), null)
  }
})

test('cancelamento externo mantém AbortError', async () => {
  const erro = new DOMException('Cancelado', 'AbortError')
  globalThis.fetch = async () => { throw erro }
  await assert.rejects(api.autenticarUsuario('a', 'b'), falha => falha === erro)
})
