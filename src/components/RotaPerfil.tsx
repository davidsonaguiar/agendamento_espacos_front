import { Link, Outlet } from 'react-router-dom'
import { obterUsuarioAutenticado } from '../services/autenticacao'
import type { PerfilUsuario } from '../types/autenticacao'

export function RotaPerfil({ perfil }: { perfil: PerfilUsuario }) {
  const usuario = obterUsuarioAutenticado()

  if (usuario?.perfil !== perfil) {
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
