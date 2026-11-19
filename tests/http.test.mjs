import assert from 'node:assert/strict'
import { test, afterEach, mock } from 'node:test'
import { readFile } from 'node:fs/promises'
import { stripTypeScriptTypes } from 'node:module'

// Mesmo mecanismo usado na branch de login: executa o serviço real sem dependências.
const fonte = await readFile(new URL('../src/services/http.ts', import.meta.url), 'utf8')
async function carregar(base = 'https://api.example.test/v1/') {
  const codigo = stripTypeScriptTypes(fonte.replace('import.meta.env.VITE_API_URL', JSON.stringify(base)))
  return import(`data:text/javascript;base64,${Buffer.from(codigo).toString('base64')}`)
}
const api = await carregar()
afterEach(() => mock.restoreAll())
const resposta = (corpo, status = 200) => new Response(corpo, { status })
function simular(implementacao) { return mock.method(globalThis, 'fetch', implementacao) }

test('GET compõe URL, preserva prefixo e query, sem token ou Content-Type', async () => {
  const fetch = simular(async () => resposta('{"id":1}'))
  assert.deepEqual(await api.requisitar('/itens?limit=2'), { id: 1 })
  const [url, opcoes] = fetch.mock.calls[0].arguments
  assert.equal(url, 'https://api.example.test/v1/itens?limit=2')
  assert.equal(opcoes.method, 'GET')
  assert.equal(opcoes.headers.get('Accept'), 'application/json')
  assert.equal(opcoes.headers.has('Authorization'), false)
  assert.equal(opcoes.headers.has('Content-Type'), false)
})
test('POST serializa JSON e preserva cabeçalhos fornecidos', async () => {
  const fetch = simular(async () => resposta('{"id":2}', 201))
  assert.deepEqual(await api.requisitar('itens', {
    method: 'POST', body: { nome: 'Teste' }, headers: { 'X-Teste': 'sim' },
  }), { id: 2 })
  const opcoes = fetch.mock.calls[0].arguments[1]
  assert.equal(opcoes.method, 'POST')
  assert.deepEqual(JSON.parse(opcoes.body), { nome: 'Teste' })
  assert.equal(opcoes.headers.get('Content-Type'), 'application/json')
  assert.equal(opcoes.headers.get('X-Teste'), 'sim')
})
for (const status of [200, 204, 205]) {
  test(`resposta vazia ${status} retorna undefined`, async () => {
    simular(async () => resposta(null, status))
    assert.equal(await api.requisitar('itens'), undefined)
  })
}
for (const [corpo, mensagem] of [
  [{ detail: 'Acesso negado.' }, 'Acesso negado.'],
  [{ detail: [{ msg: 'Campo obrigatório', loc: ['body', 'nome'] }] }, 'Campo obrigatório'],
  [{ message: 'Conflito' }, 'Conflito'],
  [{ mensagem: 'Indisponível' }, 'Indisponível'],
  [{ inesperado: true }, 'A requisição falhou (HTTP 422).'],
]) {
  test(`erro estruturado preserva corpo e mensagem: ${mensagem}`, async () => {
    simular(async () => resposta(JSON.stringify(corpo), 422))
    await assert.rejects(api.requisitar('itens'), erro => {
      assert.ok(erro instanceof api.ErroHttp)
      assert.equal(erro.tipo, 'http')
      assert.equal(erro.status, 422)
      assert.equal(erro.message, mensagem)
      assert.deepEqual(erro.corpo, corpo)
      return true
    })
  })
}
for (const corpo of ['<html>Falha no proxy</html>', '', 'null', '{invalido']) {
  test(`erro HTTP com corpo inesperado: ${JSON.stringify(corpo)}`, async () => {
    simular(async () => resposta(corpo, 502))
    await assert.rejects(api.requisitar('itens'), erro => {
      assert.equal(erro.tipo, 'http')
      assert.equal(erro.status, 502)
      assert.ok(erro.message)
      assert.equal(erro.corpo, corpo === '' ? undefined : corpo === 'null' ? null : corpo)
      return true
    })
  })
}
test('falha de rede produz erro estruturado sem status', async () => {
  simular(async () => { throw new TypeError('offline') })
  await assert.rejects(api.requisitar('itens'), erro =>
    erro instanceof api.ErroHttp && erro.tipo === 'rede' && erro.status === undefined)
})
test('falha ao ler corpo preserva status conhecido', async () => {
  simular(async () => ({ status: 200, text: async () => { throw new TypeError('interrompido') } }))
  await assert.rejects(api.requisitar('itens'), erro => erro.tipo === 'rede' && erro.status === 200)
})
for (const base of [undefined, '', '   ', '/api', 'ftp://api.example.test', 'https://user:pass@api.example.test']) {
  test(`URL ausente ou inválida bloqueia fetch: ${JSON.stringify(base)}`, async () => {
    const cliente = await carregar(base === undefined ? null : base)
    const fetch = simular(async () => { throw new Error('Não deveria chamar fetch') })
    await assert.rejects(cliente.requisitar('itens'), erro => erro.tipo === 'configuracao')
    assert.equal(fetch.mock.calls.length, 0)
  })
}
test('token Bearer opcional é fornecido pelo chamador', async () => {
  const fetch = simular(async () => resposta('{}'))
  await api.requisitar('itens', { token: 'token-ficticio' })
  assert.equal(fetch.mock.calls[0].arguments[1].headers.get('Authorization'), 'Bearer token-ficticio')
})
test('cancelamento durante fetch mantém AbortError e repassa signal', async () => {
  const controle = new AbortController()
  simular((_url, { signal }) => {
    assert.equal(signal, controle.signal)
    return new Promise((_resolve, reject) => signal.addEventListener('abort', () => reject(signal.reason), { once: true }))
  })
  const pendente = api.requisitar('itens', { signal: controle.signal })
  controle.abort()
  await assert.rejects(pendente, erro => erro.name === 'AbortError')
})
test('signal já cancelado impede fetch', async () => {
  const fetch = simular(async () => resposta('{}'))
  const controle = new AbortController()
  controle.abort()
  await assert.rejects(api.requisitar('itens', { signal: controle.signal }), erro => erro.name === 'AbortError')
  assert.equal(fetch.mock.calls.length, 0)
})
test('sucesso com JSON inválido é erro de resposta', async () => {
  simular(async () => resposta('<html>proxy</html>'))
  await assert.rejects(api.requisitar('itens'), erro => erro.tipo === 'resposta' && erro.status === 200)
})
test('URLs externas não podem substituir a API configurada', async () => {
  const fetch = simular(async () => resposta('{}'))
  for (const caminho of ['https://externo.test', '//externo.test', '\\externo.test']) {
    await assert.rejects(api.requisitar(caminho), erro => erro.tipo === 'configuracao')
  }
  assert.equal(fetch.mock.calls.length, 0)
})

test('credenciais de cookie são opt-in e repassadas sem alterar os demais clientes', async () => {
  const { requisitar } = await carregar('https://api.example.test')
  const credenciais = []
  globalThis.fetch = async (_url, opcoes) => {
    credenciais.push(opcoes.credentials)
    return Response.json({ ok: true })
  }
  await requisitar('/usuarios/refresh', { method: 'POST', credentials: 'include' })
  await requisitar('/espacos')
  assert.deepEqual(credenciais, ['include', undefined])
})
