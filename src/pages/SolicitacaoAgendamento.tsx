import { useEffect, useRef } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { Cabecalho } from '../components/Cabecalho'
import { useRelogioLocal } from '../hooks/useRelogioLocal'
import { useDisponibilidadeEspaco } from '../hooks/useDisponibilidadeEspaco'
import { dataLocal, lerData, mesCalendario, periodoMes, horaLocal, exibirHora, intervaloValido, selecaoRealValida, parametrosReais, inicioFuturo } from '../data/disponibilidade'
import type { IntervaloDisponivel } from '../data/disponibilidade'

const formatMonth = (d: Date) => new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(d)
const formatLong = (d: Date) => new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(d)

export function SolicitacaoAgendamento({ id }: { id: string }) {
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const location = useLocation()
  const agora = useRelogioLocal()
  const hoje = dataLocal(agora)
  const mes = mesCalendario(params)
  const periodo = periodoMes(mes, hoje)
  const { estado, tentarNovamente } = useDisponibilidadeEspaco(id, periodo.inicio, periodo.fim)
  const espaco = estado.tipo === 'pronto' ? estado.espaco : undefined
  const intervalos = estado.tipo === 'pronto' ? estado.intervalos.filter(s => inicioFuturo(s.data, s.inicio, agora)) : []
  const data = params.getAll('data').length === 1 ? lerData(params.get('data')) : null
  const dataIso = data ? dataLocal(data) : ''
  const dentro = Boolean(data && data.getFullYear() === mes.getFullYear() && data.getMonth() === mes.getMonth())
  const slots = dentro ? intervalos.filter(s => s.data === dataIso) : []
  const inicio = params.getAll('inicio').length === 1 ? horaLocal(params.get('inicio')!) ?? '' : ''
  const fim = params.getAll('fim').length === 1 ? horaLocal(params.get('fim')!) ?? '' : ''
  const valida = Boolean(espaco?.disponivel && dentro && selecaoRealValida(intervalos, params, agora))
  const primeiroSlotRef = useRef<HTMLButtonElement>(null)
  const focar = useRef(false)
  useEffect(() => {
    if (focar.current && !inicio && !fim) { focar.current = false; primeiroSlotRef.current?.focus() }
  }, [inicio, fim])
  const patch = (valores: Record<string, string | null>) => {
    const next = new URLSearchParams(params)
    for (const [k, v] of Object.entries(valores)) { if (v === null) next.delete(k); else next.set(k, v) }
    setParams(next, { state: location.state })
  }
  const limpar = () => { focar.current = true; patch({ inicio: null, fim: null }) }
  const mudarMes = (delta: number) => {
    const next = new Date(mes.getFullYear(), mes.getMonth() + delta, 1, 12)
    if (next.getFullYear() < 1000 || next.getFullYear() > 9998) return
    patch({ mes: dataLocal(next).slice(0, 7), data: null, inicio: null, fim: null })
  }
  const escolher = (slot: IntervaloDisponivel) => {
    if (!espaco?.disponivel || estado.tipo !== 'pronto' || !inicioFuturo(slot.data, slot.inicio)) return
    if (!inicio || fim || !slots.some(s => s.inicio === inicio)) patch({ inicio: slot.inicio, fim: null })
    else if (intervaloValido(slots, dataIso, inicio, slot.fim)) patch({ fim: slot.fim })
  }
  const offset = (mes.getDay() + 6) % 7
  const grade = Array.from({ length: 42 }, (_, i) => new Date(mes.getFullYear(), mes.getMonth(), 1 - offset + i, 12))
  return <><Cabecalho /><main className="page-shell booking-page">
    <nav className="booking-progress" aria-label="Etapas da solicitação">
      <Link className="booking-progress__step booking-progress__step--complete" to={`/laboratorios/${id}`}>1 · Laboratório</Link>
      <span className="booking-progress__step booking-progress__step--current" aria-current="step">2 · Data e horário</span>
      <span className="booking-progress__step booking-progress__step--upcoming">3 · Prévia</span>
    </nav>
    <header className="booking-intro"><h1>Escolha a data e o horário</h1><p>{espaco ? `Disponibilidade de ${espaco.nome}.` : 'Consulte a disponibilidade do laboratório.'}</p></header>
    <p className="booking-notice" role="note">Disponibilidade consultada na API, sujeita a alterações. A seleção não cria reserva. Revise os dados na próxima etapa antes de enviar a solicitação.</p>
    {estado.tipo === 'carregando' && <p role="status">Carregando disponibilidade...</p>}
    {estado.tipo === 'erro' && <section role="alert"><p>{estado.mensagem}</p><button type="button" onClick={tentarNovamente}>Tentar novamente</button></section>}
    {estado.tipo === 'pronto' && !espaco && <p role="status">Laboratório não encontrado no catálogo acessível à sua conta.</p>}
    {espaco && !espaco.disponivel && <p role="status">Laboratório indisponível para agendamento.</p>}
    <div className="booking-calendar-layout">
      <section className="booking-card booking-calendar" aria-labelledby="booking-calendar-title" aria-busy={estado.tipo === 'carregando'}>
        <div className="booking-calendar__header"><h2 id="booking-calendar-title">{formatMonth(mes)}</h2><div className="booking-calendar__navigation">
          <button type="button" className="booking-calendar__month-button" aria-label="Mês anterior" onClick={() => mudarMes(-1)}>←</button>
          <button type="button" className="booking-calendar__month-button" aria-label="Próximo mês" onClick={() => mudarMes(1)}>→</button>
        </div></div>
        <div className="booking-calendar__weekdays" aria-hidden="true">{['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'].map(d => <span key={d}>{d}</span>)}</div>
        <div className="booking-calendar__days" role="group" aria-label={`Dias de ${formatMonth(mes)}`}>
          {grade.map(d => {
            const iso = dataLocal(d), inside = d.getMonth() === mes.getMonth() && d.getFullYear() === mes.getFullYear()
            const livre = Boolean(inside && iso >= hoje && espaco?.disponivel && intervalos.some(s => s.data === iso))
            const tipo = !inside || iso < hoje ? 'passado' : livre ? 'livre' : estado.tipo === 'pronto' ? 'ocupado' : 'sem-dados'
            const rotulo = !inside ? 'fora do mês exibido' : iso < hoje ? 'data passada' : livre ? 'horários disponíveis' : estado.tipo === 'pronto' ? 'sem horários disponíveis' : 'disponibilidade não consultada'
            return <button type="button" key={iso} disabled={!livre} aria-pressed={dentro && iso === dataIso} aria-label={`${formatLong(d)}: ${rotulo}`}
              className={`booking-calendar__day booking-calendar__day--${tipo}${!inside ? ' booking-calendar__day--outside' : ''}${iso === hoje ? ' booking-calendar__day--today' : ''}${dentro && iso === dataIso ? ' booking-calendar__day--selected' : ''}`}
              onClick={() => patch({ data: iso, inicio: null, fim: null })}>{d.getDate()}</button>
          })}
        </div>
        <div className="booking-calendar__legend"><span>● Horários disponíveis</span><span>× Sem horários disponíveis</span><span>? Não consultado</span></div>
        {estado.tipo === 'pronto' && espaco?.disponivel && !intervalos.length && <p role="status">Nenhum horário disponível neste período.</p>}
      </section>
      <aside className="booking-card booking-day-panel" aria-label="Horários do dia selecionado" aria-live="polite">
        <h2>{dentro && data ? formatLong(data) : 'Selecione uma data'}</h2>
        {!slots.length ? <p className="booking-day-panel__empty">{dentro ? 'Nenhum horário disponível para esta data na consulta atual.' : 'Escolha um dia com horários disponíveis no calendário.'}</p> : <>
          <p className="booking-day-panel__hint">Escolha o intervalo inicial e depois o último intervalo. Para uma hora, selecione o mesmo intervalo novamente.</p>
          <div className="booking-time-list">{slots.map((slot, i) => {
            const podeTerminar = !inicio || Boolean(fim) || intervaloValido(slots, dataIso, inicio, slot.fim)
            const selecionado = slot.inicio === inicio || Boolean(valida && slot.inicio >= inicio && slot.fim <= fim)
            return <button type="button" key={slot.inicio} ref={i === 0 ? primeiroSlotRef : undefined}
              className={`booking-time-slot${selecionado ? ' is-selected' : ''}${!podeTerminar ? ' booking-time-slot--blocked' : ''}`}
              disabled={!podeTerminar} aria-pressed={selecionado} onClick={() => escolher(slot)}>
              {exibirHora(slot.inicio)}–{exibirHora(slot.fim)}<small>{!podeTerminar ? 'Não forma intervalo contínuo' : slot.inicio === inicio ? 'Início selecionado' : valida && slot.fim === fim ? 'Término selecionado' : 'Disponível'}</small>
            </button>
          })}</div>
        </>}
        {(params.has('inicio') || params.has('fim')) && <button type="button" className="booking-time-reset" onClick={limpar}>Limpar seleção</button>}
        {valida && <section className="booking-selection-summary" aria-label="Resumo do intervalo"><strong>Intervalo selecionado</strong><span>{dataIso} · {exibirHora(inicio)}–{exibirHora(fim)}</span></section>}
        {estado.tipo === 'pronto' && params.has('fim') && !valida && <p role="status">Seleção ausente ou inválida. Escolha um intervalo disponível.</p>}
        <button type="button" className="button button--primary booking-continue" disabled={!valida} onClick={() => {
          if (valida && selecaoRealValida(intervalos, params)) navigate(`/laboratorios/${id}/agendamento/detalhes${parametrosReais(params)}`, { state: location.state })
        }}>Continuar para os detalhes</button>
      </aside>
    </div>
    <Link className="booking-back-link" to={`/laboratorios/${id}`}>Voltar aos detalhes do laboratório</Link>
  </main></>
}
