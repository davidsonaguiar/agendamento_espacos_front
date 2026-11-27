export interface IntervaloDisponivel {
  data: string
  inicio: string
  fim: string
}

/** Datas civis locais: não usar toISOString nem interpretar timestamps sem fuso. */
export const dataLocal = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
export function lerData(valor: string | null): Date | null {
  if (!valor || !/^[1-9]\d{3}-(0[1-9]|1[0-2])-\d{2}$/.test(valor)) return null
  const [ano, mes, dia] = valor.split('-').map(Number)
  const data = new Date(ano, mes - 1, dia, 12)
  return dataLocal(data) === valor ? data : null
}
export function horaLocal(valor: string): string | null {
  const match = /^([01]\d|2[0-3]):([0-5]\d)(?::([0-5]\d)(\.\d{1,6})?)?$/.exec(valor)
  if (!match) return null
  const fracao = match[4] ?? ''
  return `${match[1]}:${match[2]}:${match[3] ?? '00'}${fracao}`
}
export const segundos = (hora: string) => {
  const [h, m, s] = hora.split(':').map(Number)
  return h * 3600 + m * 60 + s
}
export const exibirHora = (hora: string) => hora.endsWith(':00') ? hora.slice(0, -3) : hora
export function mesCalendario(params: URLSearchParams, hoje = new Date()): Date {
  const valor = params.get('mes')
  const data = params.getAll('mes').length === 1 ? lerData(`${valor}-01`) : null
  const selecionada = lerData(params.get('data'))
  const base = data ?? selecionada ?? hoje
  return new Date(base.getFullYear(), base.getMonth(), 1, 12)
}
export function periodoMes(mes: Date, hoje = dataLocal(new Date())) {
  const inicio = dataLocal(mes)
  const fim = dataLocal(new Date(mes.getFullYear(), mes.getMonth() + 1, 0, 12))
  return { inicio: fim < hoje ? null : inicio < hoje ? hoje : inicio, fim }
}
export function datasPeriodo(inicio: string, fim: string): string[] {
  const data = lerData(inicio)
  if (!data || !lerData(fim) || fim < inicio) return []
  const datas: string[] = []
  while (dataLocal(data) <= fim && datas.length < 32) {
    datas.push(dataLocal(data))
    data.setDate(data.getDate() + 1)
  }
  return datas
}
/** Comparação exata em microssegundos, sem Date nem perda de precisão. */
export function microsHora(valor: string): number | null {
  const hora = horaLocal(valor)
  if (!hora) return null
  const [h, m, resto] = hora.split(':')
  const [s, fracao = ''] = resto.split('.')
  return (Number(h) * 3600 + Number(m) * 60 + Number(s)) * 1_000_000 + Number(fracao.padEnd(6, '0'))
}
export function inicioFuturo(data: string, inicio: string, agora = new Date()): boolean {
  const hora = microsHora(inicio)
  if (!lerData(data) || hora === null) return false
  const hoje = dataLocal(agora)
  const momento = (agora.getHours() * 3600 + agora.getMinutes() * 60 + agora.getSeconds()) * 1_000_000 + agora.getMilliseconds() * 1000
  return data > hoje || (data === hoje && hora > momento)
}
/** Só aceita limites presentes na API e uma cadeia exata sem lacunas. */
export function intervaloValido(slots: readonly IntervaloDisponivel[], data: string, inicio: string, fim: string): boolean {
  const a = microsHora(inicio), b = microsHora(fim)
  if (a === null || b === null || a >= b || !lerData(data)) return false
  let cursor = a
  for (const slot of slots.filter(s => s.data === data).toSorted((x, y) => microsHora(x.inicio)! - microsHora(y.inicio)!)) {
    if (microsHora(slot.inicio) !== cursor) continue
    const termino = microsHora(slot.fim)
    if (termino === null || termino <= cursor || termino > b) return false
    cursor = termino
    if (cursor === b) return true
  }
  return false
}
export function selecaoRealValida(slots: readonly IntervaloDisponivel[], params: URLSearchParams, agora = new Date()) {
  if (['data', 'inicio', 'fim'].some(chave => params.getAll(chave).length !== 1)) return false
  const data = params.get('data')!, inicio = params.get('inicio')!
  return inicioFuturo(data, inicio, agora) && intervaloValido(slots, data, inicio, params.get('fim')!)
}
export function parametrosReais(params: URLSearchParams): string {
  const query = new URLSearchParams()
  for (const chave of ['mes', 'data', 'inicio', 'fim']) {
    if (params.getAll(chave).length === 1) query.set(chave, params.get(chave)!)
  }
  return `?${query}`
}
