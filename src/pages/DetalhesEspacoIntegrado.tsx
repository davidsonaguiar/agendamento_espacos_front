import { Link } from 'react-router-dom'
import { Cabecalho } from '../components/Cabecalho'
import { useCatalogoEspacos } from '../hooks/useCatalogoEspacos'

// Contrato do backend: 0 = Domingo. Dias ausentes não implicam fechamento.
const nomesDias = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']

/** Usa somente a consulta já confirmada; não presume um GET /espacos/:id. */
export function DetalhesEspacoIntegrado({ id }: { id: string }) {
  const { estado, tentarNovamente } = useCatalogoEspacos()
  const espaco = estado.tipo === 'pronto' ? estado.espacos.find(e => String(e.id) === id) : undefined
  const horarios = [...(espaco?.horariosFuncionamento ?? [])].sort((a, b) =>
    a.dia_semana - b.dia_semana || a.hora_abertura.localeCompare(b.hora_abertura))

  return <><Cabecalho /><main className="page-shell detail-page">
    <p className="breadcrumb"><Link to="/">Laboratórios</Link><span aria-hidden="true">/</span><span>Detalhes do laboratório</span></p>
    {estado.tipo === 'carregando' ? <><h1>Detalhes do laboratório</h1><p role="status">Carregando laboratório...</p></>
      : estado.tipo === 'erro' ? <><h1>Detalhes do laboratório</h1><section role="alert"><p>{estado.mensagem}</p><button type="button" onClick={tentarNovamente}>Tentar novamente</button></section></>
      : !espaco ? <><h1>Detalhes do laboratório</h1><p role="status">Laboratório não encontrado no catálogo acessível à sua conta.</p></>
      : <>
        <section className="detail-hero" aria-labelledby="detail-lab-title">
          <div className="detail-hero__content">
            <span className={'availability-pill ' + (espaco.disponivel ? 'availability-pill--open' : 'availability-pill--closed')}>
              <span className="availability-pill__dot" aria-hidden="true" />
              {espaco.disponivel ? 'Espaço ativo' : 'Espaço indisponível'}
            </span>
            <h1 id="detail-lab-title">{espaco.nome}</h1>
            <p className="detail-hero__summary">A situação cadastral não confirma horários livres.</p>
            <div className="detail-hero__facts">
              <div className="detail-hero__fact"><span><span className="detail-hero__fact-label">Localização · Bloco</span><strong>{espaco.bloco?.trim() || 'Localização não informada.'}</strong></span></div>
              <div className="detail-hero__fact"><span><span className="detail-hero__fact-label">Capacidade</span><strong>{espaco.capacidade === null ? 'Capacidade não informada.' : `${espaco.capacidade} pessoas`}</strong></span></div>
            </div>
          </div>
        </section>
        <div className="detail-info-layout">
          <div className="detail-info-main">
            <section className="detail-card" aria-labelledby="detail-about-title">
              <h2 id="detail-about-title">Sobre o laboratório</h2>
              <p>{espaco.descricao?.trim() || 'Descrição não informada.'}</p>
            </section>
            <section className="detail-card" aria-labelledby="detail-resources-title">
              <h2 id="detail-resources-title">Recursos associados</h2>
              {espaco.recursos.length ? <ul className="detail-rules__list">{espaco.recursos.map(recurso => <li key={recurso.id}>
                <strong>{recurso.nome.trim() || 'Recurso sem nome informado'}</strong>
                {recurso.tipo.trim() ? ` · ${recurso.tipo}` : ''}
                {' — '}{recurso.disponibilidade ? 'Disponível' : 'Indisponível'}
                {recurso.autorizacao_necessaria ? ' · Requer autorização' : ''}
              </li>)}</ul> : <p>Nenhum recurso informado.</p>}
            </section>
          </div>
          <div className="detail-slots-column">
            <section className="detail-card detail-hours" aria-labelledby="detail-hours-title">
              <h2 id="detail-hours-title">Horário de funcionamento</h2>
              {horarios.length ? <>
                <p className="detail-card__note">Horários cadastrados na API; não representam horários livres para reserva. Dias não informados não têm funcionamento confirmado.</p>
                <dl className="detail-hours__rows">{horarios.map(horario => <div className="detail-hours__row" key={horario.id}>
                  <dt>{nomesDias[horario.dia_semana]}</dt>
                  <dd>{horario.ativo ? `${horario.hora_abertura} — ${horario.hora_fechamento}` : 'Inativo'}</dd>
                </div>)}</dl>
              </> : <p>Horários de funcionamento não informados.</p>}
            </section>
            <section className="detail-card" aria-labelledby="detail-booking-title">
              <h2 id="detail-booking-title">Consultar disponibilidade</h2>
              <p>Consulte os horários disponíveis, informe a finalidade e envie uma solicitação para análise.</p>
              <Link className="booking-back-link" to={`/laboratorios/${espaco.id}/agendamento`}>Consultar horários disponíveis</Link>
            </section>
          </div>
        </div>
      </>}
    <Link className="booking-back-link" to="/">Voltar ao catálogo</Link>
  </main></>
}
