import { requisitarComSessao } from './autenticacao'
import type { CriarEspacoInput, EspacoApi } from '../types/espaco'

function espacoValido(valor: unknown): valor is EspacoApi {
  if (!valor || typeof valor !== 'object' || Array.isArray(valor)) return false
  const espaco = valor as Record<string, unknown>
  return Number.isSafeInteger(espaco.id) && Number(espaco.id) > 0 &&
    typeof espaco.nome === 'string' &&
    (typeof espaco.descricao === 'string' || espaco.descricao === null) &&
    (typeof espaco.capacidade === 'number' || espaco.capacidade === null) &&
    (typeof espaco.bloco === 'string' || espaco.bloco === null) &&
    typeof espaco.disponibilidade === 'boolean'
}

export async function listarEspacos(): Promise<EspacoApi[]> {
  const resposta = await requisitarComSessao<unknown>('/espacos/', { method: 'GET' })
  if (!Array.isArray(resposta) || !resposta.every(espacoValido)) {
    throw new Error('A API retornou uma lista de espaços em formato inesperado.')
  }
  return resposta
}

export async function criarEspaco(dados: CriarEspacoInput): Promise<EspacoApi> {
  const resposta = await requisitarComSessao<unknown>('/espacos/', {
    method: 'POST',
    body: dados,
    statusEsperado: 201,
  })
  if (!espacoValido(resposta)) {
    throw new Error('A API retornou o espaço criado em formato inesperado.')
  }
  return resposta
}
