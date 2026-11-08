import assert from 'node:assert/strict'
import { test, beforeEach } from 'node:test'
import { readFile } from 'node:fs/promises'
import { stripTypeScriptTypes } from 'node:module'
import { transformWithOxc } from 'vite'
import { renderToStaticMarkup } from 'react-dom/server'
import React from 'react'

// Executa módulos reais em memória, substituindo apenas configuração Vite e fetch.
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
const servico = await import(await modulo('../src/services/espacos.ts'))
const catalogo = await import(await modulo('../src/data/catalogoEspacos.ts'))
const http = await import(await modulo('../src/services/http.ts'))
const { CartaoEspaco } = await import(await modulo('../src/components/CartaoEspaco.tsx'))
const { MemoryRouter } = await import('react-router-dom')
const storage = new Map()
globalThis.sessionStorage = {
  getItem: chave => storage.get(chave) ?? null,
  setItem: (chave, valor) => storage.set(chave, valor),
  removeItem: chave => storage.delete(chave),
}
const recurso = (alteracoes = {}) => ({ id: 1, nome: 'Impressora 3D', tipo: 'Equipamento',
  autorizacao_necessaria: true, disponibilidade: true, reserva_independente: true, id_espaco: 1, ...alteracoes })
const espaco = (id = 1, alteracoes = {}) => ({ id, nome: 'Laboratório de Fabricação', descricao: null,
  capacidade: null, bloco: null, disponibilidade: true, recursos: [], horarios_funcionamento: [],
  pausas_funcionamento: [], usuarios_vinculados: [], ...alteracoes })
const resposta = (corpo, status = 200) => new Response(JSON.stringify(corpo), { status })
beforeEach(() => {
  storage.clear()
  storage.set('labagenda.access_token', 'token-teste')
  globalThis.fetch = async () => { throw new Error('fetch não simulado') }
})

test('mapeia dados reais e preserva nulos sem inventar atributos visuais', () => {
  const original = espaco(1, { recursos: [recurso()] })
  const resultado = catalogo.adaptarEspaco(servico.validarPaginaEspacos([original])[0])
  assert.deepEqual(resultado, { id: 1, nome: original.nome, descricao: null, capacidade: null,
    bloco: null, disponivel: true, recursos: [recurso()] })
  resultado.recursos[0].nome = 'Alterado'
  assert.equal(original.recursos[0].nome, 'Impressora 3D')
  for (const campo of ['sala', 'tema', 'tiposDeUso', 'horarios']) assert.equal(campo in resultado, false)
})
test('listas opcionais usam o default vazio do schema; capacidade zero é preservada', () => {
  const entrada = espaco(1, { capacidade: 0 })
  for (const campo of ['recursos', 'horarios_funcionamento', 'pausas_funcionamento', 'usuarios_vinculados']) delete entrada[campo]
  assert.deepEqual(catalogo.adaptarEspaco(servico.validarPaginaEspacos([entrada])[0]).recursos, [])
  assert.equal(catalogo.adaptarEspaco(entrada).capacidade, 0)
})
test('valida relações tipadas sem convertê-las em disponibilidade de reserva', () => {
  assert.equal(servico.validarPaginaEspacos([espaco(1, {
    horarios_funcionamento: [{ id: 1, dia_semana: 1, hora_abertura: '08:00:00', hora_fechamento: '18:00:00', ativo: true, id_espaco: 1 }],
    pausas_funcionamento: [{ id: 1, data_inicio: '2026-11-10', data_fim: '2026-11-12', motivo: 'Manutenção', id_espaco: 1 }],
    usuarios_vinculados: [{ id_usuario: 1, nome_completo: 'Nome de teste' }],
  })]).length, 1)
})
for (const invalido of [undefined, null, {}, [null], [espaco(1, { recursos: null })],
  [espaco(1, { capacidade: '30' })], [espaco(1, { disponibilidade: 'true' })],
  [espaco(1, { recursos: [recurso({ id_espaco: 2 })] })],
  [espaco(1, { recursos: [recurso({ disponibilidade: null })] })],
  [espaco(1, { horarios_funcionamento: [{}] })]]) {
  test(`rejeita resposta inválida: ${JSON.stringify(invalido)}`, () => {
    assert.throws(() => servico.validarPaginaEspacos(invalido), erro => erro.tipo === 'resposta')
  })
}
test('busca por nome ou recurso sem acentos/caixa e combina filtros', () => {
  const dados = [catalogo.adaptarEspaco(espaco(1, { bloco: 'A', capacidade: 20, recursos: [recurso()] }))]
  const filtros = { busca: '', bloco: '', capacidade: '', recurso: '' }
  for (const busca of [' fabricacao ', 'IMPRESSORA 3D', 'laboratorio', '']) {
    assert.equal(catalogo.filtrarEspacos(dados, { ...filtros, busca }).length, 1)
  }
  assert.equal(catalogo.filtrarEspacos(dados, { ...filtros, busca: '3d', bloco: 'B' }).length, 0)
  assert.equal(catalogo.filtrarEspacos(dados, { ...filtros, capacidade: '20', recurso: 'Impressora 3D' }).length, 1)
  assert.equal(catalogo.filtrarEspacos(dados, { ...filtros, busca: 'inexistente' }).length, 0)
})
test('recurso indisponível é descobrível, identificado, sem reserva independente', () => {
  const dados = catalogo.adaptarEspaco(espaco(1, { recursos: [recurso({ disponibilidade: false })] }))
  assert.equal(catalogo.filtrarEspacos([dados], { busca: '3D', bloco: '', capacidade: '', recurso: '' }).length, 1)
  const html = renderToStaticMarkup(React.createElement(MemoryRouter, null, React.createElement(CartaoEspaco, { espaco: dados })))
  assert.match(html, /Impressora 3D.*Indisponível/)
  assert.match(html, /Requer autorização/)
  assert.match(html, /Descrição não informada/)
  assert.match(html, /href="\/laboratorios\/1"/)
  assert.doesNotMatch(html, /Reservar equipamento|próximos horários|Sala 201/i)
})
test('array vazio é sucesso, 204 não substitui array obrigatório', async () => {
  globalThis.fetch = async () => resposta([])
  assert.deepEqual(await servico.listarEspacos(), [])
  globalThis.fetch = async () => new Response(null, { status: 204 })
  await assert.rejects(servico.listarEspacos(), erro => erro.tipo === 'resposta')
})
test('falha de rede é propagada sem fixture', async () => {
  globalThis.fetch = async () => { throw new TypeError('offline') }
  await assert.rejects(servico.listarEspacos(), erro => erro instanceof http.ErroHttp && erro.tipo === 'rede')
})
for (const status of [401, 403]) test(`erro HTTP ${status} mantém classificação`, async () => {
  globalThis.fetch = async () => resposta({ detail: 'Acesso negado' }, status)
  await assert.rejects(servico.listarEspacos(), erro => erro.status === status)
})
test('sem token ou token expirado não consulta API', async () => {
  let chamadas = 0
  globalThis.fetch = async () => { chamadas++; return resposta([]) }
  storage.clear()
  await assert.rejects(servico.listarEspacos(), erro => erro.status === 401)
  storage.set('labagenda.access_token', `a.${Buffer.from(JSON.stringify({ exp: 1 })).toString('base64url')}.c`)
  await assert.rejects(servico.listarEspacos(), erro => erro.status === 401)
  assert.equal(chamadas, 0)
})
test('pagina até resposta curta, envia Bearer e inclui resultado após os primeiros 100', async () => {
  const urls = []
  globalThis.fetch = async (url, opcoes) => {
    urls.push(url)
    assert.equal(opcoes.headers.get('Authorization'), 'Bearer token-teste')
    assert.equal(opcoes.method, 'GET')
    return resposta(urls.length === 1 ? Array.from({ length: 100 }, (_, i) => espaco(i + 1)) : [espaco(101)])
  }
  const dados = await servico.listarEspacos()
  assert.equal(dados.length, 101)
  assert.deepEqual(urls, ['http://api.test/espacos/?skip=0&limit=100', 'http://api.test/espacos/?skip=100&limit=100'])
})
test('múltiplo exato de 100 exige página vazia adicional', async () => {
  let chamadas = 0
  globalThis.fetch = async () => resposta(++chamadas === 1 ? Array.from({ length: 100 }, (_, i) => espaco(i + 1)) : [])
  assert.equal((await servico.listarEspacos()).length, 100)
  assert.equal(chamadas, 2)
})
test('falha em página posterior não retorna catálogo parcial', async () => {
  let chamadas = 0
  globalThis.fetch = async () => ++chamadas === 1
    ? resposta(Array.from({ length: 100 }, (_, i) => espaco(i + 1))) : resposta({}, 500)
  await assert.rejects(servico.listarEspacos(), erro => erro.status === 500)
})
test('detecta paginação repetida, duplicatas e resposta acima de limit', async () => {
  for (const dados of [Array.from({ length: 100 }, (_, i) => espaco(i + 1)), [espaco(), espaco()], Array.from({ length: 101 }, (_, i) => espaco(i + 1))]) {
    globalThis.fetch = async () => resposta(dados)
    await assert.rejects(servico.listarEspacos(), erro => erro.tipo === 'resposta')
  }
})
test('guarda de paginação falha explicitamente sem truncar', async () => {
  let chamadas = 0
  globalThis.fetch = async () => {
    const inicio = chamadas++ * 100
    return resposta(Array.from({ length: 100 }, (_, i) => espaco(inicio + i + 1)))
  }
  await assert.rejects(servico.listarEspacos(), /limite seguro/)
  assert.equal(chamadas, 100)
})
test('cancelamento é propagado', async () => {
  const controle = new AbortController()
  controle.abort()
  await assert.rejects(servico.listarEspacos(controle.signal), erro => erro.name === 'AbortError')
})
test('grafo das telas integradas não importa fixtures nem serviços de reserva', async () => {
  const visitados = new Set()
  async function visitar(url) {
    if (visitados.has(url.href)) return
    visitados.add(url.href)
    const fonte = await readFile(url, 'utf8')
    assert.doesNotMatch(fonte, /laboratoriosFicticios|minhaAgendaDemonstrativa|horariosAgendamentoDemonstrativos|calendarioDemonstrativo/)
    for (const [, caminho] of fonte.matchAll(/from ['"]([^'"]+)['"]/g)) {
      if (!caminho.startsWith('.')) continue
      const base = new URL(caminho, url)
      let destino = new URL(base.href + '.ts')
      try { await readFile(destino) } catch { destino = new URL(base.href + '.tsx') }
      await visitar(destino)
    }
  }
  await visitar(new URL('../src/pages/CatalogoLaboratorios.tsx', import.meta.url))
  await visitar(new URL('../src/pages/DetalhesEspacoIntegrado.tsx', import.meta.url))
  const app = await readFile(new URL('../src/App.tsx', import.meta.url), 'utf8')
  assert.doesNotMatch(app, /from '.\/pages\/(DetalhesLaboratorio|SolicitacaoAgendamento|DetalhesSolicitacao)'/)
})

// Renderiza o JSX real com estados controlados do hook; não simula browser nem efeitos.
async function renderTela(caminho, estado, props = {}) {
  const url = new URL(caminho, import.meta.url)
  const fonte = (await readFile(url, 'utf8')).replace(
    /import \{ useCatalogoEspacos \} from '[^']+'/,
    `function useCatalogoEspacos() { return { estado: ${JSON.stringify(estado)}, tentarNovamente: () => {} } }`,
  )
  let codigo = (await transformWithOxc(fonte, url.pathname, { jsx: { runtime: 'automatic' } })).code
  for (const [, referencia] of [...codigo.matchAll(/from\s*['"]([^'"]+)['"]/g)]) {
    let resolvido
    if (referencia.startsWith('.')) {
      const base = new URL(referencia, url)
      let destino = base.href + '.ts'
      try { await readFile(new URL(destino)) } catch { destino = base.href + '.tsx' }
      resolvido = await modulo(destino)
    } else resolvido = import.meta.resolve(referencia)
    codigo = codigo.replaceAll(`'${referencia}'`, `'${resolvido}'`).replaceAll(`"${referencia}"`, `'${resolvido}'`)
  }
  const tela = await import(`data:text/javascript;base64,${Buffer.from(codigo).toString('base64')}`)
  const Componente = tela.CatalogoLaboratorios ?? tela.DetalhesEspacoIntegrado
  return renderToStaticMarkup(React.createElement(MemoryRouter, null, React.createElement(Componente, props)))
}
test('tela distingue carregamento, vazio e erro sem catálogo fictício', async () => {
  for (const [estado, esperado] of [
    [{ tipo: 'carregando' }, /Carregando catálogo/],
    [{ tipo: 'pronto', espacos: [] }, /Nenhum espaço retornado/],
    [{ tipo: 'erro', mensagem: 'Falha de rede de teste' }, /Falha de rede de teste/],
  ]) {
    const html = await renderTela('../src/pages/CatalogoLaboratorios.tsx', estado)
    assert.match(html, esperado)
    assert.doesNotMatch(html, /COLAB<|Sala 201|Laboratório de Informática 1/)
    if (estado.tipo === 'erro') assert.match(html, /Tentar novamente/)
  }
})
test('catálogo renderiza só dados recebidos e filtros compatíveis', async () => {
  const html = await renderTela('../src/pages/CatalogoLaboratorios.tsx', {
    tipo: 'pronto', espacos: [catalogo.adaptarEspaco(espaco(77, { nome: 'Espaço real de teste' }))],
  })
  assert.match(html, /Espaço real de teste/)
  assert.match(html, /href="\/laboratorios\/77"/)
  assert.match(html, /tipo de uso não está disponível/)
  assert.doesNotMatch(html, /COLAB<|Sala 201|select[^>]*tipoSelecionado/)
})
test('detalhe não resolve ID ausente usando fixture com o mesmo ID', async () => {
  const html = await renderTela('../src/pages/DetalhesEspacoIntegrado.tsx', { tipo: 'pronto', espacos: [] }, { id: '1' })
  assert.match(html, /não encontrado no catálogo/)
  assert.doesNotMatch(html, /COLAB<|Próximos horários livres|09:00/)
})
test('detalhe real não oferece horários ou formulário fictícios', async () => {
  const html = await renderTela('../src/pages/DetalhesEspacoIntegrado.tsx', {
    tipo: 'pronto', espacos: [catalogo.adaptarEspaco(espaco())],
  }, { id: '1' })
  assert.match(html, /ainda não estão integrados/)
  assert.doesNotMatch(html, /Próximos horários livres|09:00|Sala 201|Revisar solicitação/)
})
