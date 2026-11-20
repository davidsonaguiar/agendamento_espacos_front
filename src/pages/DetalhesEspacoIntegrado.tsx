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
        {espaco.disponivel ? <Link className="button button--primary" to={`/laboratorios/${espaco.id}/agendamento`}>Solicitar agendamento</Link>
          : <p>Este laboratório está indisponível para novas solicitações.</p>}
      </>}
  </main></>
}
