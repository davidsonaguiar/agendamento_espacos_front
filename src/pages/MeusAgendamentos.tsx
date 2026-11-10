import { useState } from 'react'
import { Cabecalho } from '../components/Cabecalho'
import { CartaoSolicitacao } from '../components/CartaoSolicitacao'
import { minhaAgendaDemonstrativa } from '../data/minhaAgendaDemonstrativa'
import type { SolicitacaoResposta, StatusSolicitacao } from '../types/solicitacao'

type FiltroStatus = 'Todos' | StatusSolicitacao

const filtrosStatus: Array<{ valor: FiltroStatus; rotulo: string }> = [
  { valor: 'Todos', rotulo: 'Todos' },
  { valor: 'Pendente', rotulo: 'Pendente' },
  { valor: 'AguardandoComplementacao', rotulo: 'Aguardando complementação' },
  { valor: 'AguardandoRespostaProposta', rotulo: 'Aguardando resposta à proposta' },
  { valor: 'Aprovado', rotulo: 'Aprovado' },
  { valor: 'Rejeitado', rotulo: 'Rejeitado' },
  { valor: 'Cancelada', rotulo: 'Cancelada' },
]

function filtrarEOrdenarSolicitacoes(solicitacoes: readonly SolicitacaoResposta[], status: FiltroStatus): SolicitacaoResposta[] {
  // Primeiro horário na ordem recebida, por data ISO crescente (sem conversão de fuso).
  // Sem horários: ao final. Empates: ID crescente (null ao final), depois posição original.
  // A cópia preserva a coleção e a ordem dos intervalos de cada solicitação.
  return solicitacoes.map((solicitacao, indice) => ({ solicitacao, indice }))
    .filter(({ solicitacao }) => status === 'Todos' || solicitacao.status === status)
    .sort((a, b) => {
      const dataA = a.solicitacao.horarios[0]?.data_reserva ?? '9999-99-99'
      const dataB = b.solicitacao.horarios[0]?.data_reserva ?? '9999-99-99'
      if (dataA !== dataB) return dataA < dataB ? -1 : 1
      const idA = a.solicitacao.id ?? Number.MAX_SAFE_INTEGER
      const idB = b.solicitacao.id ?? Number.MAX_SAFE_INTEGER
      return idA - idB || a.indice - b.indice
    })
    .map(({ solicitacao }) => solicitacao)
}

export function MeusAgendamentos() {
  const [status, setStatus] = useState<FiltroStatus>('Todos')
  const solicitacoes = filtrarEOrdenarSolicitacoes(minhaAgendaDemonstrativa, status)

  // Carregamento e erro de API serão tratados na integração; aqui só há dados locais.
  return <>
    <Cabecalho />
    <main className="page-shell agenda-page">
      <header className="page-intro">
        <h1>Agendamentos</h1>
        <p>Acompanhe as solicitações de utilização dos laboratórios.</p>
      </header>
      <p className="agenda-notice" role="note">Registros demonstrativos e fictícios, sem consulta à API. Nenhuma solicitação foi enviada por esta página; os status apresentados não comprovam reservas confirmadas.</p>
      <fieldset className="agenda-filters" aria-controls="agenda-results">
        <legend>Filtrar por status</legend>
        <div className="agenda-filters__options">
          {filtrosStatus.map(filtro => <button
            key={filtro.valor}
            type="button"
            className="agenda-filters__button"
            aria-pressed={status === filtro.valor}
            onClick={() => setStatus(filtro.valor)}
          >{filtro.rotulo}</button>)}
        </div>
      </fieldset>
      <p className="agenda-results-count" role="status">{solicitacoes.length} {solicitacoes.length === 1 ? 'solicitação encontrada' : 'solicitações encontradas'}. Ordenação pela data do primeiro horário, crescente.</p>
      <section id="agenda-results" aria-label="Solicitações demonstrativas">
        {solicitacoes.length > 0 ? <ul className="agenda-list">
          {solicitacoes.map((solicitacao, indice) => <li key={solicitacao.id ?? `solicitacao-${indice}`}>
            <CartaoSolicitacao solicitacao={solicitacao} />
          </li>)}
        </ul> : <p className="agenda-empty">Nenhuma solicitação corresponde ao filtro selecionado. Selecione “Todos” para voltar à listagem completa.</p>}
      </section>
    </main>
  </>
}
