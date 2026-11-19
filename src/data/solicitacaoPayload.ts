import { inicioFuturo, intervaloValido, microsHora } from './disponibilidade'
import type { IntervaloDisponivel } from './disponibilidade'
import type { CriarSolicitacaoEspaco, SelecaoSolicitacaoEspaco } from '../types/solicitacaoIntegrada'

export function validarFinalidadeSolicitacao(finalidade: string): string | null {
  const tamanho = Array.from(finalidade.trim()).length
  if (!tamanho) return 'Informe a finalidade da solicitação.'
  if (tamanho < 3) return 'A finalidade deve ter pelo menos 3 caracteres.'
  if (tamanho > 255) return 'A finalidade deve ter no máximo 255 caracteres.'
  return null
}

/** Prepara apenas dados locais. Os limites e sua precisão vêm da disponibilidade real. */
export function criarPayloadSolicitacao(
  selecao: SelecaoSolicitacaoEspaco,
  finalidade: string,
  intervalos: readonly IntervaloDisponivel[],
  agora = new Date(),
): CriarSolicitacaoEspaco {
  const erro = validarFinalidadeSolicitacao(finalidade)
  if (erro) throw new Error(erro)
  if (!Number.isSafeInteger(selecao.idEspaco) || selecao.idEspaco <= 0) throw new Error('Laboratório inválido.')
  if (!inicioFuturo(selecao.dataReserva, selecao.horaInicio, agora)
    || !intervaloValido(intervalos, selecao.dataReserva, selecao.horaInicio, selecao.horaFim)) {
    throw new Error('Selecione um intervalo futuro e disponível.')
  }
  const slots = intervalos.filter(s => s.data === selecao.dataReserva)
  const inicio = slots.find(s => microsHora(s.inicio) === microsHora(selecao.horaInicio))!
  const fim = slots.find(s => microsHora(s.fim) === microsHora(selecao.horaFim))!
  return {
    id_espaco: selecao.idEspaco,
    finalidade: finalidade.trim(),
    horarios: [{ data_reserva: selecao.dataReserva, hora_inicio: inicio.inicio, hora_fim: fim.fim }],
  }
}
