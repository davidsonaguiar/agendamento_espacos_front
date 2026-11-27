import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { listarEspacos } from '../services/espacos'
import { consultarHorarios } from '../services/disponibilidade'
import { obterTokenAcesso } from '../services/autenticacao'
import { ErroHttp } from '../services/http'
import { adaptarEspaco } from '../data/catalogoEspacos'
import type { EspacoCatalogo } from '../types/espaco'
import type { IntervaloDisponivel } from '../data/disponibilidade'

type Estado = { tipo: 'carregando' } | { tipo: 'erro'; mensagem: string }
  | { tipo: 'pronto'; espaco: EspacoCatalogo | undefined; intervalos: IntervaloDisponivel[] }

/** A chave também invalida o estado durante o render, antes do cleanup do efeito. */
export function useDisponibilidadeEspaco(id: string, inicio: string | null, fim: string) {
  const [tentativa, setTentativa] = useState(0)
  const chave = `${id}/${inicio}/${fim}/${tentativa}`
  const [resultado, setResultado] = useState<{ chave: string; estado: Estado }>()
  const navigate = useNavigate()
  const location = useLocation()
  const destino = useRef('')
  destino.current = location.pathname + location.search
  useEffect(() => {
    const controle = new AbortController()
    let ativo = true
    const publicar = (estado: Estado) => {
      if (ativo && !controle.signal.aborted) setResultado({ chave, estado })
    }
    publicar({ tipo: 'carregando' })
    void (async () => {
      const espacos = await listarEspacos(controle.signal)
      controle.signal.throwIfAborted()
      const resposta = espacos.find(e => String(e.id) === id)
      const espaco = resposta ? adaptarEspaco(resposta) : undefined
      const intervalos = espaco?.disponivel && inicio
        ? await consultarHorarios(espaco.id, inicio, fim, controle.signal) : []
      controle.signal.throwIfAborted()
      if (!obterTokenAcesso()) throw new ErroHttp('http', 'Sua sessão expirou. Entre novamente.', 401)
      publicar({ tipo: 'pronto', espaco, intervalos })
    })().catch((erro: unknown) => {
      if (!ativo || controle.signal.aborted) return
      if (erro instanceof ErroHttp && erro.status === 401 && !obterTokenAcesso()) {
        navigate('/login', { replace: true, state: { aviso: 'Sua sessão expirou. Entre novamente.', destino: destino.current } })
        return
      }
      publicar({ tipo: 'erro', mensagem: erro instanceof Error ? erro.message : 'Não foi possível consultar a disponibilidade.' })
    })
    return () => { ativo = false; controle.abort() }
  }, [id, inicio, fim, chave, navigate])
  const estado: Estado = resultado?.chave === chave ? resultado.estado : { tipo: 'carregando' }
  return { estado, tentarNovamente: () => setTentativa(n => n + 1) }
}
