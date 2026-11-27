import type { RecursoResposta } from '../types/espaco'

export function RecursosEspaco({ recursos, compacto = false }: { recursos: RecursoResposta[]; compacto?: boolean }) {
  return recursos.length ? <ul className={compacto ? "detail-resources detail-resources--compact" : "detail-resources"}>{recursos.map(recurso => <li className="detail-resources__item" key={recurso.id}>
                <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">{/(computador|notebook)/i.test(recurso.nome + ' ' + recurso.tipo) ? <><rect x="3" y="4" width="18" height="13" /><path d="M12 17v3m-4 0h8" /></> : <><path d="M4 7 12 3l8 4v10l-8 4-8-4V7Z" /><path d="m4 7 8 4 8-4M12 11v10" /></>}</svg>
                <div><strong>{recurso.nome.trim() || 'Recurso sem nome informado'}</strong>
                  <p>{recurso.tipo.trim() ? `${recurso.tipo} · ` : ''}{recurso.disponibilidade ? 'Disponível' : 'Indisponível'}{recurso.autorizacao_necessaria ? ' · Requer autorização' : ''}</p>
                </div>
              </li>)}</ul> : <p>Nenhum recurso informado.</p>
}
