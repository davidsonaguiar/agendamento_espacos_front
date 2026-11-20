import type { EspacoGestao } from './api'
import { requisitarComSessao } from '../services/autenticacao'
import type { CriarEspacoInput, EspacoApi } from './tiposEspaco'

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

export async function listarEspacos(skip: number, signal: AbortSignal): Promise<EspacoGestao[]> {
  const resposta = await requisitarComSessao<unknown>(`/espacos/?skip=${skip}&limit=100`, { signal })
  if (!Array.isArray(resposta) || !resposta.every(espacoValido)) {
    throw new Error('A API retornou uma lista de espaços em formato inesperado.')
  }
  return resposta.map(espaco => ({
    ...espaco,
    usuarios_vinculados: 'usuarios_vinculados' in espaco ? espaco.usuarios_vinculados : [],
    horarios_funcionamento: 'horarios_funcionamento' in espaco ? espaco.horarios_funcionamento : [],
  })) as EspacoGestao[]
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
