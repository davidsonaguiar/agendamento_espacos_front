import { requisitar, ErroHttp } from './http'
import { obterTokenAcesso, tokenExpirou } from './autenticacao'
import type { EspacoResposta } from '../types/espaco'

type Registro = Record<string, unknown>
const objeto = (valor: unknown): valor is Registro => Boolean(valor && typeof valor === 'object' && !Array.isArray(valor))
const inteiro = (valor: unknown): boolean => Number.isSafeInteger(valor) && Number(valor) > 0
const texto = (valor: unknown): valor is string => typeof valor === 'string'
const textoNulo = (valor: unknown): boolean => valor === null || texto(valor)
const booleano = (valor: unknown): boolean => typeof valor === 'boolean'
const hora = (valor: unknown): boolean => typeof valor === 'string' && /^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d(?:\.\d{1,6})?)?$/.test(valor)
const data = (valor: unknown): boolean => {
  if (typeof valor !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(valor)) return false
  const date = new Date(`${valor}T12:00:00Z`)
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === valor
}
const lista = (valor: unknown, validar: (item: Registro) => boolean): boolean =>
  valor === undefined || (Array.isArray(valor) && valor.every(item => objeto(item) && validar(item)))

export function validarPaginaEspacos(valor: unknown): EspacoResposta[] {
  if (!Array.isArray(valor) || !valor.every(espaco => objeto(espaco)
    && inteiro(espaco.id) && texto(espaco.nome) && Boolean(espaco.nome.trim())
    && textoNulo(espaco.descricao) && textoNulo(espaco.bloco)
    && (espaco.capacidade === null || (Number.isSafeInteger(espaco.capacidade) && Number(espaco.capacidade) >= 0))
    && booleano(espaco.disponibilidade)
    && lista(espaco.recursos, r => inteiro(r.id) && texto(r.nome) && texto(r.tipo)
      && booleano(r.autorizacao_necessaria) && booleano(r.disponibilidade)
      && booleano(r.reserva_independente) && r.id_espaco === espaco.id)
    && lista(espaco.horarios_funcionamento, h => inteiro(h.id) && Number.isInteger(h.dia_semana)
      && Number(h.dia_semana) >= 0 && Number(h.dia_semana) <= 6
      && hora(h.hora_abertura) && hora(h.hora_fechamento) && booleano(h.ativo) && h.id_espaco === espaco.id)
    && lista(espaco.pausas_funcionamento, p => inteiro(p.id) && data(p.data_inicio) && data(p.data_fim)
      && texto(p.motivo) && p.id_espaco === espaco.id)
    && lista(espaco.usuarios_vinculados, u => inteiro(u.id_usuario) && texto(u.nome_completo)))) {
    throw new ErroHttp('resposta', 'A API retornou um catálogo com dados inválidos.')
  }
  return valor as EspacoResposta[]
}

/** Sem total no contrato: só uma página menor que limit conclui a leitura.
 * Guarda de 100 páginas: falha explícita, nunca apresenta truncamento como sucesso.
 * Offset não garante snapshot se o banco mudar durante a leitura.
 */
export async function listarEspacos(signal?: AbortSignal): Promise<EspacoResposta[]> {
  const token = obterTokenAcesso()
  if (!token || tokenExpirou(token)) throw new ErroHttp('http', 'Sua sessão expirou. Entre novamente.', 401)
  const resultado: EspacoResposta[] = []
  const ids = new Set<number>()
  const limit = 100
  for (let pagina = 0; pagina < 100; pagina++) {
    const dados = validarPaginaEspacos(await requisitar<unknown>(`/espacos/?skip=${pagina * limit}&limit=${limit}`, { token, signal }))
    if (dados.length > limit || dados.some(espaco => ids.has(espaco.id))) {
      throw new ErroHttp('resposta', 'A paginação do catálogo retornou dados inconsistentes. Tente novamente.')
    }
    for (const espaco of dados) {
      if (ids.has(espaco.id)) throw new ErroHttp('resposta', 'O catálogo retornou espaços duplicados.')
      ids.add(espaco.id)
      resultado.push(espaco)
    }
    if (dados.length < limit) return resultado
  }
  throw new ErroHttp('resposta', 'O catálogo excedeu o limite seguro de leitura. Nenhum resultado parcial foi apresentado.')
}
