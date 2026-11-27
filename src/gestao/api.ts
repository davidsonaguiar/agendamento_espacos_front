import { requisitarComSessao as chamar } from '../services/autenticacao'
import { listarEspacos } from './espacos'
import type { EspacoApi } from './tiposEspaco'
import type { SolicitacaoResposta } from '../types/solicitacao'
import type { PerfilUsuario } from '../types/autenticacao'

export interface Vinculo {
  id_usuario: number
  nome_completo: string
  perfil_espaco: string | null
}

export interface Funcionamento {
  dia_semana: number
  hora_abertura: string
  hora_fechamento: string
  ativo: boolean
}

export interface EspacoGestao extends EspacoApi {
  usuarios_vinculados: Vinculo[]
  horarios_funcionamento: Funcionamento[]
}

export interface Reserva {
  id: number
  id_solicitacao: number
  id_espaco: number
  data_hora_inicio: string
  data_hora_fim: string
  espaco_reservado: boolean
  ids_recursos: number[]
}

export type Decisao = 'Aprovado' | 'Rejeitado'
export type DadosEspaco = Pick<EspacoGestao, 'nome' | 'descricao' | 'bloco' | 'capacidade'>
async function listar<T>(caminho: string, signal: AbortSignal): Promise<T[]> {
  const dados = await chamar<T[]>(caminho, { signal })
  if (!Array.isArray(dados)) throw new Error('A API retornou uma lista inválida.')
  return dados
}

export async function espacosGerenciados(id: number, perfil: PerfilUsuario, signal: AbortSignal) {
  const espacos: EspacoGestao[] = []
  const vistos = new Set<number>()
  for (let skip = 0; ; skip += 100) {
    const pagina = await listarEspacos(skip, signal)
    for (const espaco of pagina) {
      if (!Number.isSafeInteger(espaco.id) || vistos.has(espaco.id) || typeof espaco.nome !== 'string' ||
          !Array.isArray(espaco.usuarios_vinculados) || !Array.isArray(espaco.horarios_funcionamento)) {
        throw new Error('A API retornou dados inconsistentes na lista de laboratórios. Atualize para tentar novamente.')
      }
      vistos.add(espaco.id)
      if (perfil === 'Administrador' || espaco.usuarios_vinculados?.some(
        vinculo => vinculo.id_usuario === id && vinculo.perfil_espaco === 'Coordenador',
      )) espacos.push(espaco)
    }
    if (pagina.length < 100) break
  }
  return espacos.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
}

export async function listarFila(espacos: number[], signal: AbortSignal) {
  const ids = new Set(espacos)
  return (await listar<SolicitacaoResposta>('/solicitacoes/', signal)).filter(s => ids.has(s.id_espaco))
}

export async function listarAgenda(id: number, inicio: string, fimExclusivo: string, signal: AbortSignal) {
  const parametros = new URLSearchParams({ id_espaco: String(id),
    data_hora_inicio: inicio + 'T00:00:00', data_hora_fim: fimExclusivo + 'T00:00:00' })
  return (await listar<Reserva>('/agendamentos/?' + parametros, signal))
    .filter(r => r.id_espaco === id).sort((a, b) => a.data_hora_inicio.localeCompare(b.data_hora_inicio))
}

export function decidir(id: number, status: Decisao, justificativa: string) {
  return chamar(`/solicitacoes/${id}/decisao`, { method: 'PATCH', body: { status, justificativa } })
}

export function salvarEspaco(id: number, dados: DadosEspaco) {
  return chamar('/espacos/' + id, { method: 'PUT', body: dados })
}

export function alterarDisponibilidade(espaco: EspacoGestao) {
  return espaco.disponibilidade
    ? chamar('/espacos/' + espaco.id, { method: 'DELETE' })
    : chamar(`/espacos/${espaco.id}/reativar`, { method: 'PATCH' })
}

export function registrarFuncionamento(id: number, dados: Funcionamento) {
  return chamar(`/espacos/${id}/horarios`, { method: 'PATCH', body: dados })
}

export function usuariosDisponiveis(id: number, signal: AbortSignal) {
  return listar<Vinculo>(`/espacos/${id}/usuarios/disponiveis`, signal)
}

export function vincular(id: number, usuario: number, perfil: string) {
  return chamar(`/espacos/${id}/usuarios/${usuario}`, { method: 'POST', body: { perfil_espaco: perfil } })
}

export function desvincular(id: number, usuario: number) {
  return chamar(`/espacos/${id}/usuarios/${usuario}`, { method: 'DELETE' })
}

export interface HorarioProposto {
  data_reserva: string
  hora_inicio: string
  hora_fim: string
}

export function proporHorario(id: number, mensagem: string, horarios: HorarioProposto[], recursos: number[]) {
  return chamar(`/solicitacoes/${id}/propostas-replanejamento`, { method: 'POST', body: { mensagem, horarios, ids_recursos: recursos } })
}

export function pedirComplemento(id: number, mensagem: string) {
  return chamar(`/solicitacoes/${id}/complementacao`, { method: 'POST', body: { mensagem } })
}

/** Consultas nao removem o bloqueio de uma tentativa inconclusiva. */
export async function consultarEstadoSolicitacao(id: number, signal: AbortSignal): Promise<string> {
  const s = await chamar<SolicitacaoResposta>(`/solicitacoes/${id}`, { method: 'GET', signal })
  if (!s || s.id !== id || typeof s.status !== 'string') throw new Error('Resposta de consulta invalida.')
  return `Status atual da solicitacao #${id}: ${s.status}. Interacoes cadastradas: ${Array.isArray(s.interacoes) ? s.interacoes.length : 0}.`
}
export async function consultarEstadoEspaco(id: number | null, signal: AbortSignal): Promise<string> {
  for (let skip = 0; skip < 10000; skip += 100) {
    const pagina = await listarEspacos(skip, signal)
    if (id === null) return 'Catalogo consultado. Cadastros com dados semelhantes nao identificam inequivocamente esta tentativa.'
    const espaco = pagina.find(e => e.id === id)
    if (espaco) return `Espaco #${id}: ${espaco.disponibilidade ? 'ativo' : 'inativo'}. Horarios cadastrados: ${espaco.horarios_funcionamento.length}. Vinculos: ${espaco.usuarios_vinculados.length}.`
    if (pagina.length < 100) return 'Espaco nao localizado na consulta. Isso nao comprova que a operacao falhou.'
  }
  throw new Error('Consulta excedeu o limite seguro.')
}
