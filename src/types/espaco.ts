export interface RecursoResposta {
  id: number
  nome: string
  tipo: string
  autorizacao_necessaria: boolean
  disponibilidade: boolean
  reserva_independente: boolean
  id_espaco: number
}
export interface HorarioFuncionamentoResposta {
  id: number
  dia_semana: number
  hora_abertura: string
  hora_fechamento: string
  ativo: boolean
  id_espaco: number
}
export interface PausaFuncionamentoResposta {
  id: number
  data_inicio: string
  data_fim: string
  motivo: string
  id_espaco: number
}
export interface UsuarioVinculadoResposta {
  id_usuario: number
  nome_completo: string
}
export interface EspacoResposta {
  id: number
  nome: string
  descricao: string | null
  capacidade: number | null
  bloco: string | null
  disponibilidade: boolean
  // Defaults de lista no schema Pydantic; null não é uma lista válida.
  recursos?: RecursoResposta[]
  horarios_funcionamento?: HorarioFuncionamentoResposta[]
  pausas_funcionamento?: PausaFuncionamentoResposta[]
  usuarios_vinculados?: UsuarioVinculadoResposta[]
}

/** Apresentação real, separada do modelo das fixtures. Sem sala, tema ou tipo de uso inventados. */
export interface EspacoCatalogo {
  id: number
  nome: string
  descricao: string | null
  capacidade: number | null
  bloco: string | null
  disponivel: boolean
  recursos: RecursoResposta[]
}
