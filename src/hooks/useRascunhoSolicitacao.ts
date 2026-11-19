import { useLocation, useNavigate } from 'react-router-dom'
import { obterUsuarioAutenticado } from '../services/autenticacao'

/** Somente history.state: não usa URL, localStorage ou sessionStorage para o texto. */
export function useRascunhoSolicitacao(idEspaco: string) {
  const location = useLocation()
  const navigate = useNavigate()
  const idUsuario = obterUsuarioAutenticado()?.id
  const state: unknown = location.state
  const rascunho = state && typeof state === 'object' && 'rascunhoSolicitacao' in state
    ? state.rascunhoSolicitacao : null
  const finalidade = idUsuario !== undefined && rascunho && typeof rascunho === 'object'
    && 'idUsuario' in rascunho && rascunho.idUsuario === idUsuario
    && 'idEspaco' in rascunho && rascunho.idEspaco === idEspaco
    && 'finalidade' in rascunho && typeof rascunho.finalidade === 'string'
    ? rascunho.finalidade : ''
  const base = state && typeof state === 'object' ? state : {}
  const estadoNavegacao = { ...base, rascunhoSolicitacao: { idEspaco, idUsuario, finalidade } }
  return {
    finalidade, idUsuario, estadoNavegacao,
    alterarFinalidade: (texto: string) => navigate(location.pathname + location.search, {
      replace: true,
      state: { ...base, rascunhoSolicitacao: { idEspaco, idUsuario, finalidade: texto } },
    }),
  }
}
