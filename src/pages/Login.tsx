import { useState, type ChangeEvent, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { autenticarUsuario } from '../services/autenticacao'
import '../styles/login.css'

export function Login() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState('')
  const [carregando, setCarregando] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const identificacao = email.trim()
    if (!identificacao || !senha) {
      setErro('Preencha o e-mail e a senha para continuar.')
      return
    }

    setErro('')
    setCarregando(true)

    try {
      await autenticarUsuario(identificacao, senha)
      navigate('/', { replace: true })
    } catch (erroLogin) {
      setErro(erroLogin instanceof Error ? erroLogin.message : 'Não foi possível entrar. Tente novamente.')
    } finally {
      setCarregando(false)
    }
  }

  return (
    <main className="login-page">
      <section className="login-hero" aria-label="Apresentação do LabAgenda">
        <div className="login-brand" aria-label="LabAgenda">
          <span className="login-brand__mark" aria-hidden="true">L</span>
          <span className="login-brand__name">LabAgenda</span>
        </div>

        <div className="login-hero__copy">
          <h1>
            Reserve laboratórios
            <br />
            com clareza e organização.
          </h1>
          <p>
            Consulte a disponibilidade, solicite horários e acompanhe o status dos seus agendamentos.
          </p>
        </div>
      </section>

      <section className="login-content" aria-label="Acesso ao sistema">
        <div className="login-card">
          <div className="login-card__header">
            <h2>Entrar</h2>
            <p>Acesse sua conta para solicitar um agendamento.</p>
          </div>

          <form className="login-form" onSubmit={handleSubmit} noValidate>
            <label className="login-field">
              <span>E-mail</span>
              <input
                type="email"
                name="email"
                placeholder="seuemail@ifal.edu.br"
                autoComplete="email"
                value={email}
                onChange={(event: ChangeEvent<HTMLInputElement>) => setEmail(event.target.value)}
                disabled={carregando}
                aria-invalid={Boolean(erro)}
              />
            </label>

            <label className="login-field">
              <span>Senha</span>
              <input
                type="password"
                name="senha"
                placeholder="••••••••"
                autoComplete="current-password"
                value={senha}
                onChange={(event: ChangeEvent<HTMLInputElement>) => setSenha(event.target.value)}
                disabled={carregando}
                aria-invalid={Boolean(erro)}
              />
            </label>

            <button className="login-link" type="button">
              Esqueci minha senha
            </button>

            {erro && (
              <p className="login-error" role="alert" aria-live="polite">
                {erro}
              </p>
            )}

            <button className="login-submit" type="submit" disabled={carregando}>
              {carregando ? 'Entrando...' : 'Entrar'}
            </button>

            <div className="login-divider" aria-hidden="true">
              <span />
              <small>ou</small>
              <span />
            </div>

            <p className="login-signup">
              Ainda não tem conta?
              <button type="button">Criar conta</button>
            </p>
          </form>
        </div>
      </section>
    </main>
  )
}
