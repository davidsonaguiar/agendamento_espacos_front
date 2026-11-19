import type { SolicitacaoConsulta } from '../types/solicitacaoConsulta'
import { validarListaSolicitacoes } from '../data/solicitacoesRecebidas'
import { requisitar, ErroHttp } from './http'
import { verificarSessao, obterTokenAcesso, obterUsuarioAutenticado, tokenExpirou, renovarSessao, encerrarSessao } from './autenticacao'
import { inicioFuturo, microsHora } from '../data/disponibilidade'
import { validarFinalidadeSolicitacao } from '../data/solicitacaoPayload'
import type { CriarSolicitacaoEspaco, SolicitacaoCriada } from '../types/solicitacaoIntegrada'

export type ResultadoFalhaCriacao = 'nao-enviado' | 'rejeitado' | 'incerto'
export class ErroCriacaoSolicitacao extends Error {
  readonly resultado: ResultadoFalhaCriacao
  readonly status?: number
  constructor(mensagem: string, resultado: ResultadoFalhaCriacao, status?: number) {
    super(mensagem)
    this.name = 'ErroCriacaoSolicitacao'
    this.resultado = resultado
    this.status = status
  }
}
const statusConhecidos = ['Pendente', 'Aprovado', 'Rejeitado', 'Cancelada', 'AguardandoComplementacao', 'AguardandoRespostaProposta']
function validarResposta(valor: unknown, payload: CriarSolicitacaoEspaco, usuario: number): SolicitacaoCriada {
  const erro = () => new ErroCriacaoSolicitacao('A resposta de criação não pôde ser confirmada.', 'incerto')
  if (!valor || typeof valor !== 'object') throw erro()
  const r = valor as Partial<SolicitacaoCriada>
  const h = r.horarios?.[0], enviado = payload.horarios[0]
  if (!Number.isSafeInteger(r.id) || r.id! <= 0 || typeof r.status !== 'string' || !statusConhecidos.includes(r.status)
    || r.id_espaco !== payload.id_espaco || r.id_solicitante !== usuario || r.finalidade !== payload.finalidade
    || !Array.isArray(r.horarios) || r.horarios.length !== 1 || !h || h.data_reserva !== enviado.data_reserva
    || typeof h.hora_inicio !== 'string' || typeof h.hora_fim !== 'string'
    || microsHora(h.hora_inicio) !== microsHora(enviado.hora_inicio) || microsHora(h.hora_fim) !== microsHora(enviado.hora_fim)) throw erro()
  return { id: r.id!, status: r.status, id_espaco: r.id_espaco, id_solicitante: usuario,
    finalidade: r.finalidade, horarios: [{ data_reserva: h.data_reserva, hora_inicio: h.hora_inicio, hora_fim: h.hora_fim }] }
}

/** Um único POST. Refresh é permitido somente na verificação anterior à transmissão. */
export async function criarSolicitacao(
  entrada: CriarSolicitacaoEspaco,
  opcoes: { idUsuario: number; signal?: AbortSignal; aoTransmitir?: () => void },
): Promise<SolicitacaoCriada> {
  let transmitido = false
  try {
    opcoes.signal?.throwIfAborted()
    // Copia somente os três campos do contrato, sem propagar extras do chamador.
    const payload: CriarSolicitacaoEspaco = { id_espaco: entrada.id_espaco, finalidade: entrada.finalidade,
      horarios: [{ data_reserva: entrada.horarios[0].data_reserva, hora_inicio: entrada.horarios[0].hora_inicio, hora_fim: entrada.horarios[0].hora_fim }] }
    const validarPayload = () => {
      const h = payload.horarios[0], a = microsHora(h.hora_inicio), b = microsHora(h.hora_fim)
      if (!Number.isSafeInteger(payload.id_espaco) || payload.id_espaco <= 0 || validarFinalidadeSolicitacao(payload.finalidade)
        || payload.finalidade !== payload.finalidade.trim() || entrada.horarios.length !== 1
        || a === null || b === null || a >= b || !inicioFuturo(h.data_reserva, h.hora_inicio)) {
        throw new ErroCriacaoSolicitacao('Confira a finalidade e selecione um intervalo futuro e válido.', 'nao-enviado')
      }
    }
    validarPayload()
    const usuario = await verificarSessao()
    opcoes.signal?.throwIfAborted()
    const token = obterTokenAcesso()
    if (!usuario || !token || usuario.id !== opcoes.idUsuario || obterUsuarioAutenticado()?.id !== usuario.id) {
      throw new ErroCriacaoSolicitacao('Sua sessão expirou ou mudou. Entre novamente antes de enviar.', 'nao-enviado', 401)
    }
    if (usuario.perfil !== 'Membro') throw new ErroCriacaoSolicitacao('Você não tem permissão para criar esta solicitação.', 'nao-enviado', 403)
    validarPayload()
    const signal = opcoes.signal ? AbortSignal.any([opcoes.signal, AbortSignal.timeout(15_000)]) : AbortSignal.timeout(15_000)
    signal.throwIfAborted()
    opcoes.aoTransmitir?.()
    transmitido = true
    const resposta = await requisitar<unknown>('/solicitacoes/', { method: 'POST', token, body: payload, signal, statusEsperado: 201 })
    if (obterTokenAcesso() !== token || obterUsuarioAutenticado()?.id !== usuario.id) {
      throw new ErroCriacaoSolicitacao('A sessão mudou antes da confirmação do envio.', 'incerto')
    }
    return validarResposta(resposta, payload, usuario.id)
  } catch (erro) {
    if (erro instanceof ErroCriacaoSolicitacao) throw erro
    if (!transmitido) throw new ErroCriacaoSolicitacao('Não foi possível concluir a verificação anterior ao envio. Nenhuma criação foi enviada.', 'nao-enviado')
    if (erro instanceof ErroHttp && erro.tipo === 'configuracao') {
      throw new ErroCriacaoSolicitacao('A configuração da API impediu o envio.', 'nao-enviado')
    }
    if (erro instanceof ErroHttp && erro.tipo === 'http' && [401, 403, 404, 422, 409].includes(erro.status ?? 0)) {
      const mensagem = erro.status === 401 ? 'Sessão expirada ou inválida. Entre novamente antes de tentar enviar.'
        : erro.status === 403 ? 'Você não tem permissão para criar esta solicitação.'
          : erro.status === 404 ? 'Laboratório não encontrado. Volte ao catálogo.' : erro.message
      throw new ErroCriacaoSolicitacao(mensagem, 'rejeitado', erro.status)
    }
    throw new ErroCriacaoSolicitacao('Não foi possível confirmar o resultado do envio.', 'incerto', erro instanceof ErroHttp ? erro.status : undefined)
  }
}


/** Cancela só a espera deste consumidor, sem interromper o refresh compartilhado. */
function aguardarLeitura<T>(promessa: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (!signal) return promessa
  return new Promise((resolve, reject) => {
    const cancelar = () => reject(signal.reason)
    if (signal.aborted) cancelar()
    else signal.addEventListener('abort', cancelar, { once: true })
    void promessa.then(resolve, reject).finally(() => signal.removeEventListener('abort', cancelar))
  })
}

/** GET próprio: a seleção de apresentação não substitui a autorização do backend.
 * Sem cache ou ID vindo de URL. O chamador deve limpar sua lista ao mudar a sessão.
 * Somente esta leitura pode repetir GET uma vez; a criação acima não é repetida.
 */
export async function listarMinhasSolicitacoes(signal?: AbortSignal): Promise<SolicitacaoConsulta[]> {
  signal?.throwIfAborted()
  const usuario = obterUsuarioAutenticado()
  const sessaoInvalida = () => new ErroHttp('http', 'Sua sessão expirou ou mudou. Entre novamente antes de consultar suas solicitações.', 401)
  if (!usuario?.ativo || !Number.isSafeInteger(usuario.id) || usuario.id <= 0) throw sessaoInvalida()
  const idUsuario = usuario.id
  let token = obterTokenAcesso()
  const conferir = () => {
    signal?.throwIfAborted()
    const atual = obterUsuarioAutenticado()
    if (!atual?.ativo || atual.id !== idUsuario || obterTokenAcesso() !== token) throw sessaoInvalida()
  }
  let renovou = false
  const renovar = async () => {
    conferir()
    renovou = true
    const nova = await aguardarLeitura(renovarSessao(), signal)
    signal?.throwIfAborted()
    if (!nova || nova.usuario.id !== idUsuario || obterUsuarioAutenticado()?.id !== idUsuario
      || !obterUsuarioAutenticado()?.ativo || obterTokenAcesso() !== nova.access_token) throw sessaoInvalida()
    token = nova.access_token
  }
  if (!token || tokenExpirou(token)) await renovar()
  conferir()
  if (!token) throw sessaoInvalida()
  const ler = () => requisitar<unknown>('/solicitacoes/', { method: 'GET', token: token!, signal, statusEsperado: 200 })
  let resposta: unknown
  try { resposta = await ler() } catch (erro) {
    conferir()
    if (!(erro instanceof ErroHttp) || erro.status !== 401) throw erro
    if (renovou) { encerrarSessao(); throw sessaoInvalida() }
    await renovar()
    conferir()
    try { resposta = await ler() } catch (repetido) {
      conferir()
      if (repetido instanceof ErroHttp && repetido.status === 401) { encerrarSessao(); throw sessaoInvalida() }
      throw repetido
    }
  }
  conferir()
  const resultado = validarListaSolicitacoes(resposta).filter(s => s.id_solicitante === idUsuario)
  conferir()
  return resultado
}
