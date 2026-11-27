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


const { ordenarSolicitacoes, ordenarHorarios, formatarHoraSolicitacao, formatarDuracaoSolicitacao, resolverPeriodoSolicitacao, selecionarSolicitacoes } = await import(await modulo('../src/data/apresentacaoSolicitacoes.ts'))
const horario = (data, inicio, fim = '18:00:00', id = null) => ({ id, data_reserva: data, hora_inicio: inicio, hora_fim: fim })
const solic = (id, horarios, finalidade = 'Uso acadêmico') => ({ id, horarios, finalidade, id_espaco: 2, status: 'Pendente' })

test('ordenação cronológica considera intervalos fora de ordem e não modifica a coleção', () => {
  const lista = [solic(4, [horario('2026-11-23', '08:00:00'), horario('2026-11-22', '13:00:00')]), solic(3, [horario('2026-11-22', '13:00:00')]), solic(5, [])]
  const copia = structuredClone(lista)
  assert.deepEqual(ordenarSolicitacoes(lista).map(s => s.id), [3, 4, 5])
  assert.deepEqual(lista, copia)
  assert.equal(ordenarSolicitacoes(lista)[1].horarios[0].data_reserva, '2026-11-22')
})

test('ordenação compara microssegundos numericamen­te e desempata registros sem ID', () => {
  const lista = [solic(null, [horario('2026-11-22', '13:00:00.1')], 'B'), solic(null, [horario('2026-11-22', '13:00:00.100000')], 'A'), solic(3, [horario('2026-11-22', '13:00:00.000001')])]
  assert.deepEqual(ordenarSolicitacoes(lista).map(s => s.finalidade), ['Uso acadêmico', 'A', 'B'])
  assert.deepEqual(ordenarSolicitacoes([...lista].reverse()).map(s => s.finalidade), ['Uso acadêmico', 'A', 'B'])
})

test('duração usa inteiros em microssegundos sem arredondamento ou UTC', () => {
  assert.equal(formatarDuracaoSolicitacao('13:00:00.000001', '14:00:00.000002'), '1 h 0,000001 s')
  assert.equal(formatarDuracaoSolicitacao('08:00:00.999999', '08:00:01.000000'), '0,000001 s')
  assert.equal(formatarDuracaoSolicitacao('08:15:30.123456', '10:16:31.243456'), '2 h 1 min 1,12 s')
  assert.equal(formatarDuracaoSolicitacao('08:00:00', '09:00:00'), '1 h')
  assert.equal(formatarDuracaoSolicitacao('09:00:00', '08:00:00'), null)
  assert.equal(formatarDuracaoSolicitacao('inválida', '09:00:00'), null)
})

test('hora exibida preserva segundos e frações significativas', () => {
  assert.equal(formatarHoraSolicitacao('13:00:00.000000'), '13:00')
  assert.equal(formatarHoraSolicitacao('13:00:00.120000'), '13:00:00.120000')
  assert.equal(formatarHoraSolicitacao('13:00:30'), '13:00:30')
  assert.equal(formatarHoraSolicitacao('13:00:00.000001'), '13:00:00.000001')
})

test('tela, cartão e hook não importam fixtures ou modelos demonstrativos', async () => {
  for (const nome of ['../src/pages/MeusAgendamentos.tsx', '../src/components/CartaoSolicitacao.tsx', '../src/hooks/useMinhasSolicitacoes.ts', '../src/data/apresentacaoSolicitacoes.ts']) {
    const fonte = await readFile(new URL(nome, import.meta.url), 'utf8')
    assert.doesNotMatch(fonte, /minhaAgendaDemonstrativa|laboratoriosFicticios|selecaoAgendamento|types\/solicitacao['"]|tipo:\s*['"]Espaço/)
  }
})


const selecionar = (lista, tipo, hoje, opcoes = {}) => selecionarSolicitacoes(lista, { tipo, inicio: opcoes.inicio, fim: opcoes.fim }, opcoes.status ?? 'Todos', opcoes.ordem ?? 'crescente', hoje)
const noDia = (id, data, inicio = '13:00:00') => solic(id, [horario(data, inicio)])

test('próximos 7 dias inclui hoje e sexto dia, excluindo anterior e sétimo', () => {
  const lista = [noDia(1, '2026-11-18'), noDia(2, '2026-11-19'), noDia(3, '2026-11-25'), noDia(4, '2026-11-26')]
  assert.deepEqual(selecionar(lista, '7dias', '2026-11-19').solicitacoes.map(s => s.id), [2, 3])
})

test('próximos 30 dias atravessa ano com 30 datas inclusivas', () => {
  const periodo = resolverPeriodoSolicitacao({ tipo: '30dias' }, '2026-12-20')
  assert.deepEqual(periodo, { valido: true, inicio: '2026-12-20', fim: '2027-01-18' })
  assert.deepEqual(selecionar([noDia(1, '2027-01-18'), noDia(2, '2027-01-19')], '30dias', '2026-12-20').solicitacoes.map(s => s.id), [1])
})

test('virada de mês, ano e fevereiro bissexto usa calendário local', () => {
  assert.equal(resolverPeriodoSolicitacao({ tipo: '7dias' }, '2026-11-28').fim, '2026-12-04')
  assert.equal(resolverPeriodoSolicitacao({ tipo: '7dias' }, '2026-12-29').fim, '2027-01-04')
  assert.equal(resolverPeriodoSolicitacao({ tipo: '7dias' }, '2028-02-27').fim, '2028-03-04')
  assert.equal(resolverPeriodoSolicitacao({ tipo: '30dias' }, '2028-02-01').fim, '2028-03-01')
  assert.equal(resolverPeriodoSolicitacao({ tipo: '7dias' }, '2027-02-27').fim, '2027-03-05')
})

test('passados usa somente a data e não inclui horários encerrados hoje', () => {
  const lista = [noDia(1, '2026-11-18'), noDia(2, '2026-11-19', '00:00:00')]
  assert.deepEqual(selecionar(lista, 'passados', '2026-11-19').solicitacoes.map(s => s.id), [1])
  assert.deepEqual(selecionar(lista, 'passados', '2026-11-20').solicitacoes.map(s => s.id), [1, 2])
})

test('todos inclui solicitações sem horários, sempre ao final nas duas direções', () => {
  const lista = [solic(0, []), noDia(1, '2026-11-20'), noDia(2, '2026-11-21')]
  assert.deepEqual(selecionar(lista, 'todos', '2026-11-19').solicitacoes.map(s => s.id), [1, 2, 0])
  assert.deepEqual(selecionar(lista, 'todos', '2026-11-19', { ordem: 'decrescente' }).solicitacoes.map(s => s.id), [2, 1, 0])
  assert.equal(selecionar(lista, '7dias', '2026-11-19').solicitacoes.length, 2)
})

test('solicitação com datas mistas corresponde a qualquer intervalo, mantendo todos visíveis', () => {
  const lista = [solic(3, [horario('2026-10-01', '08:00:00'), horario('2026-11-22', '13:00:00')])]
  assert.equal(selecionar(lista, 'passados', '2026-11-19').solicitacoes.length, 1)
  const resultado = selecionar(lista, '7dias', '2026-11-19')
  assert.equal(resultado.solicitacoes.length, 1)
  assert.equal(resultado.solicitacoes[0].horarios.length, 2)
})

test('status e período são combinados por E, incluindo desconhecidos em Todos', () => {
  const lista = [{ ...noDia(1, '2026-11-22'), status: 'Rejeitado' }, noDia(2, '2026-11-22'), noDia(3, '2027-01-01'), { ...noDia(4, '2026-11-22'), status: 'EstadoNovo' }]
  assert.deepEqual(selecionar(lista, '7dias', '2026-11-19', { status: 'Pendente' }).solicitacoes.map(s => s.id), [2])
  assert.deepEqual(selecionar(lista, '7dias', '2026-11-19').solicitacoes.map(s => s.id), [1, 2, 4])
})

test('personalizado inclui limites e permite apenas um dia', () => {
  const lista = [noDia(1, '2026-11-21'), noDia(2, '2026-11-22'), noDia(3, '2026-11-23'), noDia(4, '2026-11-24')]
  assert.deepEqual(selecionar(lista, 'personalizado', '2026-11-19', { inicio: '2026-11-22', fim: '2026-11-23' }).solicitacoes.map(s => s.id), [2, 3])
  assert.deepEqual(selecionar(lista, 'personalizado', '2026-11-19', { inicio: '2026-11-22', fim: '2026-11-22' }).solicitacoes.map(s => s.id), [2])
})

test('períodos ausentes, inválidos e invertidos não retornam dados parciais', () => {
  for (const opcoes of [{}, { inicio: '2026-11-22' }, { inicio: '2026-02-30', fim: '2026-11-22' }, { inicio: '2026-11-23', fim: '2026-11-22' }, { inicio: '2026-11-22Z', fim: '2026-11-23' }]) {
    const resultado = selecionar([noDia(1, '2026-11-22')], 'personalizado', '2026-11-19', opcoes)
    assert.ok(resultado.erro)
    assert.deepEqual(resultado.solicitacoes, [])
  }
  assert.equal(resolverPeriodoSolicitacao({ tipo: 'personalizado', inicio: '2028-02-29', fim: '2028-02-29' }, '2026-11-19').valido, true)
})

test('ordenação usa primeiro intervalo correspondente ao período e preserva a lista original', () => {
  const lista = [solic(1, [horario('2026-01-01', '08:00:00'), horario('2026-11-23', '10:00:00')]), noDia(2, '2026-11-22'), noDia(3, '2026-11-22')]
  const copia = structuredClone(lista)
  assert.deepEqual(selecionar(lista, '7dias', '2026-11-19').solicitacoes.map(s => s.id), [2, 3, 1])
  assert.deepEqual(selecionar(lista, '7dias', '2026-11-19', { ordem: 'decrescente' }).solicitacoes.map(s => s.id), [1, 2, 3])
  assert.deepEqual(selecionar(lista, 'todos', '2026-11-19').solicitacoes.map(s => s.id), [1, 2, 3])
  assert.deepEqual(lista, copia)
})

test('desempate temporal respeita microssegundos e ID nas duas direções', () => {
  const lista = [noDia(9, '2026-11-22', '13:00:00.000002'), noDia(8, '2026-11-22', '13:00:00.000001'), noDia(3, '2026-11-22', '13:00:00.000001')]
  assert.deepEqual(selecionar(lista, 'todos', '2026-11-19').solicitacoes.map(s => s.id), [3, 8, 9])
  assert.deepEqual(selecionar(lista, 'todos', '2026-11-19', { ordem: 'decrescente' }).solicitacoes.map(s => s.id), [9, 3, 8])
})
