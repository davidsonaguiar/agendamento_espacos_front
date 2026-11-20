import { requisitarComSessao } from './autenticacao'
import type { SolicitacaoResposta } from '../types/solicitacao'

export interface Intervalo {
  data_hora_inicio: string
  data_hora_fim: string
}

export async function horariosLivres(id: number, de: string, ate: string, signal?: AbortSignal) {
  const query = new URLSearchParams({ id_espaco: String(id), data_inicio: de, data_fim: ate })
  const dados = await requisitarComSessao<Intervalo[]>('/agendamentos/horarios-disponiveis?' + query, { signal })
  if (!Array.isArray(dados)) throw new Error('A API não retornou a lista de horários.')
  const agora = new Date()
  return dados.filter(h => new Date(h.data_hora_inicio) > agora)
    .sort((a, b) => a.data_hora_inicio.localeCompare(b.data_hora_inicio))
}

export function terminosLivres(horarios: Intervalo[], inicio: string) {
  const fimPorInicio = new Map(horarios.map(h => [h.data_hora_inicio, h.data_hora_fim]))
  const terminos: string[] = []
  let cursor = inicio
  while (fimPorInicio.has(cursor)) {
    const fim = fimPorInicio.get(cursor)!
    if (fim <= cursor || fim.slice(0, 10) !== inicio.slice(0, 10)) break
    terminos.push(fim)
    cursor = fim
  }
  return terminos
}

export async function solicitar(id: number, finalidade: string, inicio: string, fim: string) {
  const dia = inicio.slice(0, 10)
  const livres = await horariosLivres(id, dia, dia)
  if (!terminosLivres(livres, inicio).includes(fim)) throw new Error('Esse intervalo já não está disponível. Escolha outro horário.')
  const pedido = await requisitarComSessao<SolicitacaoResposta>('/solicitacoes/', { method: 'POST', statusEsperado: 201,
    body: { id_espaco: id, finalidade: finalidade.trim(), horarios: [
      { data_reserva: dia, hora_inicio: inicio.slice(11), hora_fim: fim.slice(11) },
    ] } })
  if (!pedido?.id) throw new Error('Confira em Meus agendamentos se o pedido foi registrado antes de tentar novamente.')
  return pedido.id
}

export async function minhasSolicitacoes(usuario: number, signal: AbortSignal) {
  const lista = await requisitarComSessao<SolicitacaoResposta[]>('/solicitacoes/', { signal })
  if (!Array.isArray(lista)) throw new Error('A API não retornou as solicitações.')
  return lista.filter(s => s.id_solicitante === usuario)
}

export function responderSolicitacao(id: number, mensagem: string, proposta?: { id: number; aceita: boolean }) {
  const parte = proposta ? 'propostas-replanejamento/' + proposta.id + '/resposta' : 'complementacao/resposta'
  return requisitarComSessao('/solicitacoes/' + id + '/' + parte, {
    method: 'POST', body: proposta ? { mensagem, aceita: proposta.aceita } : { mensagem },
  })
}
