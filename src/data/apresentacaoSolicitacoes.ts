import { microsHora, lerData, dataLocal } from './disponibilidade'
import type { HorarioSolicitacaoConsulta, SolicitacaoConsulta } from '../types/solicitacaoConsulta'
export function compararHorarios(a: HorarioSolicitacaoConsulta, b: HorarioSolicitacaoConsulta): number {
  return a.data_reserva.localeCompare(b.data_reserva) || (microsHora(a.hora_inicio)! - microsHora(b.hora_inicio)!)
    || (microsHora(a.hora_fim)! - microsHora(b.hora_fim)!) || (a.id ?? Number.MAX_SAFE_INTEGER) - (b.id ?? Number.MAX_SAFE_INTEGER)
}
export const ordenarHorarios = (horarios: readonly HorarioSolicitacaoConsulta[]) => [...horarios].sort(compararHorarios)
export type TipoPeriodoSolicitacao = 'todos' | '7dias' | '30dias' | 'passados' | 'personalizado'
export type OrdemSolicitacao = 'crescente' | 'decrescente'
export interface FiltroPeriodoSolicitacao { tipo: TipoPeriodoSolicitacao; inicio?: string; fim?: string }
export type PeriodoSolicitacao = { valido: true; inicio: string | null; fim: string | null } | { valido: false; erro: string }
/** Calendário civil local, ao meio-dia para evitar transições de fuso à meia-noite. */
function somarDiasLocais(hoje: string, quantidade: number): string {
  const dia = lerData(hoje)!
  dia.setDate(dia.getDate() + quantidade)
  return dataLocal(dia)
}
export function resolverPeriodoSolicitacao(filtro: FiltroPeriodoSolicitacao, hoje: string): PeriodoSolicitacao {
  if (filtro.tipo === 'todos') return { valido: true, inicio: null, fim: null }
  if (filtro.tipo === 'personalizado') {
    if (!filtro.inicio || !filtro.fim) return { valido: false, erro: 'Informe a data inicial e a data final do período.' }
    if (!lerData(filtro.inicio) || !lerData(filtro.fim)) return { valido: false, erro: 'Informe datas válidas para o período.' }
    if (filtro.inicio > filtro.fim) return { valido: false, erro: 'A data final deve ser igual ou posterior à data inicial.' }
    return { valido: true, inicio: filtro.inicio, fim: filtro.fim }
  }
  if (!lerData(hoje)) return { valido: false, erro: 'Não foi possível determinar o dia local atual.' }
  if (filtro.tipo === 'passados') return { valido: true, inicio: null, fim: somarDiasLocais(hoje, -1) }
  return { valido: true, inicio: hoje, fim: somarDiasLocais(hoje, filtro.tipo === '7dias' ? 6 : 29) }
}
export function horarioNoPeriodo(h: HorarioSolicitacaoConsulta, periodo: PeriodoSolicitacao): boolean {
  return periodo.valido && (periodo.inicio === null || h.data_reserva >= periodo.inicio) && (periodo.fim === null || h.data_reserva <= periodo.fim)
}
export function ordenarSolicitacoes(solicitacoes: readonly SolicitacaoConsulta[], ordem: OrdemSolicitacao = 'crescente',
  periodo: PeriodoSolicitacao = { valido: true, inicio: null, fim: null }): SolicitacaoConsulta[] {
  if (!periodo.valido) return []
  return solicitacoes.map((s, indice) => {
    const horarios = ordenarHorarios(s.horarios)
    return { s, indice, horarios, referencia: horarios.find(h => horarioNoPeriodo(h, periodo)) }
  }).sort((a, b) => {
    const x = a.referencia, y = b.referencia
    // Ausência de horários permanece ao final, independentemente da direção.
    if (!x && y) return 1
    if (x && !y) return -1
    const comparacao = x && y ? compararHorarios({ ...x, id: null }, { ...y, id: null }) : 0
    return comparacao * (ordem === 'crescente' ? 1 : -1)
      || (a.s.id ?? Number.MAX_SAFE_INTEGER) - (b.s.id ?? Number.MAX_SAFE_INTEGER) || a.s.id_espaco - b.s.id_espaco
      || a.s.finalidade.localeCompare(b.s.finalidade) || a.s.status.localeCompare(b.s.status) || a.indice - b.indice
  }).map(({ s, horarios }) => ({ ...s, horarios }))
}
export function selecionarSolicitacoes(solicitacoes: readonly SolicitacaoConsulta[], filtro: FiltroPeriodoSolicitacao,
  status: string, ordem: OrdemSolicitacao, hoje: string): { solicitacoes: SolicitacaoConsulta[]; erro: string | null } {
  const periodo = resolverPeriodoSolicitacao(filtro, hoje)
  if (!periodo.valido) return { solicitacoes: [], erro: periodo.erro }
  const todos = periodo.inicio === null && periodo.fim === null
  const selecionadas = solicitacoes.filter(s => (status === 'Todos' || s.status === status) && (todos || s.horarios.some(h => horarioNoPeriodo(h, periodo))))
  return { solicitacoes: ordenarSolicitacoes(selecionadas, ordem, periodo), erro: null }
}
export function formatarHoraSolicitacao(hora: string): string {
  return microsHora(hora) !== null && microsHora(hora)! % 60_000_000 === 0 ? hora.slice(0, 5) : hora
}
export function formatarDuracaoSolicitacao(inicio: string, fim: string): string | null {
  const a = microsHora(inicio), b = microsHora(fim)
  if (a === null || b === null || b <= a) return null
  const total = b - a, horas = Math.floor(total / 3_600_000_000), minutos = Math.floor(total % 3_600_000_000 / 60_000_000)
  const micros = total % 60_000_000, segundos = Math.floor(micros / 1_000_000), fracao = micros % 1_000_000
  const textoSegundos = fracao ? `${segundos},${String(fracao).padStart(6, '0').replace(/0+$/, '')}` : String(segundos)
  return [horas ? `${horas} h` : '', minutos ? `${minutos} min` : '', micros ? `${textoSegundos} s` : ''].filter(Boolean).join(' ')
}
