import { useEffect, useState } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { ANTECEDENCIA_RENOVACAO_MS, obterExpiracaoToken, verificarSessao } from '../services/autenticacao'

type EstadoSessao = 'verificando' | 'autorizado' | 'sem-sessao' | 'indisponivel'

export function RotaProtegida() {
  const location = useLocation()
  const [estado, setEstado] = useState<EstadoSessao>('verificando')
  const [tentativa, setTentativa] = useState(0)

  useEffect(() => {
    let ativo = true
    let conferindo = false
    let temporizador: ReturnType<typeof setTimeout> | undefined

    async function conferir(exibirCarregamento = true) {
      if (!ativo || conferindo) return
      conferindo = true
      if (temporizador !== undefined) clearTimeout(temporizador)
      if (exibirCarregamento) setEstado('verificando')
      try {
        const usuario = await verificarSessao()
        if (!ativo) return
        if (!usuario) {
          setEstado('sem-sessao')
          return
        }
        setEstado('autorizado')
        const expiracao = obterExpiracaoToken()
        if (expiracao !== null) {
          // Renova antes do vencimento, evitando expirar durante uma página aberta.
          const atraso = Math.max(1_000, expiracao - Date.now() - ANTECEDENCIA_RENOVACAO_MS)
          temporizador = setTimeout(() => { void conferir(false) }, atraso)
        }
      } catch {
        if (ativo) setEstado('indisponivel')
      } finally {
        conferindo = false
      }
    }

    const aoFocar = () => { void conferir(false) }
    const aoMostrar = () => {
      if (document.visibilityState === 'visible') aoFocar()
    }
    window.addEventListener('focus', aoFocar)
    document.addEventListener('visibilitychange', aoMostrar)
    void conferir()
    return () => {
      ativo = false
      window.removeEventListener('focus', aoFocar)
      document.removeEventListener('visibilitychange', aoMostrar)
      if (temporizador !== undefined) clearTimeout(temporizador)
    }
  }, [location.pathname, tentativa])

  if (estado === 'verificando') {
    return <main className="access-feedback" role="status">Verificando sua sessão...</main>
  }
  if (estado === 'sem-sessao') {
    return <Navigate to="/login" replace state={{ aviso: 'Faça login para acessar o sistema.', destino: location.pathname + location.search }} />
  }
  if (estado === 'indisponivel') {
    return <main className="access-feedback" role="alert">
      <h1>Não foi possível verificar sua sessão</h1>
      <p>Verifique sua conexão com a API do COLAB.</p>
      <button type="button" onClick={() => setTentativa(n => n + 1)}>Tentar novamente</button>
    </main>
  }
  return <Outlet />
}
