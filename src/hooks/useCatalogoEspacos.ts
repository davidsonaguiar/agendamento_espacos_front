import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { adaptarEspaco } from '../data/catalogoEspacos'
import { listarEspacos } from '../services/espacos'
import { obterTokenAcesso } from '../services/autenticacao'
import { ErroHttp } from '../services/http'
import type { EspacoCatalogo } from '../types/espaco'

type EstadoCatalogo =
  | { tipo: 'carregando' }
  | { tipo: 'pronto'; espacos: EspacoCatalogo[] }
  | { tipo: 'erro'; mensagem: string }

export function useCatalogoEspacos() {
  const navigate = useNavigate()
  const location = useLocation()
  const [estado, setEstado] = useState<EstadoCatalogo>({ tipo: 'carregando' })
  const [tentativa, setTentativa] = useState(0)
  useEffect(() => {
    const controle = new AbortController()
    let ativo = true
    const voltarAoLogin = () => navigate('/login', { replace: true,
      state: { aviso: 'Sua sessão expirou. Entre novamente.', destino: location.pathname + location.search } })
    setEstado({ tipo: 'carregando' })
    void listarEspacos(controle.signal).then(espacos => {
      if (!ativo || controle.signal.aborted) return
      if (!obterTokenAcesso()) { voltarAoLogin(); return }
      setEstado({ tipo: 'pronto', espacos: espacos.map(adaptarEspaco) })
    }).catch((erro: unknown) => {
      if (!ativo || controle.signal.aborted) return
      // O serviço já tentou recuperar o 401. Não limpa uma sessão nova neste hook.
      if (erro instanceof ErroHttp && erro.status === 401) {
        if (!obterTokenAcesso()) voltarAoLogin()
        else setEstado({ tipo: 'erro', mensagem: 'A sessão mudou durante a consulta. Tente carregar o catálogo novamente.' })
        return
      }
      setEstado({ tipo: 'erro', mensagem: erro instanceof ErroHttp && erro.status === 403
        ? 'Você não tem autorização para consultar o catálogo.'
        : erro instanceof Error ? erro.message : 'Não foi possível carregar o catálogo.' })
    })
    return () => { ativo = false; controle.abort() }
  }, [navigate, tentativa, location.pathname, location.search])
  return { estado, tentarNovamente: () => setTentativa(valor => valor + 1) }
}
