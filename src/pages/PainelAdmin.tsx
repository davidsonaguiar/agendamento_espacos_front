import { useState } from 'react'
import { Cabecalho } from '../components/Cabecalho'
import styles from './PainelAdmin.module.css'

type AbaPainel = 'aprovacoes' | 'agenda' | 'laboratorios'

const abas: Array<{ id: AbaPainel; titulo: string }> = [
  { id: 'aprovacoes', titulo: 'Aprovações' },
  { id: 'agenda', titulo: 'Agenda' },
  { id: 'laboratorios', titulo: 'Laboratórios' },
]

const indicadores = [
  { titulo: 'Pendentes', cor: 'amarelo' },
  { titulo: 'Aprovadas hoje', cor: 'verde' },
  { titulo: 'Conflitos detectados', cor: 'vermelho' },
  { titulo: 'Laboratórios', cor: 'azul' },
] as const

export function PainelAdmin() {
  const [abaAtiva, setAbaAtiva] = useState<AbaPainel>('aprovacoes')
  const [periodo, setPeriodo] = useState('todos')

  return (
    <>
      <Cabecalho perfil="gestor" />
      <main className={styles.pagina}>
        <header className={styles.cabecalhoPagina}>
          <h1>Painel do gestor</h1>
          <p>Gerencie solicitações e acompanhe a utilização dos laboratórios.</p>
        </header>

        <div className={styles.abas} role="tablist" aria-label="Seções do painel do gestor">
          {abas.map(aba => (
            <button
              key={aba.id}
              id={`aba-${aba.id}`}
              className={`${styles.botaoAba} ${abaAtiva === aba.id ? styles.abaAtiva : ''}`}
              type="button"
              role="tab"
              aria-selected={abaAtiva === aba.id}
              aria-controls={`conteudo-${aba.id}`}
              onClick={() => setAbaAtiva(aba.id)}
            >
              {aba.titulo}
            </button>
          ))}
        </div>

        <section
          id="conteudo-aprovacoes"
          className={styles.conteudoAba}
          role="tabpanel"
          aria-labelledby="aba-aprovacoes"
          hidden={abaAtiva !== 'aprovacoes'}
        >
          <header className={styles.tituloSecao}>
            <h2>Fila de aprovação</h2>
            <p>Analise solicitações pendentes ou consulte o histórico de decisões.</p>
          </header>

          <div className={styles.indicadores} aria-label="Indicadores aguardando integração">
            {indicadores.map(indicador => (
              <article
                key={indicador.titulo}
                className={`${styles.indicador} ${styles[indicador.cor]}`}
              >
                <span className={styles.valorIndicador} aria-label="Não disponível">—</span>
                <span className={styles.nomeIndicador}>{indicador.titulo}</span>
              </article>
            ))}
          </div>

          <p className={styles.aviso} role="note">
            As solicitações e os indicadores serão carregados após a integração com o backend.
            Nenhuma aprovação ou rejeição é registrada por esta tela.
          </p>

          <div className={styles.filtros}>
            <label className={styles.campo}>
              <span>Laboratório</span>
              <select disabled defaultValue="todos">
                <option value="todos">Todos os laboratórios</option>
              </select>
            </label>

            <label className={styles.campo}>
              <span>Período</span>
              <select value={periodo} onChange={evento => setPeriodo(evento.target.value)}>
                <option value="todos">Todas as datas</option>
                <option value="hoje">Hoje</option>
                <option value="proximos-7">Próximos 7 dias</option>
                <option value="ultimos-7">Últimos 7 dias</option>
                <option value="ultimos-30">Últimos 30 dias</option>
                <option value="personalizado">Intervalo personalizado</option>
              </select>
            </label>

            {periodo === 'personalizado' && (
              <fieldset className={`${styles.campo} ${styles.intervalo}`}>
                <legend>Intervalo de datas</legend>
                <div className={styles.datas}>
                  <label>
                    <span className={styles.rotuloOculto}>Data inicial</span>
                    <input type="date" disabled />
                  </label>
                  <span>até</span>
                  <label>
                    <span className={styles.rotuloOculto}>Data final</span>
                    <input type="date" disabled />
                  </label>
                </div>
              </fieldset>
            )}

            <label className={styles.campo}>
              <span>Finalidade</span>
              <select disabled defaultValue="todas">
                <option value="todas">Todas as finalidades</option>
              </select>
            </label>

            <label className={styles.campo}>
              <span>Status</span>
              <select disabled defaultValue="todos">
                <option value="todos">Todos os status</option>
                <option value="pendente">Pendentes</option>
                <option value="conflito">Conflitos</option>
                <option value="aprovado">Aprovados</option>
                <option value="rejeitado">Rejeitados</option>
              </select>
            </label>
          </div>

          <p className={styles.estadoVazio} role="status">
            Nenhuma solicitação carregada. Elas aparecerão aqui após a integração com o backend.
          </p>
        </section>

        <section
          id="conteudo-agenda"
          className={styles.conteudoAba}
          role="tabpanel"
          aria-labelledby="aba-agenda"
          hidden={abaAtiva !== 'agenda'}
        >
          <header className={styles.tituloSecao}>
            <h2>Agenda mestre</h2>
            <p>Visualize reservas por laboratório e identifique conflitos de horário.</p>
          </header>
          <p className={styles.estadoVazio} role="status">
            Nenhuma reserva carregada. A agenda estará disponível após a integração com o backend.
          </p>
        </section>

        <section
          id="conteudo-laboratorios"
          className={styles.conteudoAba}
          role="tabpanel"
          aria-labelledby="aba-laboratorios"
          hidden={abaAtiva !== 'laboratorios'}
        >
          <header className={styles.tituloSecao}>
            <h2>Gestão de laboratórios</h2>
            <p>A edição dos espaços estará disponível após a integração com o backend.</p>
          </header>
          <p className={styles.estadoVazio} role="status">
            Nenhum laboratório carregado. Os dados serão exibidos após a integração com o backend.
          </p>
        </section>
      </main>
    </>
  )
}
