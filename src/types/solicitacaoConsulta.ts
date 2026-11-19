/** GET /solicitacoes/: contrato de leitura independente da criação e das fixtures. */
export type StatusOficialSolicitacao = 'Pendente' | 'Aprovado' | 'Rejeitado' | 'Cancelada'
  | 'AguardandoComplementacao' | 'AguardandoRespostaProposta'
export type ClassificacaoStatusSolicitacao =
  | { tipo: 'conhecido'; valor: StatusOficialSolicitacao }
  | { tipo: 'desconhecido'; valor: string }

export interface HorarioSolicitacaoConsulta {
  id: number | null
  /** Datas e horas civis recebidas, sem conversão para UTC ou redução da precisão. */
  data_reserva: string
  hora_inicio: string
  hora_fim: string
}
export interface EspacoSolicitacaoConsulta {
  id: number | null
  nome: string
  descricao: string | null
  capacidade: number | null
  bloco: string | null
  disponibilidade: boolean
}
export interface ProjetoSolicitacaoConsulta { id: number | null; descricao: string; finalidade: string }
export interface SolicitanteConsulta { id: number | null; nome_completo: string; perfil: string }
export interface UsuarioEnvolvidoConsulta { id: number | null; id_usuario: number; nome_completo: string }
export interface AnexoSolicitacaoConsulta { id: number; nome_arquivo: string; tipo_arquivo: string; data_upload: string }
export interface InteracaoSolicitacaoConsulta {
  id: number
  tipo: 'ComplementacaoSolicitada' | 'ComplementacaoRespondida' | 'ReplanejamentoProposto' | 'PropostaRespondida'
  situacao: 'AguardandoResposta' | 'Respondida' | 'Aceita' | 'Recusada'
  mensagem: string
  dados: Record<string, unknown> | null
  id_usuario: number
  data_criacao: string
}
export interface SolicitacaoConsulta {
  id: number | null
  finalidade: string
  urgencia: boolean
  /** O backend declara string; classificar antes de apresentar um rótulo conhecido. */
  status: string
  decisao_justificativa: string | null
  id_projeto: number | null
  id_solicitante: number
  id_espaco: number
  /** Modalidade da solicitação: não comprova aprovação nem reserva de agenda. */
  espaco_reservado: boolean
  espaco: EspacoSolicitacaoConsulta | null
  projeto: ProjetoSolicitacaoConsulta | null
  solicitante: SolicitanteConsulta | null
  usuarios_envolvidos: UsuarioEnvolvidoConsulta[]
  ids_recursos: number[]
  horarios: HorarioSolicitacaoConsulta[]
  anexos: AnexoSolicitacaoConsulta[]
  interacoes: InteracaoSolicitacaoConsulta[]
}
