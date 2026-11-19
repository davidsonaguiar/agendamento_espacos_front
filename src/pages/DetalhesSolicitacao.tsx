import { useEffect, useId, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Cabecalho } from '../components/Cabecalho'
import { duracaoMinutos } from '../data/horariosAgendamentoDemonstrativos'
import { laboratoriosFicticios } from '../data/laboratorios'
import { criarPayloadSolicitacao, validarFinalidadeSolicitacao, type PayloadSolicitacaoEspaco } from '../data/solicitacaoPayload'
import { parametrosSelecao, parseData, selecaoDemonstrativaValida } from '../data/selecaoAgendamento'
import { obterUsuarioAutenticado } from '../services/autenticacao'
import { criarSolicitacaoSimulada, simuladorLocalAtivo } from '../services/simuladorLocal'

export function DetalhesSolicitacao({ id }: { id: string }) {
  const [params] = useSearchParams()
  const [finalidade, setFinalidade] = useState('')
  const [finalidadeTocada, setFinalidadeTocada] = useState(false)
  const [modo, setModo] = useState<'formulario' | 'previa'>('formulario')
  const [payloadPreview, setPayloadPreview] = useState<PayloadSolicitacaoEspaco | null>(null)
  const [erroPayload, setErroPayload] = useState('')
  const [erroEnvio, setErroEnvio] = useState('')
  const [enviando, setEnviando] = useState(false)
  const finalidadeId = useId()
  const tituloModoRef = useRef<HTMLHeadingElement>(null)
  const navigate = useNavigate()
  const lab = laboratoriosFicticios.find(item => String(item.id) === id)
  const valida = Boolean(lab?.disponivel && selecaoDemonstrativaValida(lab.id, params))
  const data = parseData(params.get('data'))
  const inicio = params.get('inicio') || ''
  const fim = params.get('fim') || ''
  const duracao = duracaoMinutos(inicio, fim)
  const calendario = `/laboratorios/${id}/agendamento${parametrosSelecao(params)}`
  const finalidadeTrimada = finalidade.trim()
  const erroFinalidade = validarFinalidadeSolicitacao(finalidade)
  const podeRevisar = Boolean(lab && data && valida && !erroFinalidade && duracao > 0)
  const horarioPreview = payloadPreview?.horarios[0]
  const dataExibida = modo === 'previa' && horarioPreview ? parseData(horarioPreview.data_reserva) || data : data
  const inicioExibido = modo === 'previa' && horarioPreview ? horarioPreview.hora_inicio : inicio
  const fimExibido = modo === 'previa' && horarioPreview ? horarioPreview.hora_fim : fim
  const duracaoExibida = duracaoMinutos(inicioExibido, fimExibido)

  useEffect(() => {
    tituloModoRef.current?.focus()
  }, [modo])

  const revisarSolicitacao = () => {
    if (!lab || !data || !podeRevisar) return
    try {
      const payload = criarPayloadSolicitacao({
        idEspaco: lab.id,
        dataReserva: params.get('data') || '',
        horaInicio: inicio,
        horaFim: fim,
      }, finalidade)
      setPayloadPreview(payload)
      setErroPayload('')
      setModo('previa')
    } catch {
      setErroPayload('Não foi possível preparar a prévia. Confira os dados da seleção e da finalidade.')
    }
  }

  const enviarSolicitacaoLocal = () => {
    const usuario = obterUsuarioAutenticado()
    if (!simuladorLocalAtivo || !payloadPreview || !usuario) {
      setErroEnvio('Não foi possível registrar a solicitação no simulador local. Confira a sessão e tente novamente.')
      return
    }

    setEnviando(true)
    setErroEnvio('')
    try {
      criarSolicitacaoSimulada(payloadPreview, usuario)
      navigate('/meus-agendamentos')
    } catch (erro) {
      setErroEnvio(erro instanceof Error ? erro.message : 'Falha ao registrar a solicitação local.')
    } finally {
      setEnviando(false)
    }
  }

  return <>
    <Cabecalho />
    <main className="page-shell booking-page">
      <header className="booking-intro">
        <h1>Detalhes da solicitação</h1>
        <p>Confira a seleção demonstrativa de laboratório, data e horário.</p>
      </header>
      <p className="booking-notice" role="note">Datas e horários demonstrativos; não representam disponibilidade oficial nem confirmam reserva.</p>
      {!lab ? <section className="placeholder-card">
        <h2>Laboratório não encontrado</h2>
        <p>Não foi possível encontrar um laboratório com o ID {id}.</p>
        <Link className="button button--primary" to="/">Voltar ao catálogo</Link>
      </section> : !lab.disponivel ? <section className="booking-card booking-day-panel">
        <h2>Laboratório indisponível</h2>
        <p>Este laboratório está indisponível para novas solicitações de agendamento.</p>
        <Link className="booking-back-link" to={`/laboratorios/${lab.id}`}>Consultar detalhes do laboratório</Link>
      </section> : !valida || !data ? <section className="booking-card booking-day-panel">
        <h2>Seleção ausente ou inválida</h2>
        <p className="booking-day-panel__hint">Retorne ao calendário para conferir a data e selecionar um intervalo demonstrativo livre.</p>
        <Link className="booking-back-link" to={calendario}>Voltar ao calendário</Link>
      </section> : <section className={`booking-card booking-day-panel${modo === 'previa' ? ' booking-request-preview' : ''}`} aria-labelledby="selection-title">
        <h2 id="selection-title" ref={tituloModoRef} tabIndex={-1}>{modo === 'previa' ? 'Prévia da solicitação' : 'Resumo demonstrativo'}</h2>
        <dl className={`booking-details-summary${modo === 'previa' ? ' booking-request-preview__summary' : ''}`}>
          <div className={modo === 'previa' ? 'booking-request-preview__item booking-request-preview__item--lab' : undefined}><dt>Laboratório</dt><dd>{lab.nome}</dd></div>
          <div className={modo === 'previa' ? 'booking-request-preview__item' : undefined}><dt>Data</dt><dd>{new Intl.DateTimeFormat('pt-BR', { dateStyle: 'full' }).format(dataExibida || data).replace(/^./, letra => letra.toLocaleUpperCase('pt-BR'))}</dd></div>
          <div className={modo === 'previa' ? 'booking-request-preview__item' : undefined}><dt>Duração</dt><dd>{Math.floor(duracaoExibida / 60)} h{duracaoExibida % 60 ? ` ${duracaoExibida % 60} min` : ''}</dd></div>
          <div className={modo === 'previa' ? 'booking-request-preview__item booking-request-preview__item--time' : undefined}><dt>Horário inicial</dt><dd>{inicioExibido}</dd></div>
          <div className={modo === 'previa' ? 'booking-request-preview__item booking-request-preview__item--time' : undefined}><dt>Horário final</dt><dd>{fimExibido}</dd></div>
        </dl>
        {modo === 'formulario' ? <>
          <p className="booking-day-panel__hint">Nenhuma solicitação foi enviada ou reserva criada.</p>
          <Link className="booking-back-link" to={calendario}><span aria-hidden="true">←</span>Alterar data e horário</Link>
          <form className="booking-purpose-form" aria-labelledby={`${finalidadeId}-title`} onSubmit={event => { event.preventDefault(); revisarSolicitacao() }} noValidate>
            <div className="booking-purpose-form__heading">
              <h3 id={`${finalidadeId}-title`}>Finalidade da solicitação</h3>
              <p id={`${finalidadeId}-help`}>Descreva o motivo do uso do laboratório, com 3 a 255 caracteres.</p>
            </div>
            <label className="booking-purpose-form__label" htmlFor={finalidadeId}>Finalidade da solicitação <span aria-hidden="true">*</span></label>
            <textarea
              id={finalidadeId}
              name="finalidade"
              value={finalidade}
              onChange={event => { setFinalidade(event.target.value); setErroPayload('') }}
              onBlur={() => setFinalidadeTocada(true)}
              maxLength={255}
              required
              aria-required="true"
              aria-invalid={Boolean(finalidadeTocada && erroFinalidade)}
              aria-describedby={`${finalidadeId}-help ${finalidadeId}-count${finalidadeTocada && erroFinalidade ? ` ${finalidadeId}-error` : ''}`}
              aria-errormessage={finalidadeTocada && erroFinalidade ? `${finalidadeId}-error` : undefined}
              rows={5}
            />
            <div className="booking-purpose-form__meta">
              {finalidadeTocada && erroFinalidade
                ? <p className="booking-purpose-form__error" id={`${finalidadeId}-error`} role="status">{erroFinalidade}</p>
                : <span />}
              <span className="booking-purpose-form__count" id={`${finalidadeId}-count`} aria-live="polite">{finalidadeTrimada.length}/255 caracteres</span>
            </div>
            <p className="booking-purpose-form__notice" role="note">{simuladorLocalAtivo
              ? 'Simulador local: a solicitação será guardada somente neste navegador.'
              : 'Formulário demonstrativo. Nenhuma solicitação será enviada nesta versão.'}</p>
            {erroPayload && <p className="booking-request-preview__error" role="alert">{erroPayload}</p>}
            <button className="button button--primary booking-purpose-form__submit" type="submit" disabled={!podeRevisar}>Revisar solicitação</button>
          </form>
        </> : payloadPreview ? <>
          <p className="booking-request-preview__notice" role="note">{simuladorLocalAtivo
            ? 'Prévia do simulador local. O envio ficará disponível somente neste navegador e não cria uma reserva real.'
            : 'Esta é apenas uma prévia. Nenhuma solicitação foi enviada e nenhum laboratório foi reservado.'}</p>
          <dl className="booking-request-preview__purpose">
            <div><dt>Finalidade da solicitação</dt><dd>{payloadPreview.finalidade}</dd></div>
          </dl>
          <button className="button button--secondary booking-request-preview__edit" type="button" onClick={() => setModo('formulario')}>Voltar para editar</button>
          {simuladorLocalAtivo && <div>
            {erroEnvio && <p className="booking-request-preview__error" role="alert">{erroEnvio}</p>}
            <button className="button button--primary booking-purpose-form__submit" type="button" disabled={enviando} onClick={enviarSolicitacaoLocal}>
              {enviando ? 'Enviando para o teste local...' : 'Enviar solicitação de teste'}
            </button>
          </div>}
        </> : <p className="booking-request-preview__error" role="alert">Não foi possível carregar a prévia. Volte ao formulário e revise os dados.</p>}
      </section>}
    </main>
  </>
}
