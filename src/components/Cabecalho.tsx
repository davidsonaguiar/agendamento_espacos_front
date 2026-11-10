import { useState } from 'react'
import '../styles/logout.css'
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom'
import { desconectarUsuario, obterUsuarioAutenticado } from '../services/autenticacao'

export function Cabecalho() {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const [saindo, setSaindo] = useState(false)
  const secaoLaboratorios = pathname === '/' || pathname.startsWith('/laboratorios/')
  const usuario = obterUsuarioAutenticado()
  const iniciais = usuario?.nome_completo.split(/\s+/).filter(Boolean).slice(0, 2).map(nome => nome[0].toUpperCase()).join('') ?? 'US'

  async function sair() {
    setSaindo(true)
    let aviso = 'Sessão encerrada.'
    let logoutPendente = false
    try {
      await desconectarUsuario()
    } catch {
      logoutPendente = true
      aviso = 'Dados locais removidos. Não foi possível confirmar o logout no servidor; tente novamente quando a conexão voltar.'
    } finally {
      setSaindo(false)
      navigate('/login', { replace: true, state: { aviso, logoutPendente } })
    }
  }

  return (
    <header className="site-header">
      <div className="site-header__inner">
        <Link className="brand" to="/" aria-label="LabAgenda — início">
          <span className="brand__mark" aria-hidden="true">L</span>
          <span className="brand__name">LabAgenda</span>
        </Link>
        <nav className="site-nav" aria-label="Navegação principal">
          <Link className={`site-nav__link${secaoLaboratorios ? ' site-nav__link--active' : ''}`} to="/" aria-current={pathname === '/' ? 'page' : secaoLaboratorios ? 'location' : undefined}>Laboratórios</Link>
          <NavLink className={({ isActive }) => `site-nav__link${isActive ? ' site-nav__link--active' : ''}`} to="/meus-agendamentos">Agendamentos</NavLink>
          <span className="user-avatar" aria-label="Perfil de usuário" title={usuario?.nome_completo ?? 'Usuário'}>{iniciais}</span>
          <button type="button" className="site-nav__logout" onClick={() => { void sair() }} disabled={saindo}>{saindo ? 'Saindo...' : 'Sair'}</button>
        </nav>
      </div>
    </header>
  )
}
