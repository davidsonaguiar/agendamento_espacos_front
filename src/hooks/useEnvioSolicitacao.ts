import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { criarSolicitacao, ErroCriacaoSolicitacao } from '../services/solicitacoes'
import type { CriarSolicitacaoEspaco, SolicitacaoCriada } from '../types/solicitacaoIntegrada'

type EstadoEnvio = { tipo: 'ocioso' } | { tipo: 'verificando' | 'enviando' }
  | { tipo: 'erro'; mensagem: string; incerto: boolean }
  | { tipo: 'sucesso'; resposta: SolicitacaoCriada; laboratorio: string }
interface Registro { escopo: string; estado: EstadoEnvio }

function restaurarRegistro(valor: unknown, escopo: string): Registro | undefined {
  if (!valor || typeof valor !== 'object' || !('escopo' in valor) || valor.escopo !== escopo) return undefined
  const incerto: Registro = { escopo, estado: { tipo: 'erro', incerto: true, mensagem: 'Há uma tentativa anterior sem confirmação nesta navegação.' } }
  if (!('estado' in valor) || !valor.estado || typeof valor.estado !== 'object' || !('tipo' in valor.estado)) return incerto
  const e = valor.estado
  if (e.tipo === 'verificando' || e.tipo === 'enviando') return incerto
  if (e.tipo === 'erro' && 'incerto' in e && typeof e.incerto === 'boolean' && 'mensagem' in e && typeof e.mensagem === 'string') {
    return { escopo, estado: { tipo: 'erro', incerto: e.incerto, mensagem: e.mensagem } }
  }
  if (e.tipo === 'sucesso' && 'resposta' in e && 'laboratorio' in e && typeof e.laboratorio === 'string') {
    const r = e.resposta as Partial<SolicitacaoCriada> | null
    const h = r?.horarios?.[0]
    if (r && Number.isSafeInteger(r.id) && r.id! > 0 && typeof r.status === 'string' && typeof r.finalidade === 'string'
      && h && typeof h.data_reserva === 'string' && typeof h.hora_inicio === 'string' && typeof h.hora_fim === 'string') return valor as Registro
  }
  return incerto
}

/** A trava é síncrona; um marcador em history.state impede reenvio ao remontar a tela. */
export function useEnvioSolicitacao(escopo: string, idUsuario: number | undefined) {
  const location = useLocation()
  const navigate = useNavigate()
  const inicial = location.state && typeof location.state === 'object' && 'envioSolicitacao' in location.state
    ? restaurarRegistro(location.state.envioSolicitacao, escopo) : undefined
  const [registro, setRegistro] = useState<Registro | undefined>(() => inicial)
  const trava = useRef(false)
  const contexto = useRef({ escopo, pathname: location.pathname, search: location.search, state: location.state })
  contexto.current = { escopo, pathname: location.pathname, search: location.search, state: location.state }
  const montado = useRef(true)
  const controle = useRef<AbortController | null>(null)
  useEffect(() => {
    montado.current = true
    return () => { montado.current = false; controle.current?.abort() }
  }, [])
  useEffect(() => { controle.current?.abort(); trava.current = false }, [escopo])
  const estado: EstadoEnvio = registro?.escopo === escopo ? registro.estado : { tipo: 'ocioso' }
  const efetivo: EstadoEnvio = !trava.current && ['verificando', 'enviando'].includes(estado.tipo)
    ? { tipo: 'erro', incerto: true, mensagem: 'Há uma tentativa anterior sem confirmação nesta navegação.' } : estado
  const bloqueado = efetivo.tipo === 'sucesso' || (efetivo.tipo === 'erro' && efetivo.incerto)
  const publicar = (atual: EstadoEnvio, escopoEnvio: string) => {
    if (!montado.current || contexto.current.escopo !== escopoEnvio) return
    const novo = { escopo: escopoEnvio, estado: atual }
    setRegistro(novo)
    const c = contexto.current
    try {
      navigate(c.pathname + c.search, { replace: true, state: { ...(c.state && typeof c.state === 'object' ? c.state : {}), envioSolicitacao: novo } })
    } catch {
      // Falhar antes da transmissão impede o POST. Após resposta, mantém o
      // sucesso/erro local e nunca transforma confirmação em permissão de reenvio.
      if (atual.tipo === 'verificando' || atual.tipo === 'enviando') {
        throw new Error('Não foi possível atualizar a navegação antes do envio. Nenhuma criação foi enviada.')
      }
    }
  }
  const enviar = async (preparar: (signal: AbortSignal) => Promise<{ payload: CriarSolicitacaoEspaco; laboratorio: string }>) => {
    if (trava.current || bloqueado || idUsuario === undefined) return
    trava.current = true
    const escopoEnvio = escopo
    const abort = new AbortController()
    controle.current = abort
    try {
      publicar({ tipo: 'verificando' }, escopoEnvio)
      const { payload, laboratorio } = await preparar(abort.signal)
      abort.signal.throwIfAborted()
      const resposta = await criarSolicitacao(payload, { idUsuario, signal: abort.signal,
        aoTransmitir: () => publicar({ tipo: 'enviando' }, escopoEnvio) })
      publicar({ tipo: 'sucesso', resposta, laboratorio }, escopoEnvio)
    } catch (erro) {
      const falha = erro instanceof ErroCriacaoSolicitacao ? erro
        : new ErroCriacaoSolicitacao(erro instanceof Error ? erro.message : 'Não foi possível revalidar a seleção. Nenhuma criação foi enviada.', 'nao-enviado')
      publicar({ tipo: 'erro', mensagem: falha.message, incerto: falha.resultado === 'incerto' }, escopoEnvio)
    } finally {
      if (contexto.current.escopo === escopoEnvio) trava.current = false
    }
  }
  return { estado: efetivo, enviar, bloqueado, ocupado: efetivo.tipo === 'verificando' || efetivo.tipo === 'enviando' }
}
