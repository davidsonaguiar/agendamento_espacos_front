import assert from 'node:assert/strict'
import { test, beforeEach } from 'node:test'
import { readFile, access } from 'node:fs/promises'
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
    let resolvido
    if (referencia.startsWith('.')) {
      const destino = new URL(referencia, url)
      if (!/\.tsx?$/.test(destino.pathname)) {
        const ts = new URL(referencia + '.ts', url)
        let arquivo = ts
        try { await access(ts) } catch (erro) {
          if (erro.code !== 'ENOENT') throw erro
          arquivo = new URL(referencia + '.tsx', url)
        }
        resolvido = await modulo(arquivo.href)
      } else resolvido = await modulo(destino.href)
    } else resolvido = import.meta.resolve(referencia)
    codigo = codigo.replaceAll(`'${referencia}'`, `'${resolvido}'`).replaceAll(`"${referencia}"`, `'${resolvido}'`)
  }
  const resultado = `data:text/javascript;base64,${Buffer.from(codigo).toString('base64')}`
  cache.set(url.href, resultado)
  return resultado
}
const servico = await import(await modulo('../src/services/espacos.ts'))
const catalogo = await import(await modulo('../src/data/catalogoEspacos.ts'))
const http = await import(await modulo('../src/services/http.ts'))
const auth = await import(await modulo('../src/services/autenticacao.ts'))
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
    bloco: null, disponivel: true, recursos: [recurso()], horariosFuncionamento: [] })
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
      let destino = base
      if (!/\.(?:tsx?|css)$/.test(base.pathname)) {
        destino = new URL(base.href + '.ts')
        try { await access(destino) } catch (erro) {
          if (erro.code !== 'ENOENT') throw erro
          destino = new URL(base.href + '.tsx')
        }
      }
      await visitar(destino)
    }
  }
  await visitar(new URL('../src/pages/CatalogoLaboratorios.tsx', import.meta.url))
  await visitar(new URL('../src/pages/DetalhesEspacoIntegrado.tsx', import.meta.url))
  await visitar(new URL('../src/pages/SolicitacaoAgendamento.tsx', import.meta.url))
  await visitar(new URL('../src/pages/DetalhesSolicitacao.tsx', import.meta.url))
  const app = await readFile(new URL('../src/App.tsx', import.meta.url), 'utf8')
  assert.doesNotMatch(app, /from '.\/pages\/DetalhesLaboratorio'/)
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
  assert.match(html, /solicitação para análise/)
  assert.doesNotMatch(html, /Próximos horários livres|09:00|Sala 201|Revisar solicitação/)
})

const usuarioB3 = { id: 1, nome_completo: 'Membro', cpf: '00000000001', vinculo_institucional: 'MAT1', email: 'membro@example.com', perfil: 'Membro', ativo: true }
const tokenB3 = exp => `a.${Buffer.from(JSON.stringify({ exp })).toString('base64url')}.c`
const renovadaB3 = () => ({ access_token: tokenB3(Date.now() / 1000 + 3600), token_type: 'bearer', usuario: usuarioB3 })
const turnoB3 = () => new Promise(resolve => setImmediate(resolve))

test('token expirado ou ausente recupera cookie antes de consultar espaços', async () => {
  for (const token of [null, tokenB3(1)]) {
    storage.clear()
    if (token) storage.set('labagenda.access_token', token)
    const chamadas = []
    const nova = renovadaB3()
    globalThis.fetch = async (url, opcoes) => {
      chamadas.push(new URL(url).pathname)
      if (url.endsWith('/refresh')) {
        assert.equal(opcoes.credentials, 'include')
        return resposta(nova)
      }
      assert.equal(opcoes.headers.get('Authorization'), `Bearer ${nova.access_token}`)
      return resposta([espaco()])
    }
    assert.equal((await servico.listarEspacos()).length, 1)
    assert.deepEqual(chamadas, ['/usuarios/refresh', '/espacos/'])
  }
})
test('401 persistente repete a página uma vez e não gira refresh indefinidamente', async () => {
  let paginas = 0, refresh = 0
  globalThis.fetch = async url => {
    if (url.endsWith('/refresh')) { refresh++; return resposta(renovadaB3()) }
    paginas++; return resposta({}, 401)
  }
  await assert.rejects(servico.listarEspacos(), erro => erro.status === 401)
  assert.equal(paginas, 2)
  assert.equal(refresh, 1)
})
test('refresh preventivo já realizado não é repetido após 401 da primeira página', async () => {
  storage.set('labagenda.access_token', tokenB3(1))
  let refresh = 0, paginas = 0
  globalThis.fetch = async url => {
    if (url.endsWith('/refresh')) { refresh++; return resposta(renovadaB3()) }
    paginas++; return resposta({}, 401)
  }
  await assert.rejects(servico.listarEspacos(), erro => erro.status === 401)
  assert.equal(refresh, 1)
  assert.equal(paginas, 1)
})
test('refresh recusado não repete página; falha de rede preserva sessão', async () => {
  for (const falha of ['recusado', 'rede', 'invalido']) {
    storage.set('labagenda.access_token', 'token-teste')
    let paginas = 0
    globalThis.fetch = async url => {
      if (url.endsWith('/refresh')) {
        if (falha === 'rede') throw new TypeError('offline')
        return resposta({}, falha === 'recusado' ? 401 : 200)
      }
      paginas++; return resposta({}, 401)
    }
    await assert.rejects(servico.listarEspacos(), erro => falha === 'recusado' ? erro.status === 401 : erro.status === undefined)
    assert.equal(paginas, 1)
    assert.equal(auth.obterTokenAcesso(), falha === 'recusado' ? null : 'token-teste')
  }
})
test('expiração em página posterior repete apenas skip=100 com o token renovado', async () => {
  const chamadas = []
  let segunda = 0
  const nova = renovadaB3()
  globalThis.fetch = async (url, opcoes) => {
    chamadas.push(new URL(url).pathname + new URL(url).search)
    if (url.endsWith('/refresh')) return resposta(nova)
    if (url.includes('skip=0&')) return resposta(Array.from({ length: 100 }, (_, i) => espaco(i + 1)))
    if (++segunda === 1) return resposta({}, 401)
    assert.equal(opcoes.headers.get('Authorization'), `Bearer ${nova.access_token}`)
    return resposta([espaco(101)])
  }
  assert.equal((await servico.listarEspacos()).length, 101)
  assert.deepEqual(chamadas, ['/espacos/?skip=0&limit=100', '/espacos/?skip=100&limit=100', '/usuarios/refresh', '/espacos/?skip=100&limit=100'])
})
test('duas cargas concorrentes compartilham o refresh da B2', async () => {
  let liberar, refresh = 0, paginas = 0
  globalThis.fetch = async url => {
    if (url.endsWith('/refresh')) {
      refresh++
      return new Promise(resolve => { liberar = () => resolve(resposta(renovadaB3())) })
    }
    return ++paginas <= 2 ? resposta({}, 401) : resposta([])
  }
  const a = servico.listarEspacos(), b = servico.listarEspacos()
  await turnoB3()
  assert.equal(refresh, 1)
  liberar()
  assert.deepEqual(await Promise.all([a, b]), [[], []])
  assert.equal(paginas, 4)
})
test('cancelamento durante refresh rejeita imediatamente e não repete página', async () => {
  let liberar, paginas = 0
  globalThis.fetch = async url => {
    if (url.endsWith('/refresh')) return new Promise(resolve => { liberar = () => resolve(resposta(renovadaB3())) })
    paginas++; return resposta({}, 401)
  }
  const controle = new AbortController()
  const pendente = servico.listarEspacos(controle.signal)
  const rejeicao = assert.rejects(pendente, erro => erro.name === 'AbortError')
  await turnoB3()
  controle.abort()
  await rejeicao
  liberar()
  await turnoB3()
  assert.equal(paginas, 1)
})
test('cancelar um consumidor não cancela outro que aguarda o mesmo refresh', async () => {
  let liberar
  globalThis.fetch = async url => url.endsWith('/refresh')
    ? new Promise(resolve => { liberar = () => resolve(resposta(renovadaB3())) })
    : auth.tokenExpirou() ? resposta({}, 401) : resposta([])
  storage.set('labagenda.access_token', tokenB3(1))
  const controle = new AbortController()
  const a = servico.listarEspacos(controle.signal), b = servico.listarEspacos()
  const rejeicao = assert.rejects(a, erro => erro.name === 'AbortError')
  await turnoB3()
  controle.abort()
  await rejeicao
  liberar()
  assert.deepEqual(await b, [])
})
test('logout durante resposta 200 impede publicação e não inicia refresh', async () => {
  let liberar, refresh = 0
  globalThis.fetch = async url => {
    if (url.endsWith('/logout')) return new Response(null, { status: 204 })
    if (url.endsWith('/refresh')) { refresh++; return resposta(renovadaB3()) }
    return new Promise(resolve => { liberar = () => resolve(resposta([espaco()])) })
  }
  const carga = servico.listarEspacos()
  const rejeicao = assert.rejects(carga, erro => erro.status === 401)
  await auth.desconectarUsuario()
  liberar()
  await rejeicao
  assert.equal(refresh, 0)
  assert.equal(auth.obterTokenAcesso(), null)
})
test('logout durante refresh impede retry e não restaura sessão', async () => {
  let liberar, paginas = 0
  globalThis.fetch = async url => {
    if (url.endsWith('/logout')) return new Response(null, { status: 204 })
    if (url.endsWith('/refresh')) return new Promise(resolve => { liberar = () => resolve(resposta(renovadaB3())) })
    paginas++; return resposta({}, 401)
  }
  const carga = servico.listarEspacos()
  const rejeicao = assert.rejects(carga, erro => erro.status === 401)
  await turnoB3()
  const logout = auth.desconectarUsuario()
  liberar()
  await Promise.all([rejeicao, logout])
  assert.equal(paginas, 1)
  assert.equal(auth.obterTokenAcesso(), null)
})
test('troca externa de token descarta resposta antiga sem apagar sessão nova', async () => {
  let liberar
  globalThis.fetch = async () => new Promise(resolve => { liberar = () => resolve(resposta([espaco()])) })
  const carga = servico.listarEspacos()
  storage.set('labagenda.access_token', 'nova-sessao')
  liberar()
  await assert.rejects(carga, /sessão mudou/)
  assert.equal(auth.obterTokenAcesso(), 'nova-sessao')
})

// Executor isolado do ciclo useState/useEffect: sem DOM, navegador ou pacotes novos.
// Exercita o código real com fronteiras de autenticação/transporte controladas.
let executorIdB3 = 0
async function executarHooksB3(caminho, nome, modulos) {
  const chave = `__labagendaHooksB3_${++executorIdB3}`
  const estados = [], efeitos = [], timers = new Map()
  let indiceEstado = 0, indiceEfeito = 0, montado = true, agendado = false, renderizar
  const ambiente = { modulos, window: new EventTarget() }
  ambiente.setTimeout = (callback, atraso) => { const id = {}; timers.set(id, { callback, atraso }); return id }
  ambiente.clearTimeout = id => timers.delete(id)
  ambiente.modulos.react = {
    useState(inicial) {
      const indice = indiceEstado++
      if (!(indice in estados)) estados[indice] = inicial
      return [estados[indice], valor => {
        if (!montado) throw Error('Atualização após desmontagem')
        const proximo = typeof valor === 'function' ? valor(estados[indice]) : valor
        if (Object.is(estados[indice], proximo)) return
        estados[indice] = proximo
        if (!agendado) {
          agendado = true
          queueMicrotask(() => { agendado = false; if (montado) renderizar() })
        }
      }]
    },
    useEffect(callback, deps) {
      const indice = indiceEfeito++
      const anterior = efeitos[indice]
      if (!anterior || deps.some((valor, i) => !Object.is(valor, anterior.deps[i]))) {
        anterior?.limpar?.()
        efeitos[indice] = { deps, callback, pendente: true }
      }
    },
  }
  globalThis[chave] = ambiente
  const fonte = await readFile(new URL(caminho, import.meta.url), 'utf8')
  let codigo = (await transformWithOxc(fonte, caminho, { jsx: { runtime: 'automatic' } })).code
  codigo = codigo.replace(/from\s*["']([^"']+)["']/g, (_trecho, referencia) => {
    const mock = ambiente.modulos[referencia]
    if (!mock) return `from '${import.meta.resolve(referencia)}'`
    const exports = Object.keys(mock).map(nome => `export const ${nome} = globalThis['${chave}'].modulos[${JSON.stringify(referencia)}].${nome}`).join('\n')
    return `from 'data:text/javascript;base64,${Buffer.from(exports).toString('base64')}'`
  })
  codigo = `const window = globalThis['${chave}'].window; const setTimeout = globalThis['${chave}'].setTimeout; const clearTimeout = globalThis['${chave}'].clearTimeout;\n` + codigo
  const componente = (await import(`data:text/javascript;base64,${Buffer.from(codigo).toString('base64')}`))[nome]
  const controle = {
    atual: null, timers, eventos: ambiente.window,
    render() { renderizar() },
    desmontar() { montado = false; efeitos.forEach(efeito => efeito.limpar?.()); delete globalThis[chave] },
    async flush() { await new Promise(resolve => setImmediate(resolve)) },
  }
  renderizar = () => {
    indiceEstado = 0; indiceEfeito = 0
    controle.atual = componente()
    efeitos.forEach(efeito => {
      if (efeito.pendente) { efeito.pendente = false; efeito.limpar = efeito.callback() }
    })
  }
  renderizar()
  return controle
}

async function montarCatalogoB3(t, listar, search = '') {
  const navegacoes = []
  const navegar = (destino, opcoes) => navegacoes.push({ destino, opcoes })
  const location = { pathname: '/', search }
  const hook = await executarHooksB3('../src/hooks/useCatalogoEspacos.ts', 'useCatalogoEspacos', {
    'react-router-dom': { useNavigate: () => navegar, useLocation: () => location },
    '../data/catalogoEspacos': catalogo,
    '../services/espacos': { listarEspacos: listar },
    '../services/autenticacao': auth,
    '../services/http': http,
  })
  t.after(() => hook.desmontar())
  return { hook, location, navegacoes }
}
test('hook descarta resposta antiga após mudança de query/filtros', async t => {
  const pendentes = []
  const { hook, location } = await montarCatalogoB3(t, signal => new Promise(resolve => pendentes.push({ signal, resolve })))
  location.search = '?busca=novo'
  hook.render()
  assert.equal(pendentes[0].signal.aborted, true)
  pendentes[1].resolve([espaco(2, { nome: 'Novo' })])
  await hook.flush()
  assert.equal(hook.atual.estado.espacos[0].id, 2)
  pendentes[0].resolve([espaco(1, { nome: 'Antigo' })])
  await hook.flush()
  assert.equal(hook.atual.estado.espacos[0].id, 2)
})
test('hook mantém filtros locais sobre o resultado atual e ignora erro de carga antiga', async t => {
  const pendentes = []
  const { hook } = await montarCatalogoB3(t, signal => new Promise((resolve, reject) => pendentes.push({ signal, resolve, reject })))
  hook.atual.tentarNovamente()
  await hook.flush()
  pendentes[1].resolve([espaco(2, { recursos: [recurso({ id_espaco: 2 })] })])
  await hook.flush()
  assert.equal(catalogo.filtrarEspacos(hook.atual.estado.espacos, { busca: '3D', bloco: '', capacidade: '', recurso: '' }).length, 1)
  pendentes[0].reject(new http.ErroHttp('http', 'antigo', 401))
  await hook.flush()
  assert.equal(hook.atual.estado.tipo, 'pronto')
})
test('hook falha de rede permite retry sem redirecionar ou limpar sessão', async t => {
  let chamadas = 0
  const { hook, navegacoes } = await montarCatalogoB3(t, async () => {
    if (++chamadas === 1) throw new http.ErroHttp('rede', 'Offline')
    return []
  })
  await hook.flush()
  assert.equal(hook.atual.estado.tipo, 'erro')
  assert.equal(navegacoes.length, 0)
  assert.equal(auth.obterTokenAcesso(), 'token-teste')
  hook.atual.tentarNovamente()
  await hook.flush()
  assert.equal(hook.atual.estado.tipo, 'pronto')
})
test('hook só redireciona 401 definitivo e preserva destino com query', async t => {
  const { hook, navegacoes } = await montarCatalogoB3(t, async () => { storage.delete('labagenda.access_token'); throw new http.ErroHttp('http', 'inválida', 401) }, '?bloco=A')
  await hook.flush()
  assert.equal(navegacoes.length, 1)
  assert.equal(navegacoes[0].opcoes.state.destino, '/?bloco=A')
})
test('hook não publica dados após logout ou desmontagem', async t => {
  let liberar
  const { hook, navegacoes } = await montarCatalogoB3(t, () => new Promise(resolve => { liberar = resolve }))
  storage.delete('labagenda.access_token')
  liberar([espaco()])
  await hook.flush()
  assert.notEqual(hook.atual.estado.tipo, 'pronto')
  assert.equal(navegacoes.length, 1)
  // Nova instância: resposta que ignora abort também não atualiza hook desmontado.
  storage.set('labagenda.access_token', 'nova')
  let liberarAntigo
  const outro = await montarCatalogoB3(t, () => new Promise(resolve => { liberarAntigo = resolve }))
  outro.hook.desmontar()
  liberarAntigo([espaco()])
  await outro.hook.flush()
  assert.equal(outro.hook.atual.estado.tipo, 'carregando')
})

test('hook não redireciona sessão nova por 401 atrasado da sessão anterior', async t => {
  const { hook, navegacoes } = await montarCatalogoB3(t, async () => {
    storage.set('labagenda.access_token', 'sessao-nova')
    throw new http.ErroHttp('http', 'antiga', 401)
  })
  await hook.flush()
  assert.equal(navegacoes.length, 0)
  assert.equal(hook.atual.estado.tipo, 'erro')
  assert.equal(auth.obterTokenAcesso(), 'sessao-nova')
})


test('adaptador preserva horários reais e copia os registros sem alterar a resposta', () => {
  const horario = { id: 9, dia_semana: 0, hora_abertura: '08:00:00', hora_fechamento: '12:30:00', ativo: true, id_espaco: 1 }
  const original = espaco(1, { horarios_funcionamento: [horario] })
  const resultado = catalogo.adaptarEspaco(servico.validarPaginaEspacos([original])[0])
  assert.deepEqual(resultado.horariosFuncionamento, [horario])
  resultado.horariosFuncionamento[0].hora_abertura = '09:00:00'
  assert.equal(original.horarios_funcionamento[0].hora_abertura, '08:00:00')
  delete original.horarios_funcionamento
  assert.deepEqual(catalogo.adaptarEspaco(original).horariosFuncionamento, [])
})

// Ausencia de identidade pode tentar recuperar cookie, mas nunca publicar catalogo sem sessao.
test('sem identidade e com refresh recusado nao consulta catalogo', async () => {
  const caminhos = []
  storage.clear()
  globalThis.fetch = async url => {
    caminhos.push(new URL(url).pathname)
    return resposta({ detail: 'Sessao invalida' }, 401)
  }
  await assert.rejects(servico.listarEspacos(), erro => erro.status === 401)
  assert.deepEqual(caminhos, ['/usuarios/refresh'])
})
