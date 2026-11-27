import { Link } from 'react-router-dom'
import type { Laboratorio } from '../types/laboratorio'

interface CartaoLaboratorioProps {
  laboratorio: Laboratorio
}

function IconeComputador() {
  return (
    <svg aria-hidden="true" viewBox="0 0 36 36" fill="none">
      <rect x="3" y="5" width="30" height="21" stroke="currentColor" strokeWidth="2.5" />
      <path d="M18 26v5m-7 0h14" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  )
}

function IconeLocalizacao() {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" fill="none">
      <path d="M16 8.3c0 4.1-6 9-6 9s-6-4.9-6-9a6 6 0 1 1 12 0Z" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="10" cy="8" r="2" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  )
}

function IconeCapacidade() {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" fill="none">
      <circle cx="7" cy="6" r="3" stroke="currentColor" strokeWidth="1.6" />
      <path d="M1.8 17v-1.2A4.8 4.8 0 0 1 6.6 11h.8a4.8 4.8 0 0 1 4.8 4.8V17M13 3.4a3 3 0 0 1 0 5.8m1.2 2a4.8 4.8 0 0 1 4 4.7V17" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  )
}

export function CartaoLaboratorio({ laboratorio }: CartaoLaboratorioProps) {
  const linkDetalhes = '/laboratorios/' + laboratorio.id

  return (
    <article className="lab-card">
      <div className={'lab-card__banner lab-card__banner--' + laboratorio.tema}>
        <span className="lab-card__icon"><IconeComputador /></span>
        <div>
          <p className="lab-card__banner-title">{laboratorio.nome}</p>
          <p className="lab-card__banner-summary">{laboratorio.resumo}</p>
        </div>
      </div>
      <div className="lab-card__body">
        <h2 className="lab-card__title">{laboratorio.nome}</h2>
        <div className="lab-card__metadata">
          <span className="lab-card__meta-item">
            <IconeLocalizacao />
            <span>{laboratorio.sala ? `${laboratorio.bloco} · ${laboratorio.sala}` : laboratorio.bloco}</span>
          </span>
          <span className="lab-card__meta-item">
            <IconeCapacidade />
            <span>{laboratorio.capacidade === null ? 'Capacidade não informada' : `${laboratorio.capacidade} pessoas`}</span>
          </span>
        </div>
        <div className="lab-card__actions">
          <span className={'availability-pill ' + (laboratorio.disponivel ? 'availability-pill--open' : 'availability-pill--closed')}>
            <span className="availability-pill__dot" aria-hidden="true" />
            {laboratorio.disponivel ? 'Aberto para agendamento' : 'Indisponível no momento'}
          </span>
          <Link className="button button--primary" to={linkDetalhes}>Ver laboratório</Link>
        </div>
      </div>
    </article>
  )
}
