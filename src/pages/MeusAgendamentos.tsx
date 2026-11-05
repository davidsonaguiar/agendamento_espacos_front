import { Cabecalho } from '../components/Cabecalho'
import { CartaoSolicitacao } from '../components/CartaoSolicitacao'
import { minhaAgendaDemonstrativa } from '../data/minhaAgendaDemonstrativa'

export function MeusAgendamentos() {
  return <>
    <Cabecalho />
    <main className="page-shell agenda-page">
      <header className="page-intro">
        <h1>Agendamentos</h1>
        <p>Acompanhe as solicitações de utilização dos laboratórios.</p>
      </header>
      <p className="agenda-notice" role="note">Registros demonstrativos e fictícios, sem consulta à API. Nenhuma solicitação foi enviada por esta página; os status apresentados não comprovam reservas confirmadas.</p>
      <section aria-label="Solicitações demonstrativas">
        <ul className="agenda-list">
          {minhaAgendaDemonstrativa.map((solicitacao, indice) => <li key={solicitacao.id ?? `solicitacao-${indice}`}>
            <CartaoSolicitacao solicitacao={solicitacao} />
          </li>)}
        </ul>
      </section>
    </main>
  </>
}
