
import { useEffect, useState } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import {
  encerrarSessao,
  obterExpiracaoToken,
  obterTokenAcesso,
  verificarSessao,
} from '../services/autenticacao'

type EstadoSessao =
  | 'verificando'
  | 'autorizado'
  | 'sem-sessao'
  | 'indisponivel'

export function RotaProtegida() {
  const location = useLocation()
  const [estado, setEstado] = useState<EstadoSessao>('verificando')
  const [tentativa, setTentativa] = useState(0)

  useEffect(() => {
    let ativo = true
    let temporizador: ReturnType<typeof setTimeout> | undefined

    setEstado('verificando')

    async function conferir() {
      try {
        const usuario = await verificarSessao()

        if (!ativo) return

        if (!usuario) {
          setEstado('sem-sessao')
          return
        }

        setEstado('autorizado')

        // A rota expira também com a página aberta,
        // sem depender de uma atualização.
        const expiracao = obterExpiracaoToken(obterTokenAcesso())

        if (expiracao !== null) {
          temporizador = setTimeout(() => {
            encerrarSessao()

            if (ativo) {
              setEstado('sem-sessao')
            }
          }, Math.max(0, expiracao - Date.now()))
        }
      } catch {
        if (ativo) {
          setEstado('indisponivel')
        }
      }
    }

    void conferir()

    return () => {
      ativo = false

      if (temporizador !== undefined) {
        clearTimeout(temporizador)
      }
    }
  }, [location.pathname, tentativa])

  if (estado === 'verificando') {
    return (
      <main className="access-feedback" role="status">
        Verificando sua sessão...
      </main>
    )
  }

  if (estado === 'sem-sessao') {
    return (
      <Navigate
        to="/login"
        replace
        state={{ aviso: 'Faça login para acessar o sistema.' }}
      />
    )
  }

  if (estado === 'indisponivel') {
    return (
      <main className="access-feedback" role="alert">
        <h1>Não foi possível verificar sua sessão</h1>
        <p>Verifique sua conexão com a API do COLAB.</p>
        <button
          type="button"
          onClick={() => setTentativa(n => n + 1)}
        >
          Tentar novamente
        </button>
      </main>
    )
  }

  return <Outlet />
}
