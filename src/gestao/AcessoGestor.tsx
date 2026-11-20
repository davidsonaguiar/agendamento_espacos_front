import { useCallback, type ReactNode } from 'react'
import { espacosGerenciados } from './api'
import { ContextoGestor } from './contextoGestor'
import { simuladorLocalAtivo } from '../services/sessaoSimulada'
import { useConsulta } from './consulta'
import type { UsuarioAutenticado } from '../types/autenticacao'

export function AcessoGestor({ usuario, children }: { usuario: UsuarioAutenticado; children: ReactNode }) {
  const { id, perfil } = usuario
  const carregar = useCallback((signal: AbortSignal) => simuladorLocalAtivo ? Promise.resolve([]) : espacosGerenciados(id, perfil, signal), [id, perfil])
  const { dados, erro, atualizar } = useConsulta(carregar, true)
  return <ContextoGestor.Provider value={{ administrador: perfil === 'Administrador', espacos: dados, erro, atualizar }}>
    {children}
  </ContextoGestor.Provider>
}
