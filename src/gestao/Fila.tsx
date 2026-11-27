import { useCallback, useState } from 'react'
import { decidir, listarFila, consultarEstadoSolicitacao, type Decisao, type EspacoGestao } from './api'
import { Interacao } from './Interacao'
import { HistoricoGestor } from './HistoricoGestor'
import { obterUsuarioAutenticado } from '../services/autenticacao'
import { useConsulta } from './consulta'
import { AvisoConsulta, Confirmacao, useEscritaSegura, dataBR, hojeLocal, somarDias } from './Controles'
import type { SolicitacaoResposta } from '../types/solicitacao'
import styles from '../pages/PainelAdmin.module.css'

const periodos = ['Todas as datas', 'Hoje', 'Próximos 7 dias', 'Últimos 7 dias', 'Últimos 30 dias', 'Intervalo personalizado']
const situacoes: Record<string, string> = {
  Pendente: 'Pendente', Aprovado: 'Aprovado', Rejeitado: 'Rejeitado', Cancelada: 'Cancelada',
  AguardandoComplementacao: 'Aguardando complementação', AguardandoRespostaProposta: 'Aguardando resposta do solicitante',
}

function intervalo(periodo: string, inicio: string, fim: string) {
  const hoje = hojeLocal()
  switch (periodo) {
    case 'Hoje': return [hoje, hoje]
    case 'Próximos 7 dias': return [hoje, somarDias(hoje, 6)]
    case 'Últimos 7 dias': return [somarDias(hoje, -6), hoje]
    case 'Últimos 30 dias': return [somarDias(hoje, -29), hoje]
    case 'Intervalo personalizado': return [inicio, fim]
    default: return ['', '']
  }
}

export function Fila({ espacos }: { espacos: EspacoGestao[] }) {
  const ids = espacos.map(e => e.id).join(',')
  const carregar = useCallback((signal: AbortSignal) => listarFila(ids ? ids.split(',').map(Number) : [], signal), [ids])
  const { dados, erro, atualizar } = useConsulta(carregar)
  const [laboratorio, setLaboratorio] = useState('')
  const [status, setStatus] = useState('')
  const [finalidade, setFinalidade] = useState('')
  const [periodo, setPeriodo] = useState(periodos[0])
  const [inicio, setInicio] = useState('')
  const [fim, setFim] = useState('')
  const [interacao, setInteracao] = useState<{ solicitacao: SolicitacaoResposta; proposta: boolean } | null>(null)
  const [escolha, setEscolha] = useState<{ solicitacao: SolicitacaoResposta; decisao: Decisao } | null>(null)
  const operacao = `solicitacao:${escolha?.solicitacao.id ?? 'nenhuma'}:decisao`
  const rascunho = useEscritaSegura(operacao, { justificativa: '' })
  const justificativa = rascunho.dados.justificativa
  const setJustificativa = (v: string) => rascunho.alterar('justificativa', v)
  const [aviso, setAviso] = useState('')
  if (!dados) return <AvisoConsulta erro={erro} atualizar={atualizar} />
  const nomes = new Map(espacos.map(e => [e.id, e.nome]))
  const [de, ate] = intervalo(periodo, inicio, fim)
  const invalido = Boolean(de && ate && de > ate)
  const visiveis = dados.filter(s => (!laboratorio || String(s.id_espaco) === laboratorio) &&
    (!status || s.status === status) && (!finalidade || finalidade === s.finalidade) &&
    (!de && !ate || s.horarios.some(h => (!de || h.data_reserva >= de) && (!ate || h.data_reserva <= ate))))
  const indicadores = [
    ['Pendentes', 'amarelo', dados.filter(s => s.status === 'Pendente').length],
    ['Aprovadas', 'verde', dados.filter(s => s.status === 'Aprovado').length],
    ['Rejeitadas', 'vermelho', dados.filter(s => s.status === 'Rejeitado').length],
    ['Laboratórios', 'azul', espacos.length],
  ] as const
  function abrir(solicitacao: SolicitacaoResposta, decisao: Decisao) {
    setAviso('')
    setEscolha({ solicitacao, decisao })
  }
  return <>
    <div className={styles.indicadores}>{indicadores.map(([titulo, cor, valor]) =>
      <div key={titulo} className={styles.indicador + ' ' + styles[cor]}>
        <strong className={styles.valorIndicador}>{valor}</strong><span>{titulo}</span>
      </div>)}</div>
    <div className={styles.filtros}>
      <label className={styles.campo}>Laboratório<select value={laboratorio} onChange={e => setLaboratorio(e.target.value)}>
        <option value="">Todos os laboratórios</option>{espacos.map(e => <option key={e.id} value={e.id}>{e.nome}</option>)}
      </select></label>
      <label className={styles.campo}>Período<select value={periodo} onChange={e => setPeriodo(e.target.value)}>
        {periodos.map(p => <option key={p}>{p}</option>)}
      </select></label>
      {periodo === 'Intervalo personalizado' && <>
        <label className={styles.campo}>Data inicial<input type="date" value={inicio} onChange={e => setInicio(e.target.value)} /></label>
        <label className={styles.campo}>Data final<input type="date" value={fim} onChange={e => setFim(e.target.value)} /></label>
      </>}
      <label className={styles.campo}>Finalidade<select value={finalidade} onChange={e => setFinalidade(e.target.value)}>
        <option value="">Todas as finalidades</option>
        {[...new Set(dados.map(s => s.finalidade))].sort().map(f => <option key={f}>{f}</option>)}
      </select></label>
      <label className={styles.campo}>Status<select value={status} onChange={e => setStatus(e.target.value)}>
        <option value="">Todos os status</option>{Object.entries(situacoes).map(([s, nome]) => <option key={s} value={s}>{nome}</option>)}
      </select></label>
      <button onClick={atualizar}>Atualizar fila</button>
    </div>
    {aviso && <p role="status">{aviso}</p>}
    {invalido ? <p role="alert">A data final deve ser igual ou posterior à inicial.</p> :
      visiveis.length === 0 ? <p className={styles.estadoVazio}>Nenhuma solicitação para os filtros selecionados.</p> :
        visiveis.map(s => <article className={styles.cartao} key={s.id}>
          <header className={styles.solicitacaoCabecalho}><h3>Solicitação #{s.id} · {nomes.get(s.id_espaco)}</h3>
            <span className={`agenda-status agenda-status--${s.status}`}>{situacoes[s.status] ?? s.status}</span>
          </header>
          <div className={styles.solicitacaoDados}><p><strong>Finalidade:</strong> {s.finalidade}{s.urgencia && ' · Urgente'}</p>
            <p><strong>Solicitante:</strong> {s.solicitante?.nome_completo ?? '#' + s.id_solicitante} · {s.tipo}</p>
            <strong>Datas e horários</strong><ul>{s.horarios.map(h => <li key={h.id ?? h.data_reserva + h.hora_inicio}>{dataBR(h.data_reserva)} das {h.hora_inicio.slice(0, 5)} às {h.hora_fim.slice(0, 5)}</li>)}</ul>
          </div>
          <HistoricoGestor interacoes={s.interacoes ?? []} idSolicitante={s.id_solicitante} idUsuario={obterUsuarioAutenticado()?.id} />
          {s.decisao_justificativa && <section className={`decision-reason decision-reason--${s.status}`} aria-label="Justificativa da decisão"><strong>Justificativa</strong><p>{s.decisao_justificativa}</p></section>}
          {s.status === 'Pendente' && s.id != null && <div className={styles.acoes}>
            <button className={styles.acaoAprovar} onClick={() => abrir(s, 'Aprovado')}>Aprovar</button>
            <button className={styles.acaoRejeitar} onClick={() => abrir(s, 'Rejeitado')}>Rejeitar</button>
            <button onClick={() => setInteracao({ solicitacao: s, proposta: true })}>Sugerir novo horário</button>
            <button onClick={() => setInteracao({ solicitacao: s, proposta: false })}>Pedir complementação</button>
          </div>}
        </article>)}
    {interacao && <Interacao {...interacao} fechar={() => setInteracao(null)}
      salvo={() => { setInteracao(null); setAviso('Mensagem registrada.'); atualizar() }} />}
    {escolha && <Confirmacao operacao={operacao} consultar={signal => consultarEstadoSolicitacao(escolha.solicitacao.id!, signal)} titulo={`${escolha.decisao === 'Aprovado' ? 'Aprovar' : 'Rejeitar'} solicitação #${escolha.solicitacao.id}`}
      confirmar={() => {
        const texto = justificativa.trim()
        if (texto.length < 3) throw new Error('Informe uma justificativa com pelo menos três caracteres.')
        return decidir(escolha.solicitacao.id!, escolha.decisao, texto)
      }}
      aoSalvar={() => { setEscolha(null); setAviso('Decisão registrada.'); atualizar() }}
      fechar={() => setEscolha(null)}>
      <label className={styles.campo}>Justificativa<textarea required minLength={3} maxLength={1000}
        value={justificativa} onChange={e => setJustificativa(e.target.value)} /></label>
    </Confirmacao>}
  </>
}
