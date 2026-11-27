import { useCallback, useMemo, type ReactNode } from 'react'
import { espacosGerenciados, type EspacoGestao } from './api'
import { ContextoGestor } from './contextoGestor'
import { simuladorLocalAtivo } from '../services/sessaoSimulada'
import { useConsulta } from './consulta'
import type { UsuarioAutenticado } from '../types/autenticacao'

export function AcessoGestor({ usuario, children }: { usuario: UsuarioAutenticado; children: ReactNode }) {
  const { id, perfil } = usuario
  // Memoria apenas desta identidade: uma nova conta/perfil nunca herda permissao.
  const confirmada = useMemo<{ espacos?: EspacoGestao[] }>(() => ({}), [id, perfil])
  const carregar = useCallback(async (signal: AbortSignal) => {
    try {
      const espacos = simuladorLocalAtivo ? [] : await espacosGerenciados(id, perfil, signal)
      if (!signal.aborted) confirmada.espacos = espacos
      return espacos
    } catch (erro) {
      // Erro nao autoriza fallback, nem mesmo durante uma tentativa posterior.
      if (!signal.aborted) confirmada.espacos = undefined
      throw erro
    }
  }, [id, perfil, confirmada])
  const { dados, erro, atualizar } = useConsulta(carregar, true)
  // Durante a atualizacao da mesma conta, mantem a ultima confirmacao positiva.
  // A primeira consulta e as falhas continuam bloqueadas por RotaPerfil.
  const espacos = erro === undefined ? dados ?? confirmada.espacos : undefined
  return <ContextoGestor.Provider value={{ administrador: perfil === 'Administrador', espacos, erro, atualizar }}>
    {children}
  </ContextoGestor.Provider>
}
