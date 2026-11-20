import { createContext, useContext } from 'react'
import type { EspacoGestao } from './api'

export const ContextoGestor = createContext<{
  administrador: boolean
  espacos?: EspacoGestao[]
  erro?: string
  atualizar: () => void
} | null>(null)

export const useAcessoGestor = () => useContext(ContextoGestor)
