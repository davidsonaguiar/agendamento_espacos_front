import assert from 'node:assert/strict'
import { test, beforeEach } from 'node:test'
import { readFile } from 'node:fs/promises'
import { stripTypeScriptTypes } from 'node:module'
import { transformWithOxc } from 'vite'

const cache = new Map()
async function modulo(caminho) {
  const url = new URL(caminho, import.meta.url)
  if (cache.has(url.href)) return cache.get(url.href)
  let fonte = await readFile(url, 'utf8')
  fonte = fonte.replace('import.meta.env.VITE_API_URL', JSON.stringify('http://api.test'))
  let codigo = url.pathname.endsWith('.tsx')
    ? (await transformWithOxc(fonte, url.pathname, { jsx: { runtime: 'automatic' } })).code
    : stripTypeScriptTypes(fonte)
  const imports = [...codigo.matchAll(/from\s*['"]([^'"]+)['"]/g)]
  for (const [, referencia] of imports) {
    const resolvido = referencia.startsWith('.')
      ? await modulo(new URL(referencia + (referencia.endsWith('.ts') || referencia.endsWith('.tsx') ? '' : '.ts'), url).href)
      : import.meta.resolve(referencia)
    codigo = codigo.replaceAll(`'${referencia}'`, `'${resolvido}'`).replaceAll(`"${referencia}"`, `'${resolvido}'`)
  }
  const resultado = `data:text/javascript;base64,${Buffer.from(codigo).toString('base64')}`
  cache.set(url.href, resultado)
  return resultado
}


const { criarSolicitacao } = await import(await modulo('../src/services/solicitacoes.ts'))
const storage = new Map()
globalThis.sessionStorage = { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) }
const usuario = { id: 7, nome_completo: 'Membro Teste', cpf: '00000000007', vinculo_institucional: 'M7', email: 'membro@example.test', perfil: 'Membro', ativo: true }
const token = exp => `a.${Buffer.from(JSON.stringify({ exp })).toString('base64url')}.c`
const payload = () => ({ id_espaco: 77, finalidade: 'Uso acadêmico', horarios: [{ data_reserva: '2090-01-07', hora_inicio: '13:15:30.120000', hora_fim: '14:15:30.120000' }] })
const resposta = p => ({ ...p, id: 501, status: 'Pendente', id_solicitante: 7 })
let chamadas
let responderPost
beforeEach(() => {
  storage.clear()
  storage.set('labagenda.access_token', token(Date.now()/1000 + 900))
  storage.set('labagenda.usuario', JSON.stringify(usuario))
  chamadas = []
  responderPost = async p => Response.json(resposta(p), { status: 201 })
  globalThis.fetch = async (input, options) => {
    const path = new URL(String(input)).pathname
    chamadas.push({ path, options })
    if (path === '/usuarios/me') return Response.json(usuario)
    if (path === '/usuarios/refresh') return Response.json({ access_token: token(Date.now()/1000 + 1800), token_type: 'bearer', usuario })
    if (path === '/solicitacoes/') return responderPost(JSON.parse(options.body), options)
    throw Error('URL inesperada no mock')
  }
})
const posts = () => chamadas.filter(c => c.path === '/solicitacoes/')

test('serviço envia payload exato com Bearer e exige resposta HTTP 201 compatível', async () => {
  const entrada = payload()
  entrada.tipo = 'Espaço'
  entrada.urgencia = true
  entrada.horarios[0].campo_extra = 'não enviar'
  const criada = await criarSolicitacao(entrada, { idUsuario: 7 })
  assert.equal(criada.id, 501)
  assert.equal(criada.status, 'Pendente')
  assert.equal(posts().length, 1)
  const options = posts()[0].options
  assert.equal(options.method, 'POST')
  assert.equal(options.headers.get('Authorization'), `Bearer ${storage.get('labagenda.access_token')}`)
  assert.deepEqual(JSON.parse(options.body), payload())
})

test('sessão expirada renova antes de transmitir um único POST', async () => {
  storage.set('labagenda.access_token', token(1))
  await criarSolicitacao(payload(), { idUsuario: 7 })
  assert.deepEqual(chamadas.map(c => c.path), ['/usuarios/refresh', '/usuarios/me', '/solicitacoes/'])
  assert.equal(posts().length, 1)
})

test('falhas de sessão e entrada anteriores à criação não fazem POST', async () => {
  await assert.rejects(criarSolicitacao(payload(), { idUsuario: 99 }), e => e.resultado === 'nao-enviado' && e.status === 401)
  assert.equal(posts().length, 0)
  const controle = new AbortController()
  controle.abort()
  await assert.rejects(criarSolicitacao(payload(), { idUsuario: 7, signal: controle.signal }), e => e.resultado === 'nao-enviado')
  assert.equal(posts().length, 0)
  await assert.rejects(criarSolicitacao({ ...payload(), finalidade: 'x' }, { idUsuario: 7 }), e => e.resultado === 'nao-enviado')
  assert.equal(posts().length, 0)
})

for (const status of [401, 403, 404, 422]) {
  test(`POST rejeitado com ${status} não aciona refresh nem repetição`, async () => {
    responderPost = async () => Response.json({ detail: status === 422 ? [{ msg: 'Finalidade inválida' }] : 'Rejeitado' }, { status })
    await assert.rejects(criarSolicitacao(payload(), { idUsuario: 7 }), e => e.resultado === 'rejeitado' && e.status === status && (status !== 422 || e.message === 'Finalidade inválida'))
    assert.equal(posts().length, 1)
    assert.equal(chamadas.filter(c => c.path === '/usuarios/refresh').length, 0)
  })
}

for (const modo of ['rede', '500', 'json-invalido', 'vazio', '200', 'id-invalido', 'status-invalido', 'outro-espaco', 'outra-data']) {
  test(`resultado incerto ${modo} não repete o POST`, async () => {
    responderPost = async p => {
      if (modo === 'rede') throw Error('offline')
      if (modo === '500') return Response.json({ detail: 'Erro' }, { status: 500 })
      if (modo === 'json-invalido') return new Response('{invalido', { status: 201 })
      if (modo === 'vazio') return new Response(null, { status: 201 })
      const r = resposta(p)
      if (modo === 'id-invalido') r.id = null
      if (modo === 'status-invalido') r.status = 'desconhecido'
      if (modo === 'outro-espaco') r.id_espaco = 88
      if (modo === 'outra-data') r.horarios = [{ ...p.horarios[0], data_reserva: '2090-01-08' }]
      return Response.json(r, { status: modo === '200' ? 200 : 201 })
    }
    await assert.rejects(criarSolicitacao(payload(), { idUsuario: 7 }), e => e.resultado === 'incerto')
    assert.equal(posts().length, 1)
  })
}

test('timeout após transmissão é incerto e não gera nova tentativa', async t => {
  const timeoutOriginal = AbortSignal.timeout.bind(AbortSignal)
  t.mock.method(AbortSignal, 'timeout', () => timeoutOriginal(10))
  responderPost = async (_p, options) => new Promise((_resolve, reject) => {
    options.signal.addEventListener('abort', () => reject(options.signal.reason), { once: true })
  })
  // Mantém o processo vivo enquanto o timeout nativo (unref) dispara.
  const manterVivo = setInterval(() => {}, 100)
  try {
    await assert.rejects(criarSolicitacao(payload(), { idUsuario: 7 }), e => e.resultado === 'incerto')
    assert.equal(posts().length, 1)
  } finally { clearInterval(manterVivo) }
})

test('falha de rede na verificação da sessão é anterior ao POST', async () => {
  globalThis.fetch = async () => { throw Error('offline antes do POST') }
  await assert.rejects(criarSolicitacao(payload(), { idUsuario: 7 }), e => e.resultado === 'nao-enviado')
  assert.equal(posts().length, 0)
})


test('Administrador é bloqueado antes da criação mesmo com sessão válida', async () => {
  globalThis.fetch = async (input, options) => {
    const path = new URL(String(input)).pathname
    chamadas.push({ path, options })
    if (path === '/usuarios/me') return Response.json({ ...usuario, perfil: 'Administrador' })
    throw Error('Não deveria criar solicitação')
  }
  await assert.rejects(criarSolicitacao(payload(), { idUsuario: 7 }), e => e.resultado === 'nao-enviado' && e.status === 403)
  assert.equal(posts().length, 0)
})
