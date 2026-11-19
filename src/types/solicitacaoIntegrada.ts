/** Contrato de criação de espaço, separado das respostas e fixtures demonstrativas. */
export interface CriarSolicitacaoEspaco {
  id_espaco: number
  finalidade: string
  horarios: [{ data_reserva: string; hora_inicio: string; hora_fim: string }]
}
export interface SelecaoSolicitacaoEspaco {
  idEspaco: number
  dataReserva: string
  horaInicio: string
  horaFim: string
}

export interface SolicitacaoCriada {
  id: number
  status: string
  id_espaco: number
  id_solicitante: number
  finalidade: string
  horarios: CriarSolicitacaoEspaco['horarios']
}
