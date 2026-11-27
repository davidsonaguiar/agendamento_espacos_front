import { useState, type ChangeEvent, type FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { LayoutAutenticacao } from '../components/LayoutAutenticacao'
import { autenticarUsuario, desconectarUsuario } from '../services/autenticacao'
import { simuladorLocalAtivo } from '../services/sessaoSimulada'

/** Retorno restrito às rotas protegidas existentes; nunca aceita outra origem. */
export function destinoAposLogin(valor: unknown): string {
  if (typeof valor !== 'string' || !valor.startsWith('/') || valor.startsWith('//')
    || /[\\\s\u0000-\u001f\u007f]/u.test(valor)) return '/'
  try {
    const url = new URL(valor, 'https://labagenda.invalid')
    if (url.origin !== 'https://labagenda.invalid') return '/'
    // Não retorna às telas de autenticação nem a caminhos desconhecidos.
    if (!/^\/(?:admin|meus-agendamentos|laboratorios\/[1-9]\d*(?:\/agendamento(?:\/detalhes)?)?)?$/.test(url.pathname)) return '/'
    return url.pathname + url.search + url.hash
  } catch { return '/' }
}

export function Login() {
  const navigate = useNavigate()
  const location = useLocation()
  const [identificacao, setIdentificacao] = useState('')
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState('')
  const [carregando, setCarregando] = useState(false)

  const estado = location.state && typeof location.state === 'object'
    ? location.state as { aviso?: unknown; destino?: unknown; logoutPendente?: unknown } : null
  const aviso = typeof estado?.aviso === 'string' ? estado.aviso : undefined
  const destino = destinoAposLogin(estado?.destino)

  async function tentarLogout() {
    setCarregando(true)
    setErro('')
    try {
      await desconectarUsuario()
      navigate('/login', { replace: true, state: { aviso: 'Sessão encerrada.' } })
    } catch (falha) {
      setErro(falha instanceof Error ? falha.message : 'Não foi possível encerrar a sessão.')
    } finally {
      setCarregando(false)
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!identificacao.trim() || !senha) {
      setErro('Preencha a identificação e a senha para continuar.')
      return
    }
    setErro('')
    setCarregando(true)
    try {
      await autenticarUsuario(identificacao.trim(), senha)
      navigate(destino, { replace: true })
    } catch (falha) {
      setErro(falha instanceof Error ? falha.message : 'Não foi possível entrar. Tente novamente.')
    } finally {
      setCarregando(false)
    }
  }

  return (
    <LayoutAutenticacao>
      <div className="login-card__header">
        <h2>Entrar</h2>
        <p>Acesse sua conta para solicitar um agendamento.</p>
      </div>
      <form className="login-form" onSubmit={handleSubmit}>
        {aviso && <p className="login-notice" role="status">{aviso}</p>}
        {simuladorLocalAtivo && <p className="login-notice" role="note">
          Simulador local ativo. Utilize somente contas fictícias; este modo não autentica na API.
        </p>}
        {estado?.logoutPendente === true && <button type="button" className="login-submit" disabled={carregando} onClick={() => { void tentarLogout() }}>Tentar encerrar sessão novamente</button>}
        <label className="login-field">
          <span>E-mail ou CPF</span>
          <input
            type="text" name="identificacao" placeholder="seuemail@ifal.edu.br"
            autoComplete="username" value={identificacao}
            onChange={(event: ChangeEvent<HTMLInputElement>) => setIdentificacao(event.target.value)}
            disabled={carregando} required
          />
        </label>
        <label className="login-field">
          <span>Senha</span>
          <input
            type="password" name="senha" placeholder="••••••••"
            autoComplete="current-password" value={senha}
            onChange={(event: ChangeEvent<HTMLInputElement>) => setSenha(event.target.value)}
            disabled={carregando} required
          />
        </label>
        <Link className="login-link" to="/recuperar-senha">Esqueci minha senha</Link>
        {erro && <p className="login-error" role="alert" aria-live="polite">{erro}</p>}
        <button className="login-submit" type="submit" disabled={carregando}>
          {carregando ? 'Entrando...' : 'Entrar'}
        </button>
        <div className="login-divider" aria-hidden="true"><span /><small>ou</small><span /></div>
        <p className="login-signup">Ainda não tem conta? <Link to="/cadastro">Criar conta</Link></p>
      </form>
    </LayoutAutenticacao>
  )
}
