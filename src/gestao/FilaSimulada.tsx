import { useState } from 'react'
import { atualizarStatusSolicitacaoSimulada, listarSolicitacoesSimuladas } from '../services/simuladorLocal'
import type { StatusSolicitacao, SolicitacaoResposta } from '../types/solicitacao'
import styles from '../pages/PainelAdmin.module.css'

const statusFiltro: Array<{ valor: StatusSolicitacao; rotulo: string }> = [
  { valor: 'Pendente', rotulo: 'Pendentes' },
  { valor: 'AguardandoComplementacao', rotulo: 'Aguardando complementação' },
  { valor: 'AguardandoRespostaProposta', rotulo: 'Aguardando resposta do solicitante' },
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

export function FilaSimulada() {
  const [periodo, setPeriodo] = useState('todos')
  const [laboratorio, setLaboratorio] = useState('todos')
  const [finalidade, setFinalidade] = useState('todas')
  const [status, setStatus] = useState('todos')
  const [inicio, setInicio] = useState('')
  const [fim, setFim] = useState('')
  const [solicitacoes, setSolicitacoes] = useState<SolicitacaoResposta[]>(() =>
    listarSolicitacoesSimuladas(),
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

  return <>
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
          <span className={styles.valorIndicador}>{indicador.valor}</span>
          <span className={styles.nomeIndicador}>{indicador.titulo}</span>
        </article>
      ))}
    </div>

    <p className={styles.aviso} role="note">
      As solicitações e decisões de teste ficam somente neste navegador.
    </p>

    <div className={styles.filtros}>
      <label className={styles.campo}>
        <span>Laboratório</span>
        <select value={laboratorio} onChange={evento => setLaboratorio(evento.target.value)}>
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

      {periodo === 'personalizado' && (
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
        <select value={finalidade} onChange={evento => setFinalidade(evento.target.value)}>
          <option value="todas">Todas as finalidades</option>
          {finalidades.map(valor => <option key={valor} value={valor}>{valor}</option>)}
        </select>
      </label>

      <label className={styles.campo}>
        <span>Status</span>
        <select value={status} onChange={evento => setStatus(evento.target.value)}>
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
            <span className={`${styles.statusSolicitacao} ${styles[`status${solicitacao.status}`] ?? ''}`}>{solicitacao.status === 'AguardandoRespostaProposta' ? 'Aguardando resposta do solicitante' : solicitacao.status}</span>
            {solicitacao.decisao_justificativa && <p>Motivo: {solicitacao.decisao_justificativa}</p>}
          </div>
          {solicitacao.status === 'Pendente' && id !== null && (
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
      {solicitacoes.length === 0 ? 'Nenhuma solicitação de teste ainda.' : 'Nenhuma solicitação corresponde aos filtros selecionados.'}
    </p>}
  </>
}
