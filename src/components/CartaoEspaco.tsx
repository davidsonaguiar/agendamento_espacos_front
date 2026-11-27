import { Link } from 'react-router-dom'
import { CaracteristicasEspaco } from './CaracteristicasEspaco'
import { RecursosEspaco } from './RecursosEspaco'
import type { EspacoCatalogo } from '../types/espaco'

export function CartaoEspaco({ espaco, mostrarLink = true }: { espaco: EspacoCatalogo; mostrarLink?: boolean }) {
  return <article className="lab-card real-space-card">
    <div className="lab-card__body">
      <h2 className="lab-card__title">{espaco.nome}</h2>
      <p>{espaco.descricao?.trim() || 'Descrição não informada.'}</p>
      <CaracteristicasEspaco bloco={espaco.bloco} capacidade={espaco.capacidade} />
      <h3>Recursos do espaço</h3>
      <RecursosEspaco recursos={espaco.recursos} compacto />
      <div className="space-card-status">
        <span className={'availability-pill ' + (espaco.disponivel ? 'availability-pill--open' : 'availability-pill--closed')}><span className="availability-pill__dot" aria-hidden="true" />{espaco.disponivel ? 'Espaço ativo' : 'Espaço indisponível'}</span>
        <p>{espaco.disponivel ? 'Consulte o calendário para conferir os horários disponíveis.' : 'Este espaço está indisponível para agendamento.'}</p>
      </div>
      {mostrarLink && <Link className="button button--primary" to={`/laboratorios/${espaco.id}`}>Ver laboratório</Link>}
    </div>
  </article>
}
