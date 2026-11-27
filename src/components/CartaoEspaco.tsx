import { Link } from 'react-router-dom'
import type { EspacoCatalogo } from '../types/espaco'

export function CartaoEspaco({ espaco, mostrarLink = true }: { espaco: EspacoCatalogo; mostrarLink?: boolean }) {
  return <article className="lab-card real-space-card">
    <div className="lab-card__body">
      <h2 className="lab-card__title">{espaco.nome}</h2>
      <p>{espaco.descricao?.trim() || 'Descrição não informada.'}</p>
      <dl>
        <div><dt>Bloco</dt><dd>{espaco.bloco?.trim() || 'Não informado'}</dd></div>
        <div><dt>Capacidade</dt><dd>{espaco.capacidade === null ? 'Não informada' : `${espaco.capacidade} pessoas`}</dd></div>
      </dl>
      <h3>Recursos associados</h3>
      {espaco.recursos.length ? <ul>{espaco.recursos.map(recurso => <li key={recurso.id}>
        {recurso.nome} — {recurso.disponibilidade ? 'Disponível' : 'Indisponível'}
        {recurso.autorizacao_necessaria ? ' · Requer autorização' : ''}
      </li>)}</ul> : <p>Nenhum recurso informado.</p>}
      <p>Espaço {espaco.disponivel ? 'ativo' : 'indisponível'}. A situação cadastral não confirma horários livres.</p>
      {mostrarLink && <Link className="button button--primary" to={`/laboratorios/${espaco.id}`}>Ver laboratório</Link>}
    </div>
  </article>
}
