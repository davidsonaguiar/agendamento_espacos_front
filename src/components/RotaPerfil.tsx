import { Link, Outlet } from 'react-router-dom'
import { useAcessoGestor } from '../gestao/contextoGestor'

export function RotaPerfil() {
  const acesso = useAcessoGestor()
  if (!acesso) return null
  if (!acesso.administrador && acesso.espacos?.length === 0) {
    return (
      <main className="access-feedback" role="alert">
        <h1>Acesso restrito</h1>
        <p>Seu perfil não tem permissão para acessar esta área.</p>
        <Link to="/">Voltar ao catálogo</Link>
      </main>
    )
  }

  return <Outlet />
}
