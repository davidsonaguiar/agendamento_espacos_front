import { useEffect, useState } from 'react'
import { Link, Navigate, Outlet, useLocation } from 'react-router-dom'
import { ANTECEDENCIA_RENOVACAO_MS, obterExpiracaoToken, obterTokenAcesso, verificarSessao } from '../services/autenticacao'

type EstadoSessao = 'verificando' | 'autorizado' | 'sem-sessao' | 'sem-permissao' | 'indisponivel'

export function RotaProtegida({ somenteAdministrador = false }: { somenteAdministrador?: boolean } = {}) {
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
        if (!usuario || !obterTokenAcesso()) {
          setEstado('sem-sessao')
          return
        }
        setEstado(somenteAdministrador && usuario.perfil !== 'Administrador' ? 'sem-permissao' : 'autorizado')
        const expiracao = obterExpiracaoToken(obterTokenAcesso())
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
    const aoMostrar = () => { if (document.visibilityState === 'visible') aoFocar() }
    window.addEventListener('focus', aoFocar)
    document.addEventListener('visibilitychange', aoMostrar)
    void conferir()
    return () => {
      ativo = false
      window.removeEventListener('focus', aoFocar)
      document.removeEventListener('visibilitychange', aoMostrar)
      if (temporizador !== undefined) clearTimeout(temporizador)
    }
  }, [location.pathname, tentativa, somenteAdministrador])

  if (estado === 'verificando') {
    return <main className="access-feedback" role="status">Verificando sua sessão...</main>
  }
  if (estado === 'sem-sessao') {
    return <Navigate to="/login" replace state={{ aviso: 'Faça login para acessar o sistema.', destino: location.pathname + location.search }} />
  }
  if (estado === 'sem-permissao') {
    return <main className="access-feedback" role="alert">
      <h1>Acesso restrito</h1>
      <p>O painel visual está disponível somente para administradores nesta etapa.</p>
      <Link to="/">Voltar ao catálogo</Link>
    </main>
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
