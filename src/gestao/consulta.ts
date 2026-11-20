import { useCallback, useEffect, useState } from 'react'

export function mensagem(erro: unknown) {
  return erro instanceof Error ? erro.message : 'Não foi possível concluir a operação.'
}

export function useConsulta<T>(carregar: (signal: AbortSignal) => Promise<T>, revalidarAoVoltar = false) {
  const [versao, setVersao] = useState(0)
  const [resultado, setResultado] = useState<{ carregar: typeof carregar; versao: number; dados?: T; erro?: string }>()
  const atualizar = useCallback(() => setVersao(n => n + 1), [])

  useEffect(() => {
    const controle = new AbortController()
    let pendente = false
    async function consultar() {
      if (pendente) return
      pendente = true
      try {
        const dados = await carregar(controle.signal)
        if (!controle.signal.aborted) setResultado({ carregar, versao, dados })
      } catch (erro) {
        if (!controle.signal.aborted) setResultado({ carregar, versao, erro: mensagem(erro) })
      } finally {
        pendente = false
      }
    }
    function aoVoltar() {
      if (document.visibilityState === 'visible') void consultar()
    }
    if (revalidarAoVoltar) {
      window.addEventListener('focus', aoVoltar)
      document.addEventListener('visibilitychange', aoVoltar)
    }
    void consultar()
    return () => {
      controle.abort()
      window.removeEventListener('focus', aoVoltar)
      document.removeEventListener('visibilitychange', aoVoltar)
    }
  }, [carregar, versao, revalidarAoVoltar])

  const atual = resultado?.carregar === carregar && resultado.versao === versao ? resultado : undefined
  return { dados: atual?.dados, erro: atual?.erro, atualizar }
}
