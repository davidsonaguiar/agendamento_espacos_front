import { Link, useSearchParams } from 'react-router-dom'
import { Cabecalho } from '../components/Cabecalho'
import { useDisponibilidadeEspaco } from '../hooks/useDisponibilidadeEspaco'
import { dataLocal, lerData, selecaoRealValida, parametrosReais, horaLocal, exibirHora } from '../data/disponibilidade'

/** A URL nunca autoriza a prévia: reconsulta a API para validar a cadeia selecionada. */
export function DetalhesSolicitacao({ id }: { id: string }) {
  const [params] = useSearchParams()
  const data = params.getAll('data').length === 1 ? params.get('data')! : ''
  const consultavel = Boolean(lerData(data) && data >= dataLocal(new Date()))
  const { estado, tentarNovamente } = useDisponibilidadeEspaco(id, consultavel ? data : null, consultavel ? data : '')
  const espaco = estado.tipo === 'pronto' ? estado.espaco : undefined
  const valida = Boolean(espaco?.disponivel && estado.tipo === 'pronto' && selecaoRealValida(estado.intervalos, params))
  return <><Cabecalho /><main className="page-shell booking-page">
    <header className="booking-intro"><h1>Prévia da solicitação</h1><p>Confira o laboratório e o intervalo consultado.</p></header>
    <p className="booking-notice" role="note">Nenhuma solicitação foi enviada e nenhuma reserva foi criada. O envio permanece bloqueado nesta etapa.</p>
    {estado.tipo === 'carregando' ? <p role="status">Validando disponibilidade...</p>
      : estado.tipo === 'erro' ? <section role="alert"><p>{estado.mensagem}</p><button type="button" onClick={tentarNovamente}>Tentar novamente</button></section>
      : !espaco ? <p role="status">Laboratório não encontrado no catálogo acessível à sua conta.</p>
      : !espaco.disponivel ? <p role="status">Laboratório indisponível para agendamento.</p>
      : !valida ? <section role="alert"><h2>Seleção ausente ou inválida</h2><p>O intervalo não está disponível na consulta atual. Volte ao calendário para selecionar novamente.</p></section>
      : <section className="booking-card booking-day-panel booking-request-preview" aria-labelledby="selection-title">
        <h2 id="selection-title">Resumo da seleção</h2>
        <dl className="booking-details-summary">
          <div><dt>Laboratório</dt><dd>{espaco.nome}</dd></div>
          <div><dt>Data</dt><dd>{data}</dd></div>
          <div><dt>Horário inicial</dt><dd>{exibirHora(horaLocal(params.get('inicio')!)!)}</dd></div>
          <div><dt>Horário final</dt><dd>{exibirHora(horaLocal(params.get('fim')!)!)}</dd></div>
        </dl>
        <p>A disponibilidade pode mudar. Esta prévia não confirma reserva.</p>
        <button type="button" className="button button--primary" disabled>Envio de solicitação ainda não disponível</button>
      </section>}
    <Link className="booking-back-link" to={`/laboratorios/${id}/agendamento${parametrosReais(params)}`}>Voltar ao calendário</Link>
  </main></>
}
