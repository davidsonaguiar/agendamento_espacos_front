import { useEffect, useRef } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Cabecalho } from '../components/Cabecalho'
import { diaPodeSerSelecionado } from '../data/calendarioDemonstrativo'
import { duracaoMinutos, intervaloEstaLivre, minutos, obterIntervalosDemonstrativos } from '../data/horariosAgendamentoDemonstrativos'
import { laboratoriosFicticios } from '../data/laboratorios'
import { iso, obterEstadoDataDemonstrativa, parametrosSelecao, parseData, selecaoDemonstrativaValida } from '../data/selecaoAgendamento'

interface Props { id: string }
const formatMonth = (d: Date) => new Intl.DateTimeFormat('pt-BR',{month:'long',year:'numeric'}).format(d).replace(/^./, c=>c.toLocaleUpperCase('pt-BR'))
const formatLong = (d: Date) => new Intl.DateTimeFormat('pt-BR',{weekday:'long',day:'numeric',month:'long',year:'numeric'}).format(d).replace(/^./, c=>c.toLocaleUpperCase('pt-BR'))
const duration = (n: number) => `${Math.floor(n/60)} h${n%60 ? ` ${n%60} min` : ''}`

export function SolicitacaoAgendamento({ id }: Props) {
 const lab = laboratoriosFicticios.find(x => String(x.id)===id)
 const [params,setParams] = useSearchParams()
 const navigate = useNavigate()
 const primeiroSlotLivreRef = useRef<HTMLButtonElement>(null)
 const focarAposLimpezaRef = useRef(false)
 const dataParam = params.get('data')
 const data = parseData(dataParam)
 const mesParam = params.get('mes')
 const mes = /^\d{4}-(0[1-9]|1[0-2])$/.test(mesParam || '') ? new Date(Number(mesParam!.slice(0,4)), Number(mesParam!.slice(5,7))-1, 1) : data ? new Date(data.getFullYear(),data.getMonth(),1) : new Date(new Date().getFullYear(),new Date().getMonth(),1)
 const dataIso = data ? iso(data) : ''
 const slots = lab && data ? obterIntervalosDemonstrativos(lab.id,dataIso) : undefined
 const primeiroSlotLivre = slots?.find(slot => slot.estado === 'livre')
 const inicio = params.get('inicio') || ''
 const fim = params.get('fim') || ''
 const selecaoValida = Boolean(lab?.disponivel && selecaoDemonstrativaValida(lab.id,params))
 const terminoDisponivel = Boolean(inicio && !fim && slots?.some(slot => slot.estado === 'livre' && intervaloEstaLivre(slots,inicio,slot.fim)))
 useEffect(() => {
  if (!lab?.disponivel) return
  const next = new URLSearchParams(params); let changed = false
  if (mesParam && !/^\d{4}-(0[1-9]|1[0-2])$/.test(mesParam)) { next.delete('mes'); changed=true }
  const parsed = parseData(dataParam)
  if (dataParam && (!parsed || obterEstadoDataDemonstrativa(lab.id,parsed) !== 'livre')) { next.delete('data'); next.delete('inicio'); next.delete('fim'); next.delete('avancar'); changed=true }
  const validSlots = parsed ? obterIntervalosDemonstrativos(lab.id,iso(parsed)) : undefined
  const startOk = Boolean(validSlots?.some(s => s.inicio === inicio && s.estado === 'livre'))
  const timeOk = fim ? Boolean(validSlots && intervaloEstaLivre(validSlots,inicio,fim)) : inicio ? startOk : true
  if ((inicio || fim) && !timeOk) { next.delete('inicio'); next.delete('fim'); next.delete('avancar'); changed=true }
  if (next.has('avancar') && !(validSlots && intervaloEstaLivre(validSlots,inicio,fim))) { next.delete('avancar'); changed=true }
  if (changed) setParams(next,{replace:true})
 },[lab,params,dataParam,mesParam,inicio,fim,setParams])
 useEffect(() => {
  if (focarAposLimpezaRef.current && !inicio && !fim) {
   focarAposLimpezaRef.current = false
   primeiroSlotLivreRef.current?.focus()
  }
 },[inicio,fim])
 const patch = (values: Record<string,string|null>) => { const next=new URLSearchParams(params); Object.entries(values).forEach(([k,v])=>v===null?next.delete(k):next.set(k,v)); setParams(next) }
 const changeMonth = (delta:number) => { const next=new Date(mes.getFullYear(),mes.getMonth()+delta,1); patch({mes: next.getFullYear()+'-'+String(next.getMonth()+1).padStart(2,'0')}) }
 const escolherData = (d:Date) => patch({data:iso(d),mes:d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0'),inicio:null,fim:null,avancar:null})
 const escolherSlot = (slot:{inicio:string;fim:string;estado:string}) => {
  if (slot.estado!=='livre') return
  if (!inicio || fim) { patch({inicio:slot.inicio,fim:null,avancar:null}); return }
  if (intervaloEstaLivre(slots,inicio,slot.fim)) patch({fim:slot.fim,avancar:null})
 }
 const hoje=new Date(); const primeiro=new Date(mes.getFullYear(),mes.getMonth(),1); const offset=(primeiro.getDay()+6)%7
 const grade=Array.from({length:42},(_,i)=>new Date(mes.getFullYear(),mes.getMonth(),1-offset+i))
 return <><Cabecalho/><main className="page-shell booking-page">{lab ? !lab.disponivel ? <section className="booking-card booking-day-panel">
 <h1>Laboratório indisponível</h1>
 <p>Este laboratório está indisponível para novas solicitações de agendamento.</p>
 <Link className="booking-back-link" to={`/laboratorios/${lab.id}`}>Consultar detalhes do laboratório</Link>
 </section> : <><nav className="booking-progress" aria-label="Etapas da solicitação"><Link className="booking-progress__step booking-progress__step--complete" to={`/laboratorios/${lab.id}`}><span className="booking-progress__number">1</span><span>Laboratório</span></Link><span className="booking-progress__connector booking-progress__connector--complete" aria-hidden="true"/><div className="booking-progress__step booking-progress__step--current" aria-current="step"><span className="booking-progress__number">2</span><span>Data e horário</span></div><span className="booking-progress__connector" aria-hidden="true"/><div className="booking-progress__step booking-progress__step--upcoming" aria-disabled="true"><span className="booking-progress__number">3</span><span>Detalhes</span></div></nav>
 <header className="booking-intro"><h1>Escolha a data e o horário</h1><p>Selecione uma data e um intervalo demonstrativos para {lab.nome}.</p></header>
 <p className="booking-notice" id="booking-demo-notice" role="note">Datas e horários demonstrativos; não representam disponibilidade oficial nem confirmam reserva.</p><p className="booking-weekend-notice" id="booking-weekend-notice" role="note">Finais de semana indisponíveis para agendamento. Esta é uma restrição provisória, sujeita à confirmação do funcionamento oficial do laboratório.</p>
 <div className="booking-calendar-layout"><section className="booking-card booking-calendar" aria-labelledby="booking-calendar-title" aria-describedby="booking-demo-notice booking-weekend-notice"><div className="booking-calendar__header"><div><h2 id="booking-calendar-title">{formatMonth(mes)}</h2><p>Disponibilidade demonstrativa do laboratório</p></div><div className="booking-calendar__navigation"><button type="button" aria-label="Mês anterior" className="booking-calendar__month-button" onClick={()=>changeMonth(-1)}><svg aria-hidden="true" viewBox="0 0 24 24" fill="none"><path d="m15 18-6-6 6-6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg></button><button type="button" aria-label="Próximo mês" className="booking-calendar__month-button" onClick={()=>changeMonth(1)}><svg aria-hidden="true" viewBox="0 0 24 24" fill="none"><path d="m9 18 6-6-6-6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg></button></div></div>
 <div className="booking-calendar__weekdays" aria-hidden="true">{['Seg','Ter','Qua','Qui','Sex','Sáb','Dom'].map(x=><span key={x}>{x}</span>)}</div><div className="booking-calendar__days" role="group" aria-label={`Dias de ${formatMonth(mes)}`}>{grade.map(d=>{const inside=d.getMonth()===mes.getMonth()&&d.getFullYear()===mes.getFullYear();const state=inside?obterEstadoDataDemonstrativa(lab.id,d,hoje):'sem-dados';const today=iso(d)===iso(hoje);const selected=dataIso===iso(d);const enabled=diaPodeSerSelecionado(state,inside);return <button key={iso(d)} type="button" className={['booking-calendar__day',`booking-calendar__day--${state}`,inside?'':'booking-calendar__day--outside',today?'booking-calendar__day--today':'',selected?'booking-calendar__day--selected':''].filter(Boolean).join(' ')} disabled={!enabled} aria-pressed={selected} aria-label={`${formatLong(d)}: ${inside ? rotuloEstadoDia(state) : 'dia de mês adjacente, indisponível nesta etapa'}${today ? ', hoje' : ''}`} onClick={()=>escolherData(d)}>{d.getDate()}</button>})}</div>
 <div className="booking-calendar__legend" aria-label="Legenda de disponibilidade"><span><i className="booking-calendar__legend-dot booking-calendar__legend-dot--free" />Livre</span><span><i className="booking-calendar__legend-dot booking-calendar__legend-dot--occupied" />Ocupado</span><span><i className="booking-calendar__legend-dot booking-calendar__legend-dot--no-data" />Sem disponibilidade demonstrativa</span><span><i className="booking-calendar__legend-dot booking-calendar__legend-dot--weekend" />Fim de semana, provisório</span><span><i className="booking-calendar__legend-dot booking-calendar__legend-dot--today" />Hoje</span></div></section>
 <aside className="booking-card booking-day-panel" aria-live="polite" aria-label="Horários do dia selecionado">{data ? <><h2>{formatLong(data)}</h2><p className="booking-day-panel__hint">Intervalos fictícios de uma hora; escolha início e término.</p>{!slots ? <div className="booking-day-panel__empty">Nenhum horário demonstrativo cadastrado para este dia.</div> : slots.every(s=>s.estado==='ocupado') ? <div className="booking-day-panel__empty">Não há horários livres demonstrativos neste dia.</div> : <><div className="booking-time-list">{slots.map(slot=>{const startSelected=inicio===slot.inicio;const endSelected=fim===slot.fim;const canEnd=Boolean(inicio&&!fim&&minutos(slot.inicio)!==minutos(inicio)&&intervaloEstaLivre(slots,inicio,slot.fim));const cannotEnd=slot.estado==='livre'&&Boolean(inicio)&&!fim&&!startSelected&&!endSelected&&!canEnd;const disabled=slot.estado==='ocupado'||(!startSelected&&!endSelected&&Boolean(inicio)&&!fim&&!canEnd);return <button key={slot.inicio} ref={slot === primeiroSlotLivre ? primeiroSlotLivreRef : undefined} type="button" className={`booking-time-slot booking-time-slot--${slot.estado}${cannotEnd ? " booking-time-slot--blocked" : ""}${startSelected||endSelected?' is-selected':''}`} disabled={disabled} aria-pressed={startSelected||endSelected} onClick={()=>escolherSlot(slot)}>{slot.inicio}–{slot.fim}<small>{slot.estado==='ocupado'?'Ocupado':endSelected?'Término':startSelected?'Início':cannotEnd?'Não forma intervalo contínuo':'Livre'}</small></button>})}</div>{inicio&&!fim&&!terminoDisponivel&&<p className="booking-time-blocked-message" role="status">Não é possível continuar a partir deste horário porque existe um intervalo indisponível no período. Escolha outro horário inicial.</p>}{inicio&&!fim&&<button type="button" className="booking-time-reset" onClick={()=>patch({inicio:null,fim:null,avancar:null})}>Escolher outro horário inicial</button>}{inicio&&!fim&&<p className="booking-day-panel__hint">Início selecionado: {inicio}. Escolha um término livre que não atravesse intervalos ocupados.</p>}{selecaoValida&&<><section className="booking-selection-summary" aria-label="Resumo do intervalo"><strong>Resumo demonstrativo</strong><span>{formatLong(data)} · {inicio}–{fim}</span><span>Duração: {duration(duracaoMinutos(inicio,fim))}</span></section><button type="button" className="booking-time-reset" onClick={()=>{ focarAposLimpezaRef.current = true; patch({inicio:null,fim:null,avancar:null}) }}>Limpar seleção</button></>}</>}</> : <><h2>Selecione uma data</h2><p className="booking-day-panel__hint">Escolha um dia livre no calendário.</p><div className="booking-day-panel__empty">Os intervalos demonstrativos aparecerão aqui.</div></>}<p className="booking-day-panel__hint">A escolha não cria reserva. Confira o resumo na próxima tela.</p><button type="button" className="button button--primary booking-continue" disabled={!selecaoValida} onClick={()=>{ if (lab?.disponivel && selecaoDemonstrativaValida(lab.id,params)) navigate(`/laboratorios/${lab.id}/agendamento/detalhes${parametrosSelecao(params)}`) }}>Continuar para os detalhes</button></aside></div>
 <Link className="booking-back-link" to={`/laboratorios/${lab.id}`}>← Voltar aos detalhes do laboratório</Link></> : <section className="placeholder-card"><p className="placeholder-card__eyebrow">ID {id}</p><h1>Laboratório não encontrado</h1><p>Não foi possível encontrar um laboratório com o ID {id}.</p><Link className="button button--primary" to="/">Voltar ao catálogo</Link></section>}</main></>
}
function rotuloEstadoDia(estado: string): string {
  if (estado === 'livre') return 'livre, demonstrativo'
  if (estado === 'ocupado') return 'ocupado, demonstrativo'
  if (estado === 'passado') return 'data passada'
  if (estado === 'fim-de-semana') return 'fim de semana indisponível provisoriamente'
  return 'sem disponibilidade demonstrativa cadastrada'
}
