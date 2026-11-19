import { useEffect, useState } from 'react'
import { listarMinhasSolicitacoes } from '../services/solicitacoes'
import { obterUsuarioAutenticado } from '../services/autenticacao'
import { ErroHttp } from '../services/http'
import { chaveSessaoConsulta, useSessaoConsulta } from './useSessaoConsulta'
import type { SolicitacaoConsulta } from '../types/solicitacaoConsulta'

type Estado = { tipo: 'carregando' } | { tipo: 'sessao-invalida' }
  | { tipo: 'erro'; mensagem: string } | { tipo: 'pronto'; solicitacoes: SolicitacaoConsulta[] }
export function useMinhasSolicitacoes() {
  const sessao = useSessaoConsulta()
  const [tentativa, setTentativa] = useState(0)
  const chave = JSON.stringify([sessao, tentativa])
  const [resultado, setResultado] = useState<{ chave: string; estado: Estado }>()
  useEffect(() => {
    const controle = new AbortController()
    let ativo = true
    const publicar = (estado: Estado) => {
      if (ativo && !controle.signal.aborted && chaveSessaoConsulta() === sessao) setResultado({ chave, estado })
    }
    publicar(sessao ? { tipo: 'carregando' } : { tipo: 'sessao-invalida' })
    if (sessao) void listarMinhasSolicitacoes(controle.signal).then(
      solicitacoes => publicar({ tipo: 'pronto', solicitacoes }),
      erro => publicar(erro instanceof ErroHttp && erro.status === 401 ? { tipo: 'sessao-invalida' }
        : { tipo: 'erro', mensagem: erro instanceof Error ? erro.message : 'Não foi possível consultar suas solicitações.' }),
    )
    return () => { ativo = false; controle.abort() }
  }, [chave, sessao])
  // A chave invalida o resultado no render, antes do cleanup do efeito. A seleção
  // adicional impede apresentar terceiros mesmo diante de estado incompatível.
  const estado: Estado = !sessao ? { tipo: 'sessao-invalida' }
    : resultado?.chave === chave ? resultado.estado : { tipo: 'carregando' }
  const id = obterUsuarioAutenticado()?.id
  return { estado: estado.tipo === 'pronto' ? { ...estado, solicitacoes: estado.solicitacoes.filter(s => s.id_solicitante === id) } : estado,
    atualizar: () => setTentativa(n => n + 1) }
}
