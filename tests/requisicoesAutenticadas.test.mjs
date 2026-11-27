import assert from 'node:assert/strict'
import { test, beforeEach } from 'node:test'
import { readFile } from 'node:fs/promises'
import { stripTypeScriptTypes } from 'node:module'

// Executa os dois servicos reais. Todo transporte e substituido por mocks;
// nenhum teste pode usar a API ou o banco de homologacao.
const urlModulo = fonte => `data:text/javascript;base64,${Buffer.from(fonte).toString('base64')}`
const fonteHttp = (await readFile(new URL('../src/services/http.ts', import.meta.url), 'utf8'))
  .replace('import.meta.env.VITE_API_URL', JSON.stringify('http://api.test'))
const urlHttp = urlModulo(stripTypeScriptTypes(fonteHttp))
const http = await import(urlHttp)
const urlSimulador = urlModulo('export const simuladorLocalAtivo = false; export function autenticarNoSimuladorLocal() { return null }')
const fonteAuth = (await readFile(new URL('../src/services/autenticacao.ts', import.meta.url), 'utf8'))
  .replace("from './http'", `from '${urlHttp}'`)
  .replace("from './sessaoSimulada'", `from '${urlSimulador}'`)
const urlAuth = urlModulo(stripTypeScriptTypes(fonteAuth))
const auth = await import(urlAuth)
const fonteAluno = (await readFile(new URL('../src/services/agendamentoAluno.ts', import.meta.url), 'utf8'))
  .replace("from './autenticacao'", `from '${urlAuth}'`)
const aluno = await import(urlModulo(stripTypeScriptTypes(fonteAluno)))

const usuario = { id: 7, nome_completo: 'Membro de teste', cpf: '00000000007',
  vinculo_institucional: 'TESTE7', email: 'membro@example.test', perfil: 'Membro', ativo: true }
const dados = new Map()
globalThis.sessionStorage = {
  getItem: chave => dados.get(chave) ?? null,
  setItem: (chave, valor) => dados.set(chave, String(valor)),
  removeItem: chave => dados.delete(chave),
}
const resposta = (status, corpo) => new Response(corpo === undefined ? null : JSON.stringify(corpo), { status })
const sessaoNova = () => ({ access_token: 'token-renovado-teste', token_type: 'bearer', usuario })
let chamadas
let tratar
beforeEach(() => {
  auth.encerrarSessao()
  dados.clear()
  dados.set('labagenda.access_token', 'token-original-teste')
  dados.set('labagenda.usuario', JSON.stringify(usuario))
  chamadas = []
  tratar = async () => { throw Error('Transporte sem mock') }
  globalThis.fetch = async (url, opcoes) => {
    assert.equal(new URL(url).origin, 'http://api.test')
    const chamada = { caminho: new URL(url).pathname, method: opcoes.method, opcoes }
    chamadas.push(chamada)
    return tratar(chamada)
  }
})
const escritas = () => chamadas.filter(c => ['POST', 'PATCH', 'PUT', 'DELETE'].includes(c.method) && c.caminho !== '/usuarios/refresh')
const refreshes = () => chamadas.filter(c => c.caminho === '/usuarios/refresh')
const preservarSessao = () => {
  assert.equal(auth.obterTokenAcesso(), 'token-original-teste')
  assert.deepEqual(auth.obterUsuarioAutenticado(), usuario)
}

for (const method of [undefined, 'GET']) test(`leitura ${method ?? 'padrao GET'} renova uma vez e preserva retorno e autenticacao`, async () => {
  let leituras = 0
  tratar = async c => {
    if (c.caminho === '/usuarios/refresh') return resposta(200, sessaoNova())
    assert.equal(c.opcoes.credentials, 'include')
    assert.equal(c.opcoes.headers.get('Authorization'), `Bearer ${leituras === 0 ? 'token-original-teste' : 'token-renovado-teste'}`)
    return ++leituras === 1 ? resposta(401, { detail: 'Sessao vencida' }) : resposta(200, [{ id: 3 }])
  }
  assert.deepEqual(await auth.requisitarComSessao('/solicitacoes/', { method }), [{ id: 3 }])
  assert.equal(leituras, 2)
  assert.equal(refreshes().length, 1)
  assert.equal(auth.obterTokenAcesso(), 'token-renovado-teste')
})

test('GET limita repeticao e encerra sessao apos segundo 401', async () => {
  tratar = async c => c.caminho === '/usuarios/refresh' ? resposta(200, sessaoNova()) : resposta(401, { detail: 'Recusado' })
  await assert.rejects(auth.requisitarComSessao('/solicitacoes/'), e => e.status === 401)
  assert.equal(refreshes().length, 1)
  assert.equal(chamadas.filter(c => c.method === 'GET').length, 2)
  assert.equal(auth.obterTokenAcesso(), null)
})

test('GET com 401 atrasado usa token ja renovado sem outro refresh', async () => {
  let leituras = 0
  tratar = async () => {
    if (++leituras === 1) {
      dados.set('labagenda.access_token', 'token-de-outra-leitura')
      return resposta(401, { detail: 'Resposta antiga' })
    }
    return resposta(200, [])
  }
  assert.deepEqual(await auth.requisitarComSessao('/espacos/'), [])
  assert.equal(refreshes().length, 0)
  assert.equal(chamadas[1].opcoes.headers.get('Authorization'), 'Bearer token-de-outra-leitura')
})

test('HEAD permite renovacao limitada e retorno sem corpo', async () => {
  let leituras = 0
  tratar = async c => c.caminho === '/usuarios/refresh' ? resposta(200, sessaoNova())
    : ++leituras === 1 ? resposta(401) : resposta(204)
  assert.equal(await auth.requisitarComSessao('/espacos/', { method: 'HEAD' }), undefined)
  assert.equal(leituras, 2)
  assert.equal(refreshes().length, 1)
})

test('GET com falha de rede nao repete nem renova', async () => {
  tratar = async () => { throw new TypeError('Resposta perdida') }
  await assert.rejects(auth.requisitarComSessao('/espacos/'), e => e instanceof http.ErroHttp && e.tipo === 'rede')
  assert.equal(chamadas.length, 1)
  preservarSessao()
})

for (const method of ['POST', 'PATCH', 'PUT', 'DELETE']) {
  test(`${method} com 401 preserva erro e sessao sem refresh nem reenvio`, async () => {
    const detalhe = { detail: 'Sessao vencida' }
    tratar = async () => resposta(401, detalhe)
    await assert.rejects(auth.requisitarComSessao('/operacao', { method, body: { id: 3 } }), e => {
      assert.ok(e instanceof http.ErroHttp)
      assert.equal(e.tipo, 'http')
      assert.equal(e.status, 401)
      assert.deepEqual(e.corpo, detalhe)
      return true
    })
    assert.equal(escritas().length, 1)
    assert.equal(refreshes().length, 0)
    preservarSessao()
  })
  test(`${method} com resposta de rede perdida nao presume ausencia de efeito nem repete`, async () => {
    let recebidas = 0
    tratar = async () => { recebidas++; throw new TypeError('Efeito pode ter ocorrido; resposta perdida') }
    await assert.rejects(auth.requisitarComSessao('/operacao', { method }), e => e instanceof http.ErroHttp && e.tipo === 'rede')
    assert.equal(recebidas, 1)
    assert.equal(chamadas.length, 1)
    preservarSessao()
  })
  test(`${method} com sucesso preserva payload e contrato de retorno`, async () => {
    const body = { mensagem: 'Teste local' }
    tratar = async c => {
      assert.equal(c.opcoes.credentials, 'include')
      assert.equal(c.opcoes.headers.get('Authorization'), 'Bearer token-original-teste')
      assert.deepEqual(JSON.parse(c.opcoes.body), body)
      return resposta(200, { id: 3, status: 'Pendente' })
    }
    assert.deepEqual(await auth.requisitarComSessao('/operacao', { method, body }), { id: 3, status: 'Pendente' })
    assert.equal(chamadas.length, 1)
    preservarSessao()
  })
}

for (const status of [403, 409, 422, 500]) test(`PATCH HTTP ${status} preserva classificacao sem repetir`, async () => {
  tratar = async () => resposta(status, { detail: 'Falha confirmada por HTTP' })
  await assert.rejects(auth.requisitarComSessao('/operacao', { method: 'PATCH' }), e => e instanceof http.ErroHttp && e.status === status)
  assert.equal(chamadas.length, 1)
  preservarSessao()
})

test('escrita com resposta invalida nao repete', async () => {
  tratar = async () => new Response('resposta interrompida', { status: 201 })
  await assert.rejects(auth.requisitarComSessao('/operacao', { method: 'POST', statusEsperado: 201 }), e => e.tipo === 'resposta' && e.status === 201)
  assert.equal(chamadas.length, 1)
  preservarSessao()
})

test('DELETE HTTP 204 preserva retorno undefined sem exigir JSON', async () => {
  tratar = async () => resposta(204)
  assert.equal(await auth.requisitarComSessao('/operacao', { method: 'DELETE' }), undefined)
  assert.equal(chamadas.length, 1)
})

test('timeout simulado apos transmissao preserva erro e nao reenvia', async () => {
  const controle = new AbortController()
  const erro = new DOMException('Resposta inconclusiva', 'TimeoutError')
  tratar = async () => { controle.abort(erro); throw erro }
  await assert.rejects(auth.requisitarComSessao('/operacao', { method: 'POST', signal: controle.signal }), e => e === erro)
  assert.equal(chamadas.length, 1)
  preservarSessao()
})

test('escrita com token atualizado durante 401 nao e repetida', async () => {
  tratar = async () => { dados.set('labagenda.access_token', 'sessao-atualizada'); return resposta(401) }
  await assert.rejects(auth.requisitarComSessao('/operacao', { method: 'POST' }), e => e.status === 401)
  assert.equal(chamadas.length, 1)
  assert.equal(auth.obterTokenAcesso(), 'sessao-atualizada')
})

test('troca de usuario apos escrita impede aceitar resposta da conta anterior', async () => {
  tratar = async () => { dados.set('labagenda.usuario', JSON.stringify({ ...usuario, id: 8 })); return resposta(200, { id: 3 }) }
  await assert.rejects(auth.requisitarComSessao('/operacao', { method: 'POST' }), e => e instanceof auth.ErroAutenticacao)
  assert.equal(chamadas.length, 1)
  assert.equal(auth.obterUsuarioAutenticado().id, 8)
})

test('escrita cancelada antes de transmitir nao chega ao transporte', async () => {
  const controle = new AbortController()
  controle.abort()
  await assert.rejects(auth.requisitarComSessao('/operacao', { method: 'PUT', signal: controle.signal }), e => e.name === 'AbortError')
  assert.equal(chamadas.length, 0)
  preservarSessao()
})

for (const proposta of [undefined, { id: 11, aceita: true }]) test(`resposta do aluno ${proposta ? 'a proposta' : 'a complementacao'} nao repete POST 401`, async () => {
  tratar = async c => {
    assert.equal(c.caminho, proposta ? '/solicitacoes/3/propostas-replanejamento/11/resposta' : '/solicitacoes/3/complementacao/resposta')
    assert.deepEqual(JSON.parse(c.opcoes.body), proposta ? { mensagem: 'Resposta local', aceita: true } : { mensagem: 'Resposta local' })
    return resposta(401)
  }
  await assert.rejects(aluno.responderSolicitacao(3, 'Resposta local', proposta), e => e.status === 401)
  assert.equal(chamadas.length, 1)
  preservarSessao()
})

test('resposta do aluno com perda de rede nao dispara segundo POST', async () => {
  tratar = async () => { throw new TypeError('Resposta perdida') }
  await assert.rejects(aluno.responderSolicitacao(3, 'Resposta local'), e => e.tipo === 'rede')
  assert.equal(escritas().length, 1)
  assert.equal(refreshes().length, 0)
})

test('criacao alternativa herda POST unico sem alterar payload ou endpoints', async () => {
  const inicio = '2090-01-07T13:00:00.123456', fim = '2090-01-07T14:00:00.123456'
  tratar = async c => c.method === 'GET' ? resposta(200, [{ data_hora_inicio: inicio, data_hora_fim: fim }]) : resposta(401)
  await assert.rejects(aluno.solicitar(77, ' Uso academico ', inicio, fim), e => e.status === 401)
  assert.equal(chamadas.length, 2)
  assert.equal(escritas().length, 1)
  assert.equal(refreshes().length, 0)
  assert.deepEqual(JSON.parse(escritas()[0].opcoes.body), { id_espaco: 77, finalidade: 'Uso academico',
    horarios: [{ data_reserva: '2090-01-07', hora_inicio: '13:00:00.123456', hora_fim: '14:00:00.123456' }] })
})
