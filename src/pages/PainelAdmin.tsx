import { useEffect, useState, type FormEvent } from 'react'
import { Cabecalho } from '../components/Cabecalho'
import { criarEspaco, listarEspacos } from '../services/espacos'
import { atualizarStatusSolicitacaoSimulada, listarSolicitacoesSimuladas, simuladorLocalAtivo } from '../services/simuladorLocal'
import type { CriarEspacoInput, EspacoApi } from '../types/espaco'
import type { StatusSolicitacao, SolicitacaoResposta } from '../types/solicitacao'
import styles from './PainelAdmin.module.css'

type AbaPainel = 'aprovacoes' | 'agenda' | 'laboratorios'

const abas: Array<{ id: AbaPainel; titulo: string }> = [
  { id: 'aprovacoes', titulo: 'Aprovações' },
  { id: 'agenda', titulo: 'Agenda' },
  { id: 'laboratorios', titulo: 'Laboratórios' },
]

const statusFiltro: Array<{ valor: StatusSolicitacao; rotulo: string }> = [
  { valor: 'Pendente', rotulo: 'Pendentes' },
  { valor: 'AguardandoComplementacao', rotulo: 'Aguardando complementação' },
  { valor: 'AguardandoRespostaProposta', rotulo: 'Aguardando resposta à proposta' },
  { valor: 'Aprovado', rotulo: 'Aprovados' },
  { valor: 'Rejeitado', rotulo: 'Rejeitados' },
  { valor: 'Cancelada', rotulo: 'Cancelados' },
]

const hojeIso = () => {
  const data = new Date()
  return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}-${String(data.getDate()).padStart(2, '0')}`
}

function dataExibida(dataIso: string | undefined) {
  if (!dataIso) return 'Data não informada'
  const [ano, mes, dia] = dataIso.split('-')
  return `${dia}/${mes}/${ano}`
}

function filtrarPorPeriodo(dataIso: string | undefined, periodo: string, inicio: string, fim: string) {
  if (!dataIso || periodo === 'todos') return periodo === 'todos'
  const hoje = new Date()
  const dataHoje = hojeIso()
  if (periodo === 'hoje') return dataIso === dataHoje
  if (periodo === 'personalizado') return (!inicio || dataIso >= inicio) && (!fim || dataIso <= fim)

  const limite = new Date(hoje)
  const futuro = periodo === 'proximos-7'
  limite.setDate(limite.getDate() + (futuro ? 7 : periodo === 'ultimos-7' ? -7 : -30))
  const limiteIso = `${limite.getFullYear()}-${String(limite.getMonth() + 1).padStart(2, '0')}-${String(limite.getDate()).padStart(2, '0')}`
  return futuro ? dataIso >= dataHoje && dataIso <= limiteIso : dataIso <= dataHoje && dataIso >= limiteIso
}

export function PainelAdmin() {
  const [abaAtiva, setAbaAtiva] = useState<AbaPainel>('aprovacoes')
  const [nomeEspaco, setNomeEspaco] = useState('')
  const [descricaoEspaco, setDescricaoEspaco] = useState('')
  const [capacidadeEspaco, setCapacidadeEspaco] = useState('')
  const [blocoEspaco, setBlocoEspaco] = useState('')
  const [disponibilidadeEspaco, setDisponibilidadeEspaco] = useState(true)
  const [espacos, setEspacos] = useState<EspacoApi[]>([])
  const [carregandoEspacos, setCarregandoEspacos] = useState(false)
  const [salvandoEspaco, setSalvandoEspaco] = useState(false)
  const [erroEspacos, setErroEspacos] = useState('')
  const [sucessoEspaco, setSucessoEspaco] = useState('')
  const [periodo, setPeriodo] = useState('todos')
  const [laboratorio, setLaboratorio] = useState('todos')
  const [finalidade, setFinalidade] = useState('todas')
  const [status, setStatus] = useState('todos')
  const [inicio, setInicio] = useState('')
  const [fim, setFim] = useState('')
  const [solicitacoes, setSolicitacoes] = useState<SolicitacaoResposta[]>(() =>
    simuladorLocalAtivo ? listarSolicitacoesSimuladas() : [],
  )
  const [recusaSelecionada, setRecusaSelecionada] = useState<number | null>(null)
  const [justificativa, setJustificativa] = useState('')
  const [erroAcao, setErroAcao] = useState('')

  const pendentes = solicitacoes.filter(solicitacao => solicitacao.status === 'Pendente')
  const aprovadas = solicitacoes.filter(solicitacao => solicitacao.status === 'Aprovado')
  const rejeitadas = solicitacoes.filter(solicitacao => solicitacao.status === 'Rejeitado')
  const laboratorios = [...new Set(solicitacoes.map(solicitacao => solicitacao.espaco?.nome).filter((nome): nome is string => Boolean(nome)))]
  const finalidades = [...new Set(solicitacoes.map(solicitacao => solicitacao.finalidade))]
  const solicitacoesFiltradas = solicitacoes.filter(solicitacao => {
    const data = solicitacao.horarios[0]?.data_reserva
    return (laboratorio === 'todos' || solicitacao.espaco?.nome === laboratorio) &&
      (finalidade === 'todas' || solicitacao.finalidade === finalidade) &&
      (status === 'todos' || solicitacao.status === status) &&
      filtrarPorPeriodo(data, periodo, inicio, fim)
  })

  async function carregarEspacos() {
    setCarregandoEspacos(true)
    setErroEspacos('')
    try {
      setEspacos(await listarEspacos())
    } catch (erro) {
      setErroEspacos(erro instanceof Error ? erro.message : 'Não foi possível carregar os espaços.')
    } finally {
      setCarregandoEspacos(false)
    }
  }

  useEffect(() => {
    if (!simuladorLocalAtivo) void carregarEspacos()
  }, [])

  async function cadastrarEspaco(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    setSalvandoEspaco(true)
    setErroEspacos('')
    setSucessoEspaco('')
    const dados: CriarEspacoInput = {
      nome: nomeEspaco.trim(),
      descricao: descricaoEspaco.trim() || null,
      capacidade: capacidadeEspaco ? Number(capacidadeEspaco) : null,
      bloco: blocoEspaco.trim() || null,
      disponibilidade: disponibilidadeEspaco,
    }
    try {
      const criado = await criarEspaco(dados)
      setEspacos(atuais => [...atuais.filter(espaco => espaco.id !== criado.id), criado])
      setNomeEspaco('')
      setDescricaoEspaco('')
      setCapacidadeEspaco('')
      setBlocoEspaco('')
      setDisponibilidadeEspaco(true)
      setSucessoEspaco(`Espaço "${criado.nome}" cadastrado com sucesso.`)
    } catch (erro) {
      setErroEspacos(erro instanceof Error ? erro.message : 'Não foi possível cadastrar o espaço.')
    } finally {
      setSalvandoEspaco(false)
    }
  }

  function decidir(id: number, novoStatus: Extract<StatusSolicitacao, 'Aprovado' | 'Rejeitado'>) {
    try {
      const atualizada = atualizarStatusSolicitacaoSimulada(
        id,
        novoStatus,
        novoStatus === 'Rejeitado' ? justificativa.trim() : null,
      )
      setSolicitacoes(atuais => atuais.map(solicitacao => solicitacao.id === id ? atualizada : solicitacao))
      setRecusaSelecionada(null)
      setJustificativa('')
      setErroAcao('')
    } catch (erro) {
      setErroAcao(erro instanceof Error ? erro.message : 'Não foi possível atualizar a solicitação de teste.')
    }
  }

  return (
    <>
      <Cabecalho />
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

          <div className={styles.indicadores} aria-label="Indicadores de solicitações locais">
            {[
              { titulo: 'Pendentes', cor: 'amarelo', valor: pendentes.length },
              { titulo: 'Aprovadas', cor: 'verde', valor: aprovadas.length },
              { titulo: 'Rejeitadas', cor: 'vermelho', valor: rejeitadas.length },
              { titulo: 'Laboratórios', cor: 'azul', valor: laboratorios.length },
            ].map(indicador => (
              <article
                key={indicador.titulo}
                className={`${styles.indicador} ${styles[indicador.cor]}`}
              >
                <span className={styles.valorIndicador}>{simuladorLocalAtivo ? indicador.valor : '—'}</span>
                <span className={styles.nomeIndicador}>{indicador.titulo}</span>
              </article>
            ))}
          </div>

          <p className={styles.aviso} role="note">
            {simuladorLocalAtivo
              ? 'Simulador local ativo: solicitações e decisões ficam somente neste navegador. Não são enviadas ao backend e não representam reservas reais.'
              : 'As solicitações e os indicadores serão carregados após a integração com o backend. Nenhuma aprovação ou rejeição é registrada por esta tela.'}
          </p>

          <div className={styles.filtros}>
            <label className={styles.campo}>
              <span>Laboratório</span>
              <select disabled={!simuladorLocalAtivo} value={laboratorio} onChange={evento => setLaboratorio(evento.target.value)}>
                <option value="todos">Todos os laboratórios</option>
                {laboratorios.map(nome => <option key={nome} value={nome}>{nome}</option>)}
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

            {simuladorLocalAtivo && periodo === 'personalizado' && (
              <fieldset className={`${styles.campo} ${styles.intervalo}`}>
                <legend>Intervalo de datas</legend>
                <div className={styles.datas}>
                  <label>
                    <span className={styles.rotuloOculto}>Data inicial</span>
                    <input type="date" value={inicio} onChange={evento => setInicio(evento.target.value)} />
                  </label>
                  <span>até</span>
                  <label>
                    <span className={styles.rotuloOculto}>Data final</span>
                    <input type="date" value={fim} onChange={evento => setFim(evento.target.value)} />
                  </label>
                </div>
              </fieldset>
            )}

            <label className={styles.campo}>
              <span>Finalidade</span>
              <select disabled={!simuladorLocalAtivo} value={finalidade} onChange={evento => setFinalidade(evento.target.value)}>
                <option value="todas">Todas as finalidades</option>
                {finalidades.map(valor => <option key={valor} value={valor}>{valor}</option>)}
              </select>
            </label>

            <label className={styles.campo}>
              <span>Status</span>
              <select disabled={!simuladorLocalAtivo} value={status} onChange={evento => setStatus(evento.target.value)}>
                <option value="todos">Todos os status</option>
                {statusFiltro.map(item => <option key={item.valor} value={item.valor}>{item.rotulo}</option>)}
              </select>
            </label>
          </div>

          {erroAcao && <p className={styles.erro} role="alert">{erroAcao}</p>}
          {solicitacoesFiltradas.length > 0 ? <ul className={styles.listaSolicitacoes}>
            {solicitacoesFiltradas.map(solicitacao => {
              const horario = solicitacao.horarios[0]
              const id = solicitacao.id
              return <li className={styles.solicitacao} key={id ?? `${solicitacao.id_solicitante}-${horario?.data_reserva}`}>
                <div className={styles.dadosSolicitacao}>
                  <h3>{solicitacao.solicitante?.nome_completo ?? 'Solicitante'}</h3>
                  <p>{solicitacao.espaco?.nome ?? 'Laboratório'} · {dataExibida(horario?.data_reserva)} · {horario?.hora_inicio}–{horario?.hora_fim}</p>
                  <p>Finalidade: {solicitacao.finalidade}</p>
                  <span className={`${styles.statusSolicitacao} ${styles[`status${solicitacao.status}`] ?? ''}`}>{solicitacao.status}</span>
                  {solicitacao.decisao_justificativa && <p>Motivo: {solicitacao.decisao_justificativa}</p>}
                </div>
                {simuladorLocalAtivo && solicitacao.status === 'Pendente' && id !== null && (
                  <div className={styles.acoesSolicitacao}>
                    <button type="button" className={styles.botaoAprovar} onClick={() => decidir(id, 'Aprovado')}>Aprovar</button>
                    <button type="button" className={styles.botaoRejeitar} onClick={() => { setRecusaSelecionada(id); setJustificativa('') }}>Rejeitar</button>
                    {recusaSelecionada === id && <form className={styles.formularioRecusa} onSubmit={evento => { evento.preventDefault(); decidir(id, 'Rejeitado') }}>
                      <label htmlFor={`motivo-${id}`}>Motivo da rejeição</label>
                      <textarea id={`motivo-${id}`} value={justificativa} onChange={evento => setJustificativa(evento.target.value)} required maxLength={255} />
                      <button type="submit">Confirmar rejeição</button>
                    </form>}
                  </div>
                )}
              </li>
            })}
          </ul> : <p className={styles.estadoVazio} role="status">
            {simuladorLocalAtivo
              ? solicitacoes.length === 0 ? 'Nenhuma solicitação de teste ainda. Entre como professor e envie uma solicitação para ela aparecer aqui.' : 'Nenhuma solicitação corresponde aos filtros selecionados.'
              : 'Nenhuma solicitação carregada. Elas aparecerão aqui após a integração com o backend.'}
          </p>}
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
            <p>Cadastre novos espaços e consulte os laboratórios registrados no sistema.</p>
          </header>
          {simuladorLocalAtivo ? (
            <p className={styles.aviso} role="note">
              O cadastro de espaços requer conexão com o backend. Desative o simulador local para usar esta função.
            </p>
          ) : (
            <form className={styles.formularioEspaco} onSubmit={evento => { void cadastrarEspaco(evento) }}>
              <h3>Cadastrar laboratório</h3>
              <div className={styles.camposEspaco}>
                <label className={styles.campo}>
                  <span>Nome *</span>
                  <input
                    value={nomeEspaco}
                    onChange={evento => setNomeEspaco(evento.target.value)}
                    required
                    minLength={3}
                    maxLength={120}
                    disabled={salvandoEspaco}
                  />
                </label>
                <label className={styles.campo}>
                  <span>Descrição</span>
                  <input
                    value={descricaoEspaco}
                    onChange={evento => setDescricaoEspaco(evento.target.value)}
                    disabled={salvandoEspaco}
                  />
                </label>
                <label className={styles.campo}>
                  <span>Capacidade</span>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={capacidadeEspaco}
                    onChange={evento => setCapacidadeEspaco(evento.target.value)}
                    disabled={salvandoEspaco}
                  />
                </label>
                <label className={styles.campo}>
                  <span>Bloco</span>
                  <input
                    value={blocoEspaco}
                    onChange={evento => setBlocoEspaco(evento.target.value)}
                    disabled={salvandoEspaco}
                  />
                </label>
                <label className={styles.checkboxEspaco}>
                  <input
                    type="checkbox"
                    checked={disponibilidadeEspaco}
                    onChange={evento => setDisponibilidadeEspaco(evento.target.checked)}
                    disabled={salvandoEspaco}
                  />
                  Disponível para agendamento
                </label>
              </div>
              <p className={styles.dicaEspaco}>O backend define o horário padrão de funcionamento de segunda a sexta, das 8h às 18h.</p>
              {erroEspacos && <p className={styles.erro} role="alert">{erroEspacos}</p>}
              {sucessoEspaco && <p className={styles.sucessoEspaco} role="status">{sucessoEspaco}</p>}
              <button className={styles.botaoEspaco} type="submit" disabled={salvandoEspaco}>
                {salvandoEspaco ? 'Cadastrando...' : 'Cadastrar laboratório'}
              </button>
            </form>
          )}

          <div className={styles.listaEspacos}>
            <div className={styles.tituloListaEspacos}>
              <h3>Laboratórios cadastrados</h3>
              {!simuladorLocalAtivo && (
                <button type="button" className={styles.botaoEspacoSecundario} onClick={() => { void carregarEspacos() }} disabled={carregandoEspacos}>
                  {carregandoEspacos ? 'Atualizando...' : 'Atualizar lista'}
                </button>
              )}
            </div>
            {simuladorLocalAtivo ? (
              <p className={styles.estadoVazio} role="status">A lista da API não fica disponível no simulador local.</p>
            ) : carregandoEspacos ? (
              <p className={styles.estadoVazio} role="status">Carregando laboratórios...</p>
            ) : erroEspacos && !simuladorLocalAtivo ? (
              <div>
                <p className={styles.estadoVazio} role="alert">{erroEspacos}</p>
                <button type="button" className={styles.botaoEspacoSecundario} onClick={() => { void carregarEspacos() }}>Tentar novamente</button>
              </div>
            ) : espacos.length ? (
              <ul className={styles.listaEspacosItens}>
                {espacos.map(espaco => (
                  <li className={styles.itemEspaco} key={espaco.id}>
                    <div>
                      <h4>{espaco.nome}</h4>
                      <p>{[espaco.bloco, espaco.capacidade !== null ? `${espaco.capacidade} pessoas` : null].filter(Boolean).join(' · ') || 'Localização e capacidade não informadas'}</p>
                      {espaco.descricao && <p>{espaco.descricao}</p>}
                    </div>
                    <span className={espaco.disponibilidade ? styles.espacoDisponivel : styles.espacoIndisponivel}>
                      {espaco.disponibilidade ? 'Disponível' : 'Indisponível'}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className={styles.estadoVazio} role="status">Nenhum laboratório cadastrado.</p>
            )}
          </div>
        </section>
      </main>
    </>
  )
}
