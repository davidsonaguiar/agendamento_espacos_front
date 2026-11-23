import { useCallback, useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Cabecalho } from '../components/Cabecalho'
import { validarFinalidadeSolicitacao } from '../data/solicitacaoPayload'
import { AvisoConsulta, dataBR, hojeLocal } from '../gestao/Controles'
import { mensagem, useConsulta } from '../gestao/consulta'
import { useCatalogoEspacos } from '../hooks/useCatalogoEspacos'
import { horariosLivres, solicitar, terminosLivres } from '../services/agendamentoAluno'
import { obterUsuarioAutenticado } from '../services/autenticacao'
import type { EspacoCatalogo } from '../types/espaco'

const mesExtenso = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' })
const semana = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
const hora = (data: string) => data.slice(11, 16)

function Calendario({ espaco }: { espaco: EspacoCatalogo }) {
  const hoje = hojeLocal()
  const [mes, setMes] = useState(() => new Date(hoje.slice(0, 7) + '-01T12:00:00'))
  const [dia, setDia] = useState('')
  const [inicio, setInicio] = useState('')
  const [fim, setFim] = useState('')
  const prefixo = String(mes.getFullYear()) + '-' + String(mes.getMonth() + 1).padStart(2, '0')
  const quantidade = new Date(mes.getFullYear(), mes.getMonth() + 1, 0).getDate()
  const de = prefixo === hoje.slice(0, 7) ? hoje : prefixo + '-01'
  const ate = prefixo + '-' + quantidade
  const carregar = useCallback((signal: AbortSignal) => horariosLivres(espaco.id, de, ate, signal), [espaco.id, de, ate])
  const consulta = useConsulta(carregar, true)
  const livres = consulta.dados ?? []
  const diasLivres = new Set(livres.map(h => h.data_hora_inicio.slice(0, 10)))
  const terminos = terminosLivres(livres, inicio)
  function selecionarDia(valor: string) {
    setDia(valor)
    setInicio('')
    setFim('')
  }
  function mudarMes(deslocamento: number) {
    setMes(new Date(mes.getFullYear(), mes.getMonth() + deslocamento, 1, 12))
    selecionarDia('')
  }
  const destino = '/laboratorios/' + espaco.id + '/agendamento/detalhes?' + new URLSearchParams({ inicio, fim })
  return <>
    <h1>Agendar {espaco.nome}</h1>
    <div className="booking-calendar-layout">
      <section className="booking-card booking-calendar" aria-label="Calendário de disponibilidade">
        <div className="booking-calendar__header">
          <button type="button" className="booking-calendar__month-button" aria-label="Mês anterior" disabled={prefixo <= hoje.slice(0, 7)} onClick={() => mudarMes(-1)}>‹</button>
          <h2>{mesExtenso.format(mes)}</h2>
          <button type="button" className="booking-calendar__month-button" aria-label="Próximo mês" onClick={() => mudarMes(1)}>›</button>
        </div>
        {!consulta.dados ? <AvisoConsulta erro={consulta.erro} atualizar={consulta.atualizar} /> : <>
          <div className="booking-calendar__weekdays" aria-hidden="true">{semana.map(d => <span key={d}>{d}</span>)}</div>
          <div className="booking-calendar__days">
            {Array.from({ length: mes.getDay() }, (_, i) => <span key={'fora' + i} />)}
            {Array.from({ length: quantidade }, (_, i) => {
              const data = prefixo + '-' + String(i + 1).padStart(2, '0')
              const livre = diasLivres.has(data)
              return <button key={data} className={'booking-calendar__day booking-calendar__day--' + (livre ? 'livre' : 'sem-dados')}
                aria-label={dataBR(data)} aria-pressed={dia === data} disabled={!livre} onClick={() => selecionarDia(data)}>{i + 1}</button>
            })}
          </div>
          {livres.length === 0 && <p role="status">Nenhum horário livre neste mês.</p>}
        </>}
      </section>
      <section className="booking-card booking-day-panel">
        <h2>{dia ? 'Horários de ' + dataBR(dia) : 'Selecione uma data'}</h2>
        {livres.filter(h => h.data_hora_inicio.startsWith(dia + 'T')).map(h =>
          <button key={h.data_hora_inicio} className="booking-time-slot booking-time-slot--livre"
            aria-pressed={inicio === h.data_hora_inicio} onClick={() => { setInicio(h.data_hora_inicio); setFim(h.data_hora_fim) }}>
            {hora(h.data_hora_inicio)} – {hora(h.data_hora_fim)}</button>)}
        {terminos.length > 0 && <label className="booking-end">Término
          <select value={fim} onChange={e => setFim(e.target.value)}>{terminos.map(f => <option key={f} value={f}>{hora(f)}</option>)}</select>
        </label>}
        {terminos.includes(fim) && <Link className="button button--primary" to={destino}>Continuar para os detalhes</Link>}
      </section>
    </div>
  </>
}

function ConfirmarPedido({ espaco }: { espaco: EspacoCatalogo }) {
  const [params] = useSearchParams()
  const navegar = useNavigate()
  const inicio = params.get('inicio') ?? ''
  const fim = params.get('fim') ?? ''
  const dia = inicio.slice(0, 10)
  const formato = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?$/
  const valido = formato.test(inicio) && formato.test(fim) && dia === fim.slice(0, 10) && inicio < fim && dia >= hojeLocal()
  const carregar = useCallback((signal: AbortSignal) => valido ? horariosLivres(espaco.id, dia, dia, signal) : Promise.resolve([]),
    [valido, espaco.id, dia])
  const consulta = useConsulta(carregar)
  const [finalidade, setFinalidade] = useState('')
  const [erro, setErro] = useState('')
  const [enviando, setEnviando] = useState(false)
  const bloqueado = useRef(false)
  async function enviar(evento: FormEvent) {
    evento.preventDefault()
    if (bloqueado.current) return
    const problema = validarFinalidadeSolicitacao(finalidade)
    if (problema) { setErro(problema); return }
    bloqueado.current = true
    setEnviando(true)
    setErro('')
    try {
      const id = await solicitar(espaco.id, finalidade, inicio, fim)
      navegar('/meus-agendamentos', { replace: true, state: { aviso: 'Solicitação #' + id + ' enviada.' } })
    } catch (falha) {
      setErro(mensagem(falha))
      bloqueado.current = false
      setEnviando(false)
    }
  }
  return <>
    <h1>Solicitar {espaco.nome}</h1>
    <Link to={'/laboratorios/' + espaco.id + '/agendamento'}>Alterar horário</Link>
    {!consulta.dados ? <AvisoConsulta erro={consulta.erro} atualizar={consulta.atualizar} /> :
      !terminosLivres(consulta.dados, inicio).includes(fim) ? <p role="alert">Selecione um intervalo disponível no calendário.</p> :
        <form className="booking-purpose-form" onSubmit={enviar}>
          <p>{dataBR(dia)} das {hora(inicio)} às {hora(fim)}</p>
          <label htmlFor="finalidade">Finalidade da solicitação</label>
          <textarea id="finalidade" required minLength={3} maxLength={255} value={finalidade} onChange={e => setFinalidade(e.target.value)} />
          {erro && <div role="alert">{erro} <Link to="/meus-agendamentos">Consultar meus agendamentos</Link></div>}
          <button className="button button--primary" disabled={enviando}>{enviando ? 'Enviando…' : 'Enviar solicitação'}</button>
        </form>}
  </>
}

export function AgendamentoConectado({ id, detalhes }: { id: string; detalhes: boolean }) {
  const { estado, tentarNovamente } = useCatalogoEspacos()
  const espaco = estado.tipo === 'pronto' && estado.espacos.find(e => String(e.id) === id)
  return <><Cabecalho /><main className="page-shell booking-page">
    <Link className="booking-back-link" to={'/laboratorios/' + id}>Voltar ao laboratório</Link>
    {estado.tipo !== 'pronto' ? <AvisoConsulta erro={estado.tipo === 'erro' ? estado.mensagem : undefined} atualizar={tentarNovamente} /> :
      !espaco ? <p role="alert">Laboratório não encontrado.</p> :
      !espaco.disponivel ? <p>Laboratório indisponível para solicitações.</p> :
      obterUsuarioAutenticado()?.perfil !== 'Membro' ? <p>O envio de solicitações requer uma conta de membro.</p> :
      detalhes ? <ConfirmarPedido espaco={espaco} /> : <Calendario espaco={espaco} />}
  </main></>
}
