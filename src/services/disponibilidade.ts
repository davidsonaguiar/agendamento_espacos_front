import { requisitar, ErroHttp } from './http'
import { obterTokenAcesso, tokenExpirou, renovarSessao, encerrarSessao } from './autenticacao'
import { dataLocal, datasPeriodo, horaLocal, segundos } from '../data/disponibilidade'
import type { IntervaloDisponivel } from '../data/disponibilidade'

interface PeriodoReservaResposta { data_hora_inicio: string; data_hora_fim: string }

export function validarDisponibilidade(valor: unknown, inicio: string, fim: string): IntervaloDisponivel[] {
  const falha = () => new ErroHttp('resposta', 'A API retornou horários disponíveis inválidos.')
  if (!Array.isArray(valor)) throw falha()
  const vistos = new Set<string>()
  const slots = valor.map((item: unknown) => {
    if (!item || typeof item !== 'object') throw falha()
    const registro = item as Partial<PeriodoReservaResposta>
    const ler = (v: unknown) => {
      if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?$/.test(v)) throw falha()
      const data = v.slice(0, 10), hora = horaLocal(v.slice(11))
      if (!hora || !datasPeriodo(data, data).length || data < inicio || data > fim) throw falha()
      return { data, hora }
    }
    const a = ler(registro.data_hora_inicio), b = ler(registro.data_hora_fim)
    // O caso de uso gera slots de uma hora no mesmo dia, sem timezone.
    if (a.data !== b.data || Math.abs(segundos(b.hora) - segundos(a.hora) - 3600) > 0.0000001) throw falha()
    const chave = `${a.data}T${a.hora}`
    if (vistos.has(chave)) throw falha()
    vistos.add(chave)
    return { data: a.data, inicio: a.hora, fim: b.hora }
  }).sort((a, b) => `${a.data}T${a.inicio}`.localeCompare(`${b.data}T${b.inicio}`))
  return slots
}

/** Somente GET. Usa a sessão existente; não altera o módulo de autenticação. */
export async function consultarHorarios(id: number, inicio: string, fim: string, signal?: AbortSignal): Promise<IntervaloDisponivel[]> {
  const datas = datasPeriodo(inicio, fim)
  if (!Number.isSafeInteger(id) || id <= 0 || !datas.length || datas.length > 31 || inicio < dataLocal(new Date())) {
    throw new ErroHttp('configuracao', 'Informe um espaço válido e um período de até 31 datas inclusivas.')
  }
  let token = obterTokenAcesso()
  const conferir = () => {
    signal?.throwIfAborted()
    if (!token || obterTokenAcesso() !== token) throw new ErroHttp('http', 'A sessão mudou. Entre novamente ou tente recarregar.', 401)
  }
  const renovar = async () => {
    signal?.throwIfAborted()
    // Cancelar a espera não deve cancelar o refresh compartilhado da autenticação.
    const promessa = renovarSessao()
    const sessao = await (signal ? new Promise<Awaited<ReturnType<typeof renovarSessao>>>((resolve, reject) => {
      const cancelar = () => reject(signal.reason)
      signal.addEventListener('abort', cancelar, { once: true })
      void promessa.then(resolve, reject).finally(() => signal.removeEventListener('abort', cancelar))
    }) : promessa)
    signal?.throwIfAborted()
    if (!sessao || obterTokenAcesso() !== sessao.access_token) throw new ErroHttp('http', 'Sua sessão expirou. Entre novamente.', 401)
    token = sessao.access_token
  }
  let renovou = false
  signal?.throwIfAborted()
  if (!token || tokenExpirou(token)) { await renovar(); renovou = true }
  conferir()
  const query = new URLSearchParams({ id_espaco: String(id), data_inicio: inicio, data_fim: fim })
  const ler = () => requisitar<unknown>(`/agendamentos/horarios-disponiveis?${query}`, { token: token!, signal })
  let resposta: unknown
  try { resposta = await ler() } catch (erro) {
    conferir()
    if (!(erro instanceof ErroHttp) || erro.status !== 401) throw erro
    if (renovou) { encerrarSessao(); throw erro }
    await renovar()
    conferir()
    try { resposta = await ler() } catch (repetido) {
      conferir()
      if (repetido instanceof ErroHttp && repetido.status === 401) encerrarSessao()
      throw repetido
    }
  }
  conferir()
  return validarDisponibilidade(resposta, inicio, fim)
}
