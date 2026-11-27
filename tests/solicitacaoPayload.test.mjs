import assert from 'node:assert/strict'
import { test } from 'node:test'
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

const { criarPayloadSolicitacao, validarFinalidadeSolicitacao } = await import(await modulo('../src/data/solicitacaoPayload.ts'))
const { inicioFuturo, intervaloValido, selecaoRealValida } = await import(await modulo('../src/data/disponibilidade.ts'))
const data = '2090-01-07'
const agora = new Date(2090, 0, 7, 8, 15, 30, 123)
const slots = [
  { data, inicio: '08:15:30.123456', fim: '09:15:30.123456' },
  { data, inicio: '09:15:30.123456', fim: '10:15:30.123456' },
]
const selecao = { idEspaco: 77, dataReserva: data, horaInicio: slots[0].inicio, horaFim: slots[1].fim }

test('finalidade valida limites após trim, incluindo caracteres Unicode', () => {
  for (const texto of ['', '  ', 'ab', ' x ', 'x'.repeat(256)]) assert.ok(validarFinalidadeSolicitacao(texto))
  for (const texto of ['abc', '  abc  ', 'x'.repeat(255), '😀'.repeat(255)]) assert.equal(validarFinalidadeSolicitacao(texto), null)
  assert.ok(validarFinalidadeSolicitacao('😀'.repeat(256)))
})

test('payload exato usa ID e intervalos consultados sem tipo nem opcionais', () => {
  const copia = structuredClone(slots)
  assert.deepEqual(criarPayloadSolicitacao(selecao, '  Reunião acadêmica  ', slots, agora), {
    id_espaco: 77, finalidade: 'Reunião acadêmica',
    horarios: [{ data_reserva: data, hora_inicio: slots[0].inicio, hora_fim: slots[1].fim }],
  })
  assert.deepEqual(slots, copia)
})

test('payload preserva zeros finais e precisão original sem UTC', () => {
  const intervalos = [{ data, inicio: '13:00:00.120000', fim: '14:00:00.120000' }]
  const resultado = criarPayloadSolicitacao({ idEspaco: 77, dataReserva: data, horaInicio: '13:00:00.12', horaFim: '14:00:00.12' }, 'Uso acadêmico', intervalos, agora)
  assert.equal(resultado.horarios[0].hora_inicio, '13:00:00.120000')
  assert.equal(resultado.horarios[0].hora_fim, '14:00:00.120000')
  assert.equal(resultado.horarios[0].data_reserva, data)
  assert.ok(intervaloValido(intervalos, data, '13:00:00.12', '14:00:00.12'))
})

test('início precisa ser futuro inclusive no dia atual e no limite de milissegundo', () => {
  assert.equal(inicioFuturo(data, '08:15:30.122999', agora), false)
  assert.equal(inicioFuturo(data, '08:15:30.123000', agora), false)
  assert.equal(inicioFuturo(data, '08:15:30.123001', agora), true)
  assert.equal(inicioFuturo('2090-01-06', '23:59:59', agora), false)
  assert.equal(inicioFuturo('2090-01-08', '00:00:00', agora), true)
  assert.equal(inicioFuturo('2090-02-30', '10:00:00', agora), false)
})

test('payload rejeita finalidade, ID, fuso, inversão, lacuna e seleção indisponível', () => {
  for (const finalidade of ['', '  ', 'ab', 'x'.repeat(256)]) assert.throws(() => criarPayloadSolicitacao(selecao, finalidade, slots, agora))
  for (const alteracoes of [
    { idEspaco: 0 }, { idEspaco: 1.5 }, { idEspaco: Number.MAX_SAFE_INTEGER + 1 },
    { dataReserva: '2090-01-06' }, { dataReserva: '2090-02-30' },
    { horaInicio: '09:15:30.123456', horaFim: '08:15:30.123456' },
    { horaInicio: '08:15:30.123000' }, { horaInicio: '08:15:30Z' },
    { horaFim: '12:15:30.123456' }, { horaFim: '09:45:30.123456' },
  ]) assert.throws(() => criarPayloadSolicitacao({ ...selecao, ...alteracoes }, 'Uso acadêmico', slots, agora))
  assert.throws(() => criarPayloadSolicitacao(selecao, 'Uso acadêmico', [], agora))
  const futuro = new Date(2090, 0, 7, 8, 15, 30, 124)
  assert.throws(() => criarPayloadSolicitacao(selecao, 'Uso acadêmico', slots, futuro))
  const params = new URLSearchParams({ data, inicio: selecao.horaInicio, fim: selecao.horaFim })
  assert.ok(selecaoRealValida(slots, params, agora))
  assert.equal(selecaoRealValida(slots, params, futuro), false)
})
