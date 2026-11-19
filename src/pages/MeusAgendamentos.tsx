import { useId, useState } from 'react'
import { Link } from 'react-router-dom'
import { Cabecalho } from '../components/Cabecalho'
import { CartaoSolicitacao } from '../components/CartaoSolicitacao'
import { useMinhasSolicitacoes } from '../hooks/useMinhasSolicitacoes'
import { selecionarSolicitacoes } from '../data/apresentacaoSolicitacoes'
import type { TipoPeriodoSolicitacao, OrdemSolicitacao } from '../data/apresentacaoSolicitacoes'
import { useRelogioLocal } from '../hooks/useRelogioLocal'
import { dataLocal } from '../data/disponibilidade'
import type { StatusOficialSolicitacao } from '../types/solicitacaoConsulta'

type FiltroStatus = 'Todos' | StatusOficialSolicitacao
const filtrosStatus: Array<{ valor: FiltroStatus; rotulo: string }> = [
  { valor: 'Todos', rotulo: 'Todos' }, { valor: 'Pendente', rotulo: 'Pendente' },
  { valor: 'AguardandoComplementacao', rotulo: 'Aguardando complementação' },
  { valor: 'AguardandoRespostaProposta', rotulo: 'Aguardando resposta à proposta' },
  { valor: 'Aprovado', rotulo: 'Aprovado' }, { valor: 'Rejeitado', rotulo: 'Rejeitado' }, { valor: 'Cancelada', rotulo: 'Cancelada' },
]
export function MeusAgendamentos() {
  const [status, setStatus] = useState<FiltroStatus>('Todos')
  const [periodo, setPeriodo] = useState<TipoPeriodoSolicitacao>('todos')
  const [ordem, setOrdem] = useState<OrdemSolicitacao>('crescente')
  const [inicio, setInicio] = useState('')
  const [fim, setFim] = useState('')
  const controlesId = useId()
  const hoje = dataLocal(useRelogioLocal())
  const { estado, atualizar } = useMinhasSolicitacoes()
  const lista = estado.tipo === 'pronto' ? estado.solicitacoes : []
  const { solicitacoes, erro: erroPeriodo } = selecionarSolicitacoes(lista, { tipo: periodo, inicio, fim }, status, ordem, hoje)
  return <div className="agenda-view"><Cabecalho /><main className="page-shell agenda-page">
    <header className="page-intro"><h1>Agendamentos</h1><p>Acompanhe suas solicitações de utilização dos laboratórios.</p></header>
    <p className="agenda-notice" role="note">Os status são retornados pela API. Uma solicitação pendente aguarda análise e não confirma reserva de horário.</p>
    <section className="agenda-controls" aria-labelledby={`${controlesId}-titulo`}>
      <header className="agenda-controls__header"><h2 id={`${controlesId}-titulo`}>Filtrar e ordenar solicitações</h2>
        <button type="button" className="agenda-refresh" onClick={atualizar} aria-busy={estado.tipo === 'carregando'} disabled={estado.tipo === 'carregando' || estado.tipo === 'sessao-invalida'}>
          <svg aria-hidden="true" focusable="false" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 7v5h-5M4 17v-5h5" /><path d="M6 8a7 7 0 0 1 12-2l2 3M4 15l2 3a7 7 0 0 0 12-2" /></svg>
          Atualizar
        </button>
      </header>
    <fieldset className="agenda-filters" aria-controls="agenda-results"><legend>Status da solicitação</legend>
      <div className="agenda-filters__options">{filtrosStatus.map(filtro => <button key={filtro.valor} type="button" className="agenda-filters__button"
        aria-pressed={status === filtro.valor} onClick={() => setStatus(filtro.valor)}>{filtro.rotulo}</button>)}</div>
    </fieldset>
      <div className="agenda-controls__grid">
        <label htmlFor={`${controlesId}-periodo`}><span>Período de utilização</span>
          <select id={`${controlesId}-periodo`} value={periodo} onChange={e => setPeriodo(e.target.value as TipoPeriodoSolicitacao)}>
            <option value="todos">Todos os períodos</option><option value="7dias">Próximos 7 dias</option><option value="30dias">Próximos 30 dias</option>
            <option value="passados">Passados</option><option value="personalizado">Período personalizado</option>
          </select>
        </label>
        <label htmlFor={`${controlesId}-ordem`}><span>Ordenação</span>
          <select id={`${controlesId}-ordem`} value={ordem} onChange={e => setOrdem(e.target.value as OrdemSolicitacao)}>
            <option value="crescente">Data de utilização: crescente</option><option value="decrescente">Data de utilização: decrescente</option>
          </select>
        </label>
      </div>
      {periodo === 'personalizado' && <fieldset className="agenda-controls__custom"><legend>Período personalizado</legend>
        <div className="agenda-controls__grid">
          <label htmlFor={`${controlesId}-inicio`}><span>Data inicial</span><input type="date" id={`${controlesId}-inicio`} required value={inicio}
            onChange={e => setInicio(e.target.value)} aria-invalid={Boolean(erroPeriodo)} aria-describedby={erroPeriodo ? `${controlesId}-erro` : undefined} /></label>
          <label htmlFor={`${controlesId}-fim`}><span>Data final</span><input type="date" id={`${controlesId}-fim`} required value={fim}
            onChange={e => setFim(e.target.value)} aria-invalid={Boolean(erroPeriodo)} aria-describedby={erroPeriodo ? `${controlesId}-erro` : undefined} /></label>
        </div>
      </fieldset>}
      <p className="agenda-controls__help">Períodos por datas locais de utilização, com limites inclusivos. Basta um intervalo corresponder; todos os horários permanecem no cartão.</p>
      {erroPeriodo && <p id={`${controlesId}-erro`} className="agenda-controls__error" role="alert">{erroPeriodo}</p>}
    </section>
    <section id="agenda-results" aria-label="Minhas solicitações" aria-busy={estado.tipo === 'carregando'}>
      {estado.tipo === 'carregando' ? <p role="status">Carregando suas solicitações...</p>
        : estado.tipo === 'sessao-invalida' ? <section role="alert"><p>Sua sessão expirou ou mudou. Entre novamente para consultar suas solicitações.</p><Link to="/login" state={{ destino: '/meus-agendamentos' }}>Entrar novamente</Link></section>
          : estado.tipo === 'erro' ? <section role="alert"><p>{estado.mensagem}</p><button type="button" onClick={atualizar}>Tentar novamente</button></section>
            : erroPeriodo ? <p role="status">Corrija o período para visualizar as solicitações.</p>
            : <><p className="agenda-results-count" role="status">{solicitacoes.length} {solicitacoes.length === 1 ? 'solicitação encontrada' : 'solicitações encontradas'}. Ordenação por data e horário, {ordem}.</p>
              {!lista.length ? <p className="agenda-empty">Você ainda não possui solicitações.</p>
                : !solicitacoes.length ? <p className="agenda-empty">Nenhuma solicitação corresponde aos filtros selecionados. Selecione “Todos” e “Todos os períodos” para voltar à listagem completa.</p>
                  : <ul className="agenda-list">{solicitacoes.map((solicitacao, indice) => <li key={solicitacao.id ?? `solicitacao-${indice}`}><CartaoSolicitacao solicitacao={solicitacao} /></li>)}</ul>}
            </>}
    </section>
  </main></div>
}
