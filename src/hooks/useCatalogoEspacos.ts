import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { adaptarEspaco } from '../data/catalogoEspacos'
import { listarEspacos } from '../services/espacos'
import { encerrarSessao } from '../services/autenticacao'
import { ErroHttp } from '../services/http'
import type { EspacoCatalogo } from '../types/espaco'

type EstadoCatalogo =
  | { tipo: 'carregando' }
  | { tipo: 'pronto'; espacos: EspacoCatalogo[] }
  | { tipo: 'erro'; mensagem: string }

export function useCatalogoEspacos() {
  const navigate = useNavigate()
  const [estado, setEstado] = useState<EstadoCatalogo>({ tipo: 'carregando' })
  const [tentativa, setTentativa] = useState(0)
  useEffect(() => {
    const controle = new AbortController()
    setEstado({ tipo: 'carregando' })
    void listarEspacos(controle.signal).then(espacos => {
      if (!controle.signal.aborted) setEstado({ tipo: 'pronto', espacos: espacos.map(adaptarEspaco) })
    }).catch((erro: unknown) => {
      if (controle.signal.aborted) return
      if (erro instanceof ErroHttp && erro.status === 401) {
        encerrarSessao()
        navigate('/login', { replace: true, state: { aviso: 'Sua sessão expirou. Entre novamente.' } })
        return
      }
      setEstado({ tipo: 'erro', mensagem: erro instanceof ErroHttp && erro.status === 403
        ? 'Você não tem autorização para consultar o catálogo.'
        : erro instanceof Error ? erro.message : 'Não foi possível carregar o catálogo.' })
    })
    return () => controle.abort()
  }, [navigate, tentativa])
  return { estado, tentarNovamente: () => setTentativa(valor => valor + 1) }
}
