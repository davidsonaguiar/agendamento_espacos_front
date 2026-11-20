import { useCallback, useState } from 'react'
import { Cabecalho } from '../components/Cabecalho'
import { CartaoSolicitacao } from '../components/CartaoSolicitacao'
import { useLocation } from 'react-router-dom'
import { AvisoConsulta } from '../gestao/Controles'
import { useConsulta } from '../gestao/consulta'
import { minhasSolicitacoes } from '../services/agendamentoAluno'
import { RespostaAluno } from '../components/RespostaAluno'
import { obterUsuarioAutenticado } from '../services/autenticacao'
import { listarSolicitacoesSimuladas, simuladorLocalAtivo } from '../services/simuladorLocal'
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
  const usuario = obterUsuarioAutenticado()?.id
  const location = useLocation()
  const carregar = useCallback(async (signal: AbortSignal) => {
    if (!usuario) throw new Error('Entre novamente para consultar suas solicitações.')
    return simuladorLocalAtivo ? listarSolicitacoesSimuladas(usuario) : minhasSolicitacoes(usuario, signal)
  }, [usuario])
  const consulta = useConsulta(carregar, true)
  const solicitacoes = filtrarEOrdenarSolicitacoes(consulta.dados ?? [], status)

  return <>
    <Cabecalho />
    <main className="page-shell agenda-page">
      <header className="page-intro">
        <h1>Agendamentos</h1>
        <p>Acompanhe as solicitações de utilização dos laboratórios.</p>
      </header>
      {simuladorLocalAtivo && <p className="agenda-notice" role="note">As solicitações de teste ficam neste navegador.</p>}
      {location.state?.aviso && <p role="status">{location.state.aviso}</p>}
      <button className="button button--secondary" onClick={consulta.atualizar}>Atualizar solicitações</button>
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
      {!consulta.dados ? <AvisoConsulta erro={consulta.erro} atualizar={consulta.atualizar} /> : <>
      <p className="agenda-results-count" role="status">{solicitacoes.length} {solicitacoes.length === 1 ? 'solicitação encontrada' : 'solicitações encontradas'}. Ordenação pela data do primeiro horário, crescente.</p>
      <section id="agenda-results" aria-label={simuladorLocalAtivo ? 'Solicitações locais de teste' : 'Minhas solicitações'}>
        {solicitacoes.length > 0 ? <ul className="agenda-list">
          {solicitacoes.map((solicitacao, indice) => <li key={solicitacao.id ?? `solicitacao-${indice}`}>
            <CartaoSolicitacao solicitacao={solicitacao} />
            {!simuladorLocalAtivo && <RespostaAluno solicitacao={solicitacao} atualizar={consulta.atualizar} />}
          </li>)}
        </ul> : <p className="agenda-empty">{simuladorLocalAtivo
          ? 'Você ainda não enviou solicitações neste teste local.'
          : 'Nenhuma solicitação corresponde ao filtro selecionado. Selecione “Todos” para voltar à listagem completa.'}</p>}
      </section></>}
    </main>
  </>
}
