import type { PayloadSolicitacaoEspaco } from '../data/solicitacaoPayload'
import { laboratoriosFicticios } from '../data/laboratorios'
import type { SolicitacaoResposta, StatusSolicitacao } from '../types/solicitacao'
import type { RespostaLogin, UsuarioAutenticado } from '../types/autenticacao'

const CHAVE_SOLICITACOES = 'labagenda.simulador.solicitacoes'

const usuariosTeste: Array<{ identificacao: string; senha: string; usuario: UsuarioAutenticado }> = [
  {
    identificacao: 'professor@teste.local',
    senha: 'Professor123!',
    usuario: {
      id: 9001,
      nome_completo: 'Professor de Teste',
      cpf: '90000000001',
      vinculo_institucional: 'PROF-TESTE',
      email: 'professor@teste.local',
      perfil: 'Membro',
      ativo: true,
    },
  },
  {
    identificacao: 'gestor@teste.local',
    senha: 'Gestor123!',
    usuario: {
      id: 9002,
      nome_completo: 'Gestor de Teste',
      cpf: '90000000002',
      vinculo_institucional: 'GESTOR-TESTE',
      email: 'gestor@teste.local',
      perfil: 'Administrador',
      ativo: true,
    },
  },
]

export const simuladorLocalAtivo =
  typeof import.meta.env !== 'undefined' &&
  import.meta.env.DEV &&
  import.meta.env.VITE_LOCAL_SIMULATOR === 'true'

export function autenticarNoSimuladorLocal(identificacao: string, senha: string): RespostaLogin | null {
  const conta = usuariosTeste.find(usuario =>
    usuario.identificacao === identificacao.trim().toLocaleLowerCase('pt-BR') &&
    usuario.senha === senha,
  )
  if (!conta) return null

  const payload = btoa(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 8 * 60 * 60 }))
  return {
    access_token: `simulador.${payload}.local`,
    token_type: 'bearer',
    usuario: conta.usuario,
  }
}

function lerSolicitacoes(): SolicitacaoResposta[] {
  const armazenadas = localStorage.getItem(CHAVE_SOLICITACOES)
  if (!armazenadas) return []

  const dados: unknown = JSON.parse(armazenadas)
  if (!Array.isArray(dados)) {
    throw new Error('Os dados do simulador local estão inválidos. Limpe os dados do site e tente novamente.')
  }
  return dados as SolicitacaoResposta[]
}

function salvarSolicitacoes(solicitacoes: SolicitacaoResposta[]) {
  localStorage.setItem(CHAVE_SOLICITACOES, JSON.stringify(solicitacoes))
}

export function listarSolicitacoesSimuladas(idSolicitante?: number): SolicitacaoResposta[] {
  const solicitacoes = lerSolicitacoes()
  return idSolicitante === undefined
    ? solicitacoes
    : solicitacoes.filter(solicitacao => solicitacao.id_solicitante === idSolicitante)
}

export function criarSolicitacaoSimulada(
  payload: PayloadSolicitacaoEspaco,
  usuario: UsuarioAutenticado,
): SolicitacaoResposta {
  const laboratorio = laboratoriosFicticios.find(item => item.id === payload.id_espaco)
  if (!laboratorio) throw new Error('O laboratório selecionado não está disponível no simulador.')

  const solicitacoes = lerSolicitacoes()
  const solicitacao: SolicitacaoResposta = {
    id: solicitacoes.reduce((maior, item) => Math.max(maior, item.id ?? 0), 0) + 1,
    tipo: 'Espaço',
    finalidade: payload.finalidade,
    urgencia: false,
    status: 'Pendente',
    decisao_justificativa: null,
    id_projeto: null,
    id_solicitante: usuario.id,
    id_espaco: laboratorio.id,
    projeto: null,
    espaco: {
      id: laboratorio.id,
      nome: laboratorio.nome,
      descricao: laboratorio.resumo,
      capacidade: laboratorio.capacidade,
      bloco: laboratorio.bloco,
      disponibilidade: laboratorio.disponivel,
    },
    solicitante: {
      id: usuario.id,
      nome_completo: usuario.nome_completo,
      perfil: usuario.perfil,
    },
    usuarios_envolvidos: [],
    ids_recursos: [],
    horarios: payload.horarios.map(horario => ({
      id: null,
      data_reserva: horario.data_reserva,
      hora_inicio: horario.hora_inicio,
      hora_fim: horario.hora_fim,
    })),
    anexos: [],
    interacoes: [],
  }

  salvarSolicitacoes([...solicitacoes, solicitacao])
  return solicitacao
}

export function atualizarStatusSolicitacaoSimulada(
  id: number,
  status: Extract<StatusSolicitacao, 'Aprovado' | 'Rejeitado'>,
  justificativa: string | null = null,
): SolicitacaoResposta {
  const solicitacoes = lerSolicitacoes()
  const indice = solicitacoes.findIndex(solicitacao => solicitacao.id === id)
  if (indice === -1) throw new Error('A solicitação não foi encontrada no simulador local.')

  const atualizada = {
    ...solicitacoes[indice],
    status,
    decisao_justificativa: justificativa,
  }
  solicitacoes[indice] = atualizada
  salvarSolicitacoes(solicitacoes)
  return atualizada
}
