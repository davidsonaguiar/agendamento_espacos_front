import type { ReactNode } from 'react'
import '../styles/login.css'

export function LayoutAutenticacao({ children, cadastro = false }: { children: ReactNode; cadastro?: boolean }) {
  return (
    <main className={`login-page${cadastro ? ' login-page--cadastro' : ''}`}>
      <section className="login-hero" aria-label="Apresentação do LabAgenda">
        <div className="login-brand" aria-label="LabAgenda">
          <span className="login-brand__mark" aria-hidden="true">L</span>
          <span className="login-brand__name">LabAgenda</span>
        </div>
        <div className="login-hero__copy">
          <h1>Reserve laboratórios<br />com clareza e organização.</h1>
          <p>Consulte a disponibilidade, solicite horários e acompanhe o status dos seus agendamentos.</p>
        </div>
      </section>
      <section className="login-content" aria-label="Acesso ao sistema">
        <div className="login-card">{children}</div>
      </section>
    </main>
  )
}
