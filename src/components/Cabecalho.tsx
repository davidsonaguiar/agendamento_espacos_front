import { Link, NavLink, useLocation } from 'react-router-dom'

export function Cabecalho({ perfil = 'usuario' }: { perfil?: 'usuario' | 'gestor' }) {
  const { pathname } = useLocation()
  const secaoLaboratorios = pathname === '/' || pathname.startsWith('/laboratorios/')
  return (
    <header className="site-header">
      <div className="site-header__inner">
        <Link className="brand" to="/" aria-label="LabAgenda — início">
          <span className="brand__mark" aria-hidden="true">L</span>
          <span className="brand__name">LabAgenda</span>
        </Link>
        <nav className="site-nav" aria-label="Navegação principal">
          <Link className={`site-nav__link${secaoLaboratorios ? ' site-nav__link--active' : ''}`} to="/" aria-current={pathname === '/' ? 'page' : secaoLaboratorios ? 'location' : undefined}>
            Laboratórios
          </Link>
          <NavLink className={({ isActive }) => `site-nav__link${isActive ? ' site-nav__link--active' : ''}`} to="/meus-agendamentos">Agendamentos</NavLink>
          <NavLink className={({ isActive }) => `site-nav__link${isActive ? ' site-nav__link--active' : ''}`} to="/admin">Painel do gestor</NavLink>
          <span className="user-avatar" aria-label={perfil === 'gestor' ? 'Perfil de gestor' : 'Perfil de usuário'} title={perfil === 'gestor' ? 'Gestor' : 'Perfil'}>
            {perfil === 'gestor' ? 'GM' : 'UE'}
          </span>
        </nav>
      </div>
    </header>
  )
}
