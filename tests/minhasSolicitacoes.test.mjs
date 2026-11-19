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


const { listarMinhasSolicitacoes } = await import(await modulo('../src/services/solicitacoes.ts'))
const { validarListaSolicitacoes, classificarStatusSolicitacao } = await import(await modulo('../src/data/solicitacoesRecebidas.ts'))
const { encerrarSessao } = await import(await modulo('../src/services/autenticacao.ts'))
const storage = new Map()
globalThis.sessionStorage = { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) }
const usuario = { id: 7, nome_completo: 'Membro Teste', cpf: '00000000007', vinculo_institucional: 'M7', email: 'membro@example.test', perfil: 'Membro', ativo: true }
const jwt = exp => `a.${Buffer.from(JSON.stringify({ exp })).toString('base64url')}.c`
const guardar = (u = usuario, token = jwt(Date.now()/1000 + 900)) => {
  storage.set('labagenda.usuario', JSON.stringify(u))
  storage.set('labagenda.access_token', token)
}
const item = (id = 3, autor = 7) => ({
  id, finalidade: 'Uso acadêmico', urgencia: false, status: 'Pendente', decisao_justificativa: null,
  id_projeto: null, id_solicitante: autor, id_espaco: 2, espaco_reservado: true,
  espaco: { id: 2, nome: 'Espaço API', descricao: null, capacidade: 12, bloco: null, disponibilidade: true },
  projeto: null, solicitante: { id: autor, nome_completo: 'Membro Teste', perfil: 'Membro' },
  usuarios_envolvidos: [], ids_recursos: [],
  horarios: [{ id: 9, data_reserva: '2026-11-22', hora_inicio: '13:00:00.120000', hora_fim: '14:00:00.120000' }],
  anexos: [], interacoes: [],
})
let chamadas
let responderGet
let responderRefresh
beforeEach(() => {
  storage.clear(); guardar()
  chamadas = []
  responderGet = async () => Response.json([item()])
  responderRefresh = async () => Response.json({ access_token: jwt(Date.now()/1000 + 1800), token_type: 'bearer', usuario: JSON.parse(storage.get('labagenda.usuario')) })
  globalThis.fetch = async (input, options) => {
    const path = new URL(String(input)).pathname
    chamadas.push({ path, options })
    if (path === '/solicitacoes/') {
      assert.equal(options.method, 'GET')
      assert.equal(options.body, undefined)
      return responderGet(options)
    }
    // Única mutação possível: refresh preexistente, inteiramente simulado neste teste.
    if (path === '/usuarios/refresh') { assert.equal(options.method, 'POST'); return responderRefresh(options) }
    throw Error('Chamada inesperada no mock')
  }
})
const leituras = () => chamadas.filter(c => c.path === '/solicitacoes/')
const refreshes = () => chamadas.filter(c => c.path === '/usuarios/refresh')

test('GET autenticado retorna contrato de leitura completo sem tipo, campos de criação ou escritas', async () => {
  const resultado = await listarMinhasSolicitacoes()
  assert.deepEqual(resultado, [item()])
  assert.equal(leituras().length, 1)
  const opcoes = leituras()[0].options
  assert.equal(opcoes.headers.get('Authorization'), `Bearer ${storage.get('labagenda.access_token')}`)
  assert.ok(chamadas.every(c => c.options.method === 'GET' && c.options.body === undefined))
  assert.equal('tipo' in resultado[0], false)
  assert.equal('data_criacao' in resultado[0], false)
  assert.equal(resultado[0].espaco_reservado, true)
  assert.equal(resultado[0].status, 'Pendente')
})

test('lista vazia é resultado válido sem fallback', async () => {
  responderGet = async () => Response.json([])
  assert.deepEqual(await listarMinhasSolicitacoes(), [])
})

for (const perfil of ['Membro', 'Administrador']) {
  test(`resposta ampliada de ${perfil} apresenta apenas id_solicitante próprio`, async () => {
    guardar({ ...usuario, perfil })
    responderGet = async () => Response.json([item(2, 99), item(3, 7), item(4, 8)])
    assert.deepEqual((await listarMinhasSolicitacoes()).map(s => s.id), [3])
  })
}

test('resposta apenas de terceiros vira lista vazia', async () => {
  responderGet = async () => Response.json([item(4, 99)])
  assert.deepEqual(await listarMinhasSolicitacoes(), [])
})

test('sem identidade válida falha antes de GET ou refresh, sem apresentar lista completa', async () => {
  for (const u of [null, {}, { ...usuario, id: 0 }, { ...usuario, ativo: false }]) {
    storage.set('labagenda.usuario', JSON.stringify(u))
    await assert.rejects(listarMinhasSolicitacoes(), e => e.status === 401)
  }
  assert.equal(chamadas.length, 0)
})

test('validadores preservam relações opcionais, anexos, interações e precisão local', () => {
  const r = item()
  r.projeto = { id: 4, descricao: 'Projeto API', finalidade: 'Pesquisa' }; r.id_projeto = 4
  r.usuarios_envolvidos = [{ id: null, id_usuario: 8, nome_completo: 'Participante Teste' }]
  r.ids_recursos = [17]
  r.anexos = [{ id: 2, nome_arquivo: 'nota.txt', tipo_arquivo: 'text/plain', data_upload: '2026-11-19T10:15:00.123456-03:00' }]
  r.interacoes = [{ id: 1, tipo: 'ComplementacaoSolicitada', situacao: 'AguardandoResposta', mensagem: 'Informar finalidade', dados: { campo: 'valor' }, id_usuario: 9, data_criacao: '2026-11-19T10:00:00.120000' }]
  r.horarios.push({ id: 10, data_reserva: '2026-11-23', hora_inicio: '08:15:30.000001', hora_fim: '09:15:30.000001' })
  assert.deepEqual(validarListaSolicitacoes([r]), [r])
  assert.equal(validarListaSolicitacoes([r])[0].horarios[0].hora_inicio, '13:00:00.120000')
  assert.equal(validarListaSolicitacoes([r])[0].horarios[1].data_reserva, '2026-11-23')
  const nulo = { ...item(), id: null, espaco: null, solicitante: null, horarios: [] }
  assert.deepEqual(validarListaSolicitacoes([nulo]), [nulo])
})

test('seis status oficiais e valor desconhecido têm classificação explícita sem inventar aprovação', () => {
  for (const valor of ['Pendente', 'Aprovado', 'Rejeitado', 'Cancelada', 'AguardandoComplementacao', 'AguardandoRespostaProposta']) {
    assert.deepEqual(classificarStatusSolicitacao(valor), { tipo: 'conhecido', valor })
    assert.equal(validarListaSolicitacoes([{ ...item(), status: valor }])[0].status, valor)
  }
  assert.deepEqual(classificarStatusSolicitacao('NovoStatus'), { tipo: 'desconhecido', valor: 'NovoStatus' })
  assert.equal(validarListaSolicitacoes([{ ...item(), status: 'NovoStatus' }])[0].status, 'NovoStatus')
})

test('respostas inválidas são rejeitadas integralmente, inclusive relações e horários', () => {
  const invalidos = [null, {}, { items: [] }, [null], [item(), item()]]
  for (const valor of invalidos) assert.throws(() => validarListaSolicitacoes(valor), e => e.tipo === 'resposta')
  for (const campo of Object.keys(item())) {
    const r = item(); delete r[campo]
    assert.throws(() => validarListaSolicitacoes([r]), e => e.tipo === 'resposta', campo)
  }
  for (const alteracao of [
    { id: 0 }, { id_solicitante: '7' }, { finalidade: null }, { urgencia: 'false' }, { espaco_reservado: 1 }, { status: '' },
    { id_espaco: 99 }, { solicitante: { id: 99, nome_completo: 'Teste', perfil: 'Membro' } },
    { horarios: [{ ...item().horarios[0], data_reserva: '2026-02-30' }] },
    { horarios: [{ ...item().horarios[0], hora_inicio: '13:00:00Z' }] },
    { horarios: [{ ...item().horarios[0], hora_inicio: '13:00:00.1234567' }] },
    { horarios: [{ ...item().horarios[0], hora_inicio: '24:00:00' }] },
    { anexos: [{ id: 2, nome_arquivo: 'x', tipo_arquivo: 'x', data_upload: 'ontem' }] },
    { interacoes: [{ id: 1, tipo: 'inventado', situacao: 'Aceita' }] },
    { ids_recursos: [0] }, { usuarios_envolvidos: [{}] },
  ]) assert.throws(() => validarListaSolicitacoes([{ ...item(), ...alteracao }]), e => e.tipo === 'resposta')
})

test('serviço rejeita envelope, JSON inválido e status HTTP diferente de 200', async () => {
  for (const resposta of [Response.json({ items: [] }), new Response('{invalid'), Response.json([item()], { status: 201 }), new Response(null, { status: 204 })]) {
    responderGet = async () => resposta
    await assert.rejects(listarMinhasSolicitacoes(), e => e.tipo === 'resposta')
  }
  assert.equal(refreshes().length, 0)
})

test('401 renova sessão uma vez e repete somente GET com o token renovado', async () => {
  let numero = 0
  responderGet = async () => ++numero === 1 ? Response.json({ detail: 'Expirado' }, { status: 401 }) : Response.json([item()])
  assert.equal((await listarMinhasSolicitacoes())[0].id, 3)
  assert.deepEqual(chamadas.map(c => c.path), ['/solicitacoes/', '/usuarios/refresh', '/solicitacoes/'])
  assert.equal(refreshes().length, 1)
  assert.notEqual(leituras()[0].options.headers.get('Authorization'), leituras()[1].options.headers.get('Authorization'))
})

test('token vencido renova antes do GET e não faz segunda renovação após 401', async () => {
  guardar(usuario, jwt(1))
  responderGet = async () => Response.json({ detail: 'Expirado' }, { status: 401 })
  await assert.rejects(listarMinhasSolicitacoes(), e => e.status === 401)
  assert.equal(leituras().length, 1)
  assert.equal(refreshes().length, 1)
  assert.equal(storage.get('labagenda.access_token'), undefined)
})

test('token ausente com identidade conhecida pode recuperar sessão antes da leitura', async () => {
  storage.delete('labagenda.access_token')
  assert.equal((await listarMinhasSolicitacoes()).length, 1)
  assert.deepEqual(chamadas.map(c => c.path), ['/usuarios/refresh', '/solicitacoes/'])
})

test('401 persistente limita GET a duas tentativas e encerra somente a sessão atual', async () => {
  responderGet = async () => Response.json({ detail: 'Expirado' }, { status: 401 })
  await assert.rejects(listarMinhasSolicitacoes(), e => e.status === 401)
  assert.equal(leituras().length, 2)
  assert.equal(refreshes().length, 1)
  assert.equal(storage.get('labagenda.usuario'), undefined)
})

test('refresh recusado não repete GET nem apresenta dados', async () => {
  responderGet = async () => Response.json({ detail: 'Expirado' }, { status: 401 })
  responderRefresh = async () => Response.json({ detail: 'Cookie inválido' }, { status: 401 })
  await assert.rejects(listarMinhasSolicitacoes(), e => e.status === 401)
  assert.equal(leituras().length, 1)
  assert.equal(refreshes().length, 1)
})

for (const status of [403, 404, 422, 500]) {
  test(`HTTP ${status} de GET não renova sessão nem repete consulta`, async () => {
    responderGet = async () => Response.json({ detail: 'Falha de consulta' }, { status })
    await assert.rejects(listarMinhasSolicitacoes(), e => e.status === status)
    assert.equal(leituras().length, 1)
    assert.equal(refreshes().length, 0)
  })
}

test('falha de rede na leitura não dispara repetição nem refresh', async () => {
  responderGet = async () => { throw Error('offline') }
  await assert.rejects(listarMinhasSolicitacoes(), e => e.tipo === 'rede')
  assert.equal(leituras().length, 1)
  assert.equal(refreshes().length, 0)
})

test('falha de rede no refresh não apaga identidade e não repete GET', async () => {
  guardar(usuario, jwt(1))
  responderRefresh = async () => { throw Error('offline') }
  await assert.rejects(listarMinhasSolicitacoes(), /conectar/)
  assert.equal(leituras().length, 0)
  assert.equal(refreshes().length, 1)
  assert.ok(storage.has('labagenda.usuario'))
})

test('cancelamento antecipado não faz nenhuma chamada', async () => {
  const controle = new AbortController(); controle.abort()
  await assert.rejects(listarMinhasSolicitacoes(controle.signal), e => e.name === 'AbortError')
  assert.equal(chamadas.length, 0)
})

test('cancelamento durante GET descarta resposta mesmo se transporte ignorar abort', async () => {
  let concluir
  responderGet = async () => new Promise(resolve => { concluir = resolve })
  const controle = new AbortController()
  const leitura = listarMinhasSolicitacoes(controle.signal)
  await new Promise(resolve => setTimeout(resolve, 0))
  assert.equal(leituras()[0].options.signal, controle.signal)
  controle.abort()
  concluir(Response.json([item()]))
  await assert.rejects(leitura, e => e.name === 'AbortError')
  assert.equal(refreshes().length, 0)
})

for (const mudanca of ['logout', 'usuario', 'token', 'erro401']) {
  test(`resposta antiga após ${mudanca} não apresenta dados nem renova outra sessão`, async () => {
    let concluir
    responderGet = async () => new Promise(resolve => { concluir = resolve })
    const leitura = listarMinhasSolicitacoes()
    await new Promise(resolve => setTimeout(resolve, 0))
    if (mudanca === 'logout') encerrarSessao()
    else if (mudanca === 'usuario') guardar({ ...usuario, id: 99 }, storage.get('labagenda.access_token'))
    else guardar(usuario, jwt(Date.now()/1000 + 5000))
    concluir(mudanca === 'erro401' ? Response.json({}, { status: 401 }) : Response.json([item()]))
    await assert.rejects(leitura, e => e.status === 401)
    assert.equal(refreshes().length, 0)
    if (mudanca !== 'logout') assert.ok(storage.has('labagenda.usuario'))
  })
}

test('cancelar espera de refresh não cancela renovação compartilhada nem inicia GET', async () => {
  guardar(usuario, jwt(1))
  let concluir
  responderRefresh = async () => new Promise(resolve => { concluir = resolve })
  const controle = new AbortController()
  const leitura = listarMinhasSolicitacoes(controle.signal)
  await new Promise(resolve => setTimeout(resolve, 0))
  controle.abort()
  await assert.rejects(leitura, e => e.name === 'AbortError')
  concluir(Response.json({ access_token: jwt(Date.now()/1000 + 1800), token_type: 'bearer', usuario }))
  await new Promise(resolve => setTimeout(resolve, 0))
  assert.equal(leituras().length, 0)
  assert.equal(refreshes().length, 1)
})

test('logout durante refresh impede apresentação e restauração tardia da identidade', async () => {
  guardar(usuario, jwt(1))
  let concluir
  responderRefresh = async () => new Promise(resolve => { concluir = resolve })
  const leitura = listarMinhasSolicitacoes()
  await new Promise(resolve => setTimeout(resolve, 0))
  encerrarSessao()
  concluir(Response.json({ access_token: jwt(Date.now()/1000 + 1800), token_type: 'bearer', usuario }))
  await assert.rejects(leitura, e => e.status === 401)
  assert.equal(leituras().length, 0)
  assert.equal(storage.get('labagenda.usuario'), undefined)
})


test('troca de usuário durante refresh preserva a nova sessão e não inicia GET antigo', async () => {
  guardar(usuario, jwt(1))
  let concluir
  responderRefresh = async () => new Promise(resolve => { concluir = resolve })
  const leitura = listarMinhasSolicitacoes()
  await new Promise(resolve => setTimeout(resolve, 0))
  encerrarSessao()
  const novo = { ...usuario, id: 99 }
  guardar(novo, jwt(Date.now()/1000 + 5000))
  const novoToken = storage.get('labagenda.access_token')
  concluir(Response.json({ access_token: jwt(Date.now()/1000 + 1800), token_type: 'bearer', usuario }))
  await assert.rejects(leitura, e => e.status === 401)
  assert.equal(leituras().length, 0)
  assert.equal(JSON.parse(storage.get('labagenda.usuario')).id, 99)
  assert.equal(storage.get('labagenda.access_token'), novoToken)
})

test('consulta posterior para outro usuário não reutiliza resultados da sessão anterior', async () => {
  responderGet = async () => Response.json([item(3, 7), item(4, 99)])
  assert.deepEqual((await listarMinhasSolicitacoes()).map(s => s.id), [3])
  guardar({ ...usuario, id: 99 }, jwt(Date.now()/1000 + 5000))
  assert.deepEqual((await listarMinhasSolicitacoes()).map(s => s.id), [4])
  assert.equal(leituras().length, 2)
  assert.ok(chamadas.every(c => c.options.method === 'GET'))
})
