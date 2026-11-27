import { ErroHttp } from '../services/http'
import type { ClassificacaoStatusSolicitacao, SolicitacaoConsulta, InteracaoSolicitacaoConsulta } from '../types/solicitacaoConsulta'

const statusOficiais = ['Pendente', 'Aprovado', 'Rejeitado', 'Cancelada', 'AguardandoComplementacao', 'AguardandoRespostaProposta'] as const
export function classificarStatusSolicitacao(valor: string): ClassificacaoStatusSolicitacao {
  const conhecido = statusOficiais.find(status => status === valor)
  return conhecido ? { tipo: 'conhecido', valor: conhecido } : { tipo: 'desconhecido', valor }
}
const falha = (): never => { throw new ErroHttp('resposta', 'A API retornou uma lista de solicitações com dados inválidos.') }
const objeto = (v: unknown): Record<string, unknown> => v && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, unknown> : falha()
const texto = (v: unknown): string => typeof v === 'string' ? v : falha()
const booleano = (v: unknown): boolean => typeof v === 'boolean' ? v : falha()
const inteiro = (v: unknown): number => Number.isSafeInteger(v) && Number(v) > 0 ? Number(v) : falha()
const nulo = <T>(v: unknown, ler: (v: unknown) => T): T | null => v === null ? null : ler(v)
const lista = <T>(v: unknown, ler: (v: unknown) => T): T[] => Array.isArray(v) ? v.map(ler) : falha()
function dataCivil(v: unknown): string {
  const s = texto(v)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return falha()
  const [ano, mes, dia] = s.split('-').map(Number)
  const dias = [31, ano % 4 === 0 && (ano % 100 !== 0 || ano % 400 === 0) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
  return ano >= 1 && mes >= 1 && mes <= 12 && dia >= 1 && dia <= dias[mes - 1] ? s : falha()
}
function horaCivil(v: unknown): string {
  const s = texto(v)
  return /^([01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{1,6})?$/.test(s) ? s : falha()
}
function instante(v: unknown): string {
  const s = texto(v)
  const m = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?)(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)?$/.exec(s)
  if (!m) return falha()
  dataCivil(m[1]); horaCivil(m[2])
  return s
}
function interacao(v: unknown): InteracaoSolicitacaoConsulta {
  const r = objeto(v)
  const tipo = ['ComplementacaoSolicitada', 'ComplementacaoRespondida', 'ReplanejamentoProposto', 'PropostaRespondida'].find(t => t === r.tipo)
  const situacao = ['AguardandoResposta', 'Respondida', 'Aceita', 'Recusada'].find(t => t === r.situacao)
  if (!tipo || !situacao) return falha()
  return { id: inteiro(r.id), tipo: tipo as InteracaoSolicitacaoConsulta['tipo'], situacao: situacao as InteracaoSolicitacaoConsulta['situacao'],
    mensagem: texto(r.mensagem), dados: nulo(r.dados, objeto), id_usuario: inteiro(r.id_usuario), data_criacao: instante(r.data_criacao) }
}
function solicitacao(v: unknown): SolicitacaoConsulta {
  const r = objeto(v)
  const s: SolicitacaoConsulta = {
    id: nulo(r.id, inteiro), finalidade: texto(r.finalidade), urgencia: booleano(r.urgencia), status: texto(r.status),
    decisao_justificativa: nulo(r.decisao_justificativa, texto), id_projeto: nulo(r.id_projeto, inteiro),
    id_solicitante: inteiro(r.id_solicitante), id_espaco: inteiro(r.id_espaco), espaco_reservado: booleano(r.espaco_reservado),
    espaco: nulo(r.espaco, v => { const e = objeto(v); return { id: nulo(e.id, inteiro), nome: texto(e.nome), descricao: nulo(e.descricao, texto),
      capacidade: nulo(e.capacidade, v => Number.isSafeInteger(v) ? Number(v) : falha()), bloco: nulo(e.bloco, texto), disponibilidade: booleano(e.disponibilidade) } }),
    projeto: nulo(r.projeto, v => { const p = objeto(v); return { id: nulo(p.id, inteiro), descricao: texto(p.descricao), finalidade: texto(p.finalidade) } }),
    solicitante: nulo(r.solicitante, v => { const u = objeto(v); return { id: nulo(u.id, inteiro), nome_completo: texto(u.nome_completo), perfil: texto(u.perfil) } }),
    usuarios_envolvidos: lista(r.usuarios_envolvidos, v => { const u = objeto(v); return { id: nulo(u.id, inteiro), id_usuario: inteiro(u.id_usuario), nome_completo: texto(u.nome_completo) } }),
    ids_recursos: lista(r.ids_recursos, inteiro),
    horarios: lista(r.horarios, v => { const h = objeto(v); return { id: nulo(h.id, inteiro), data_reserva: dataCivil(h.data_reserva), hora_inicio: horaCivil(h.hora_inicio), hora_fim: horaCivil(h.hora_fim) } }),
    anexos: lista(r.anexos, v => { const a = objeto(v); return { id: inteiro(a.id), nome_arquivo: texto(a.nome_arquivo), tipo_arquivo: texto(a.tipo_arquivo), data_upload: instante(a.data_upload) } }),
    interacoes: lista(r.interacoes, interacao),
  }
  if (!s.status.trim() || (s.espaco?.id != null && s.espaco.id !== s.id_espaco)
    || (s.solicitante?.id != null && s.solicitante.id !== s.id_solicitante)
    || (s.projeto?.id != null && s.projeto.id !== s.id_projeto)) return falha()
  return s
}
/** Valida todos os registros sem fixtures, campos inventados ou conversão temporal. */
export function validarListaSolicitacoes(valor: unknown): SolicitacaoConsulta[] {
  const resultado = lista(valor, solicitacao)
  const ids = resultado.flatMap(s => s.id === null ? [] : [s.id])
  if (new Set(ids).size !== ids.length) return falha()
  return resultado
}
