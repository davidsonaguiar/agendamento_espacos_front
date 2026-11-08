import { Link } from 'react-router-dom'
import { Cabecalho } from '../components/Cabecalho'
import { CartaoEspaco } from '../components/CartaoEspaco'
import { useCatalogoEspacos } from '../hooks/useCatalogoEspacos'

/** Usa somente a consulta já confirmada; não presume um GET /espacos/:id. */
export function DetalhesEspacoIntegrado({ id }: { id: string }) {
  const { estado, tentarNovamente } = useCatalogoEspacos()
  const espaco = estado.tipo === 'pronto' ? estado.espacos.find(e => String(e.id) === id) : undefined
  return <><Cabecalho /><main className="page-shell">
    <h1>Detalhes do laboratório</h1>
    <Link className="booking-back-link" to="/">Voltar ao catálogo</Link>
    {estado.tipo === 'carregando' ? <p role="status">Carregando laboratório...</p>
      : estado.tipo === 'erro' ? <section role="alert"><p>{estado.mensagem}</p><button type="button" onClick={tentarNovamente}>Tentar novamente</button></section>
      : !espaco ? <p role="status">Laboratório não encontrado no catálogo acessível à sua conta.</p>
      : <><CartaoEspaco espaco={espaco} mostrarLink={false} />
        <p className="booking-notice">A consulta de disponibilidade e o envio de solicitações ainda não estão integrados. Nenhum horário demonstrativo é apresentado para este laboratório.</p>
        <Link className="booking-back-link" to={`/laboratorios/${espaco.id}/agendamento`}>Consultar situação do agendamento</Link>
      </>}
  </main></>
}

/** Mantém URLs existentes, sem resolver IDs reais nas fixtures do protótipo. */
export function AgendamentoIntegracaoPendente() {
  return <><Cabecalho /><main className="page-shell">
    <h1>Agendamento ainda não integrado</h1>
    <p role="status">A disponibilidade e o envio de solicitações serão integrados em uma próxima etapa. Nenhuma reserva foi criada.</p>
    <Link className="button button--primary" to="/">Voltar ao catálogo</Link>
  </main></>
}
