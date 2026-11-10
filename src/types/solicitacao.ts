/** Status oficiais conhecidos no backend de referência (400e79e). */
export type StatusSolicitacao =
  | 'Pendente'
  | 'AguardandoComplementacao'
  | 'AguardandoRespostaProposta'
  | 'Aprovado'
  | 'Rejeitado'
  | 'Cancelada'

export type TipoSolicitacao = 'Espaço' | 'Recurso' | 'Serviço'

export interface HorarioSolicitacaoResposta {
  id: number | null
  /** Data local YYYY-MM-DD; não converter para UTC. */
  data_reserva: string
  /** Horas locais serializadas pela API, inclusive segundos quando presentes. */
  hora_inicio: string
  hora_fim: string
}

export interface EspacoRelacionadoSolicitacao {
  id: number | null
  nome: string
  descricao: string | null
  capacidade: number | null
  bloco: string | null
  disponibilidade: boolean
}

export interface ProjetoRelacionadoSolicitacao {
  id: number | null
  descricao: string
  finalidade: string
}

export interface SolicitanteSolicitacao {
  id: number | null
  nome_completo: string
  perfil: string
}

export interface UsuarioEnvolvidoSolicitacao {
  id: number | null
  id_usuario: number
  nome_completo: string
}

export interface AnexoSolicitacaoResposta {
  id: number
  nome_arquivo: string
  tipo_arquivo: string
  data_upload: string
}

export interface InteracaoSolicitacaoResposta {
  id: number
  tipo: 'ComplementacaoSolicitada' | 'ComplementacaoRespondida' | 'ReplanejamentoProposto' | 'PropostaRespondida'
  situacao: 'AguardandoResposta' | 'Respondida' | 'Aceita' | 'Recusada'
  mensagem: string
  dados: Record<string, unknown> | null
  id_usuario: number
  data_criacao: string
}

/** Resposta de consulta de solicitação; não é payload de criação nem reserva confirmada.
 * O backend declara status como string; a união representa os valores oficiais conhecidos.
 * Relações opcionais no domínio são serializadas como objeto ou null.
 */
export interface SolicitacaoResposta {
  id: number | null
  tipo: TipoSolicitacao
  finalidade: string
  urgencia: boolean
  status: StatusSolicitacao
  decisao_justificativa: string | null
  id_projeto: number | null
  id_solicitante: number
  id_espaco: number
  projeto: ProjetoRelacionadoSolicitacao | null
  espaco: EspacoRelacionadoSolicitacao | null
  solicitante: SolicitanteSolicitacao | null
  usuarios_envolvidos: UsuarioEnvolvidoSolicitacao[]
  ids_recursos: number[]
  horarios: HorarioSolicitacaoResposta[]
  anexos: AnexoSolicitacaoResposta[]
  interacoes: InteracaoSolicitacaoResposta[]
}
