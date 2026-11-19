import { obterEstadoDiaDemonstrativo } from './calendarioDemonstrativo'
import { intervaloEstaLivre, obterIntervalosDemonstrativos } from './horariosAgendamentoDemonstrativos'

export const iso = (d: Date) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0')

export function obterEstadoDataDemonstrativa(id: number, data: Date, hoje = new Date()) {
  const estado = obterEstadoDiaDemonstrativo(id, data, hoje)
  if (estado !== 'livre') return estado

  const intervalos = obterIntervalosDemonstrativos(id, iso(data))
  if (!intervalos?.length) return 'sem-dados'
  return intervalos.some(intervalo => intervalo.estado === 'livre') ? 'livre' : 'ocupado'
}

export function parseData(valor: string | null): Date | null {
  if (!valor || !/^\d{4}-(0[1-9]|1[0-2])-\d{2}$/.test(valor)) return null
  const [ano, mes, dia] = valor.split('-').map(Number)
  const data = new Date(ano, mes - 1, dia)
  return iso(data) === valor ? data : null
}

export function selecaoDemonstrativaValida(id: number, params: URLSearchParams): boolean {
  const data = parseData(params.get('data'))
  return Boolean(data && obterEstadoDataDemonstrativa(id, data) === 'livre'
    && intervaloEstaLivre(obterIntervalosDemonstrativos(id, iso(data)), params.get('inicio') || '', params.get('fim') || ''))
}

// Apenas os parâmetros de seleção e contexto de retorno atravessam as telas.
export function parametrosSelecao(params: URLSearchParams): string {
  const selecao = new URLSearchParams()
  for (const chave of ['mes', 'data', 'inicio', 'fim']) {
    const valor = params.get(chave)
    if (valor !== null) selecao.set(chave, valor)
  }
  const query = selecao.toString()
  return query ? `?${query}` : ''
}
