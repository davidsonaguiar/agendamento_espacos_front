import { useEffect, useId, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Cabecalho } from '../components/Cabecalho'
import { dataBR } from '../gestao/Controles'
import { useEnvioSolicitacao } from '../hooks/useEnvioSolicitacao'
import { consultarHorarios } from '../services/disponibilidade'
import { useRelogioLocal } from '../hooks/useRelogioLocal'
import { useRascunhoSolicitacao } from '../hooks/useRascunhoSolicitacao'
import { criarPayloadSolicitacao, validarFinalidadeSolicitacao } from '../data/solicitacaoPayload'
import type { CriarSolicitacaoEspaco } from '../types/solicitacaoIntegrada'
import { useDisponibilidadeEspaco } from '../hooks/useDisponibilidadeEspaco'
import { dataLocal, lerData, selecaoRealValida, parametrosReais, horaLocal, exibirHora } from '../data/disponibilidade'

/** A URL nunca autoriza a prévia: reconsulta a API para validar a cadeia selecionada. */
export function DetalhesSolicitacao({ id }: { id: string }) {
  const [params] = useSearchParams()
  const agora = useRelogioLocal()
  const { finalidade, alterarFinalidade, estadoNavegacao, idUsuario } = useRascunhoSolicitacao(id)
  const finalidadeId = useId()
  const envioAjudaId = useId()
  const campoRef = useRef<HTMLTextAreaElement>(null)
  const [tocada, setTocada] = useState(false)
  const [pedido, setPedido] = useState<string | null>(null)
  const [preparado, setPreparado] = useState<{ chave: string; payload: CriarSolicitacaoEspaco } | null>(null)
  const [erroPreparacao, setErroPreparacao] = useState('')
  const erroFinalidade = validarFinalidadeSolicitacao(finalidade)
  const chave = JSON.stringify([idUsuario, id, params.get('data'), params.get('inicio'), params.get('fim'), finalidade])
  const escopoEnvio = JSON.stringify([idUsuario, id, params.get('data'), params.get('inicio'), params.get('fim')])
  const envio = useEnvioSolicitacao(escopoEnvio, idUsuario)
  const data = params.getAll('data').length === 1 ? params.get('data')! : ''
  const consultavel = Boolean(lerData(data) && data >= dataLocal(agora))
  const { estado, tentarNovamente } = useDisponibilidadeEspaco(id, consultavel ? data : null, consultavel ? data : '')
  const espaco = estado.tipo === 'pronto' ? estado.espaco : undefined
  const valida = Boolean(espaco?.disponivel && estado.tipo === 'pronto' && selecaoRealValida(estado.intervalos, params, agora))
  useEffect(() => {
    if (!pedido) return
    if (pedido !== chave) { setPedido(null); return }
    if (estado.tipo === 'carregando') return
    setPedido(null)
    if (estado.tipo !== 'pronto' || !espaco?.disponivel) return
    try {
      const payload = criarPayloadSolicitacao({ idEspaco: espaco.id, dataReserva: data,
        horaInicio: params.get('inicio') ?? '', horaFim: params.get('fim') ?? '' }, finalidade, estado.intervalos)
      setPreparado({ chave, payload })
      setErroPreparacao('')
    } catch {
      setErroPreparacao('Não foi possível preparar a prévia. Confira a finalidade e selecione um intervalo futuro e disponível.')
    }
  }, [pedido, chave, estado, espaco, data, params, finalidade])
  const payload = valida && preparado?.chave === chave ? preparado.payload : null
  const motivoBloqueio = idUsuario === undefined ? 'Sua sessão não está identificada. Entre novamente antes de enviar.'
    : envio.bloqueado ? 'Envio bloqueado: há uma tentativa anterior sem confirmação. Confira o resultado antes de qualquer nova tentativa.'
      : envio.ocupado ? (envio.estado.tipo === 'verificando' ? 'Aguarde a revalidação da disponibilidade e da sessão.' : 'Envio em andamento. Aguarde a confirmação; não envie novamente.')
        : estado.tipo === 'carregando' ? 'Aguarde a consulta da disponibilidade.'
          : estado.tipo === 'erro' ? 'Não foi possível validar a disponibilidade. Use Tentar novamente para consultar os horários.'
            : !espaco ? 'Laboratório não encontrado. Volte ao catálogo.'
              : !espaco.disponivel ? 'Este laboratório está indisponível para agendamento.'
                : !valida ? 'Selecione no calendário um intervalo futuro e disponível.'
                  : erroFinalidade ? `Envio bloqueado: ${erroFinalidade}`
                    : pedido !== null ? 'Aguarde a revisão da solicitação.'
                      : !payload ? (preparado ? 'A finalidade ou a seleção mudou. Clique em Revisar solicitação novamente.' : 'Clique em Revisar solicitação para validar os dados antes de enviar.')
                        : ''
  if (envio.estado.tipo === 'sucesso') {
    const { resposta, laboratorio } = envio.estado
    return <><Cabecalho /><main className="page-shell booking-page confirmation-page">
      <section className="confirmation-card" aria-labelledby="confirmation-title">
        <div className="confirmation-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><path d="m8 12 3 3 5-6" /></svg></div>
        <h1 id="confirmation-title">Solicitação registrada</h1>
        <p className="confirmation-intro" role="status">{resposta.status === 'Pendente' ? 'Solicitação enviada e aguardando análise.' : 'Solicitação registrada. Confira o status retornado.'}</p>
        <span className={`agenda-status agenda-status--${resposta.status}`}>Status: {resposta.status}</span>
        <dl className="confirmation-summary">
          <div><dt>ID da solicitação</dt><dd>{resposta.id}</dd></div>
          <div><dt>Laboratório</dt><dd>{laboratorio}</dd></div>
          <div className="confirmation-summary__wide"><dt>Data e horários</dt><dd><ul>{resposta.horarios.map((horario, indice) => <li key={indice}>{dataBR(horario.data_reserva)} · {exibirHora(horario.hora_inicio)}–{exibirHora(horario.hora_fim)}</li>)}</ul></dd></div>
          <div className="confirmation-summary__wide"><dt>Finalidade</dt><dd>{resposta.finalidade}</dd></div>
        </dl>
        <p className="confirmation-notice">Este envio não confirma reserva de horário. A solicitação segue o processo de análise.</p>
        <div className="confirmation-actions"><Link className="button button--primary" to="/meus-agendamentos">Consultar minhas solicitações</Link><Link className="button confirmation-secondary" to="/">Voltar ao catálogo</Link></div>
      </section>
    </main></>
  }
  return <><Cabecalho /><main className="page-shell booking-page">
    <header className="booking-intro"><h1>Prévia da solicitação</h1><p>Confira o laboratório e o intervalo consultado.</p></header>
    <p className="booking-notice" role="note">A disponibilidade pode mudar. Somente a resposta de criação confirma o registro da solicitação; o envio não garante aprovação ou reserva.</p>
        {envio.ocupado && <p role="status">{envio.estado.tipo === 'verificando' ? 'Revalidando disponibilidade e sessão antes do envio...' : 'Enviando solicitação...'}</p>}
        {envio.estado.tipo === 'erro' && <section role="alert"><p>{envio.estado.mensagem}</p>
          {envio.estado.incerto ? <><p>A solicitação pode ter sido registrada. Não reenvie automaticamente.</p><p>Consulte suas solicitações antes de qualquer nova tentativa. Se o resultado continuar indefinido, confira com a coordenação.</p><Link to="/meus-agendamentos">Consultar minhas solicitações</Link></>
            : <p>Os dados foram preservados. Corrija o problema antes de tentar novamente.</p>}
        </section>}
    <p id={envioAjudaId} className="booking-send-feedback" role="status" aria-live="polite">{motivoBloqueio || 'Dados revisados. Você pode enviar a solicitação para análise.'}</p>
    {estado.tipo === 'carregando' ? <p role="status">Validando disponibilidade...</p>
      : estado.tipo === 'erro' ? <section role="alert"><p>{estado.mensagem}</p><button type="button" onClick={tentarNovamente}>Tentar novamente</button></section>
      : !espaco ? <p role="status">Laboratório não encontrado no catálogo acessível à sua conta.</p>
      : !espaco.disponivel ? <p role="status">Laboratório indisponível para agendamento.</p>
      : !valida ? <section role="alert"><h2>Seleção ausente ou inválida</h2><p>O intervalo precisa ser futuro e estar disponível na consulta atual. Volte ao calendário para selecionar novamente.</p></section>
      : <section className="booking-card booking-day-panel booking-request-preview" aria-labelledby="selection-title">
        <h2 id="selection-title">Resumo da seleção</h2>
        <dl className="booking-details-summary">
          <div><dt>Laboratório</dt><dd>{espaco.nome}</dd></div>
          <div><dt>Data</dt><dd>{data}</dd></div>
          <div><dt>Horário inicial</dt><dd>{exibirHora(horaLocal(params.get('inicio')!)!)}</dd></div>
          <div><dt>Horário final</dt><dd>{exibirHora(horaLocal(params.get('fim')!)!)}</dd></div>
        </dl>
        <form className="booking-purpose-form" noValidate onSubmit={event => {
          event.preventDefault()
          setTocada(true)
          setPreparado(null)
          if (erroFinalidade) { campoRef.current?.focus(); return }
          setErroPreparacao('')
          setPedido(chave)
          tentarNovamente()
        }}>
          <label className="booking-purpose-form__label" htmlFor={finalidadeId}>Finalidade da solicitação</label>
          <p id={`${finalidadeId}-help`}>Descreva o motivo do uso do laboratório, com 3 a 255 caracteres após remover espaços das extremidades.</p>
          <textarea ref={campoRef} id={finalidadeId} name="finalidade" required aria-required="true" rows={5}
            value={finalidade} readOnly={envio.ocupado} onChange={event => { setErroPreparacao(''); alterarFinalidade(event.target.value) }} onBlur={() => setTocada(true)}
            aria-invalid={tocada && Boolean(erroFinalidade)}
            aria-describedby={`${finalidadeId}-help ${finalidadeId}-count${tocada && erroFinalidade ? ` ${finalidadeId}-error` : ''}`} />
          <span id={`${finalidadeId}-count`} className="booking-purpose-form__count">{Array.from(finalidade.trim()).length}/255 caracteres</span>
          {tocada && erroFinalidade && <p id={`${finalidadeId}-error`} className="booking-purpose-form__error" role="alert">{erroFinalidade}</p>}
          <button type="submit" className="button button--primary" disabled={!valida || pedido !== null || envio.ocupado || envio.bloqueado}>Revisar solicitação</button>
        </form>
        {erroPreparacao && <p role="alert">{erroPreparacao}</p>}
        {payload && envio.estado.tipo === 'ocioso' && <section className="booking-request-preview__purpose" aria-label="Finalidade revisada"><h3>Finalidade revisada</h3><p>{payload.finalidade}</p><p role="status">Prévia preparada localmente. Nenhuma solicitação foi enviada.</p></section>}
        <p>A disponibilidade pode mudar. Esta prévia não confirma reserva.</p>
        <button type="button" className="button button--primary booking-send-button" aria-describedby={envioAjudaId} aria-busy={envio.ocupado} disabled={Boolean(motivoBloqueio)} onClick={() => {
          if (motivoBloqueio || !payload || !espaco) return
          const selecao = { idEspaco: espaco.id, dataReserva: data, horaInicio: params.get('inicio')!, horaFim: params.get('fim')! }
          const texto = finalidade
          const nome = espaco.nome
          void envio.enviar(async signal => {
            const atuais = await consultarHorarios(selecao.idEspaco, selecao.dataReserva, selecao.dataReserva, signal)
            signal.throwIfAborted()
            return { payload: criarPayloadSolicitacao(selecao, texto, atuais), laboratorio: nome }
          })
        }}>Enviar solicitação</button>
      </section>}
    {!envio.ocupado && <Link className="booking-back-link" to={`/laboratorios/${id}/agendamento${parametrosReais(params)}`} state={estadoNavegacao}>Voltar ao calendário</Link>}
  </main></>
}
