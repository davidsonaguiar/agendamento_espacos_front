import type { FormEvent } from 'react'
import styles from './RespostaAluno.module.css'
import { ControleHistorico } from './ControleHistorico'
import type { InteracaoSolicitacaoConsulta, SolicitacaoConsulta, HorarioSolicitacaoConsulta } from '../types/solicitacaoConsulta'
import { responderSolicitacao } from '../services/agendamentoAluno'
import { obterUsuarioAutenticado } from '../services/autenticacao'
import { ErroHttp } from '../services/http'
import { validarListaSolicitacoes } from '../data/solicitacoesRecebidas'
import { lerData, microsHora } from '../data/disponibilidade'
import { formatarHoraSolicitacao } from '../data/apresentacaoSolicitacoes'
import { dataBR, useEscritaSegura, FeedbackEscrita } from '../gestao/Controles'
import { consultarEstadoSolicitacao } from '../gestao/api'

type DadosResposta = Pick<SolicitacaoConsulta, 'id' | 'id_solicitante' | 'status' | 'decisao_justificativa' | 'interacoes'>
const tiposInteracao: Record<InteracaoSolicitacaoConsulta['tipo'], string> = {
  ComplementacaoSolicitada: 'Pedido de complementação', ComplementacaoRespondida: 'Resposta à complementação',
  ReplanejamentoProposto: 'Proposta de horário', PropostaRespondida: 'Resposta à proposta',
}
const situacoesInteracao: Record<InteracaoSolicitacaoConsulta['situacao'], string> = {
  AguardandoResposta: 'Aguardando resposta', Respondida: 'Respondida', Aceita: 'Aceita', Recusada: 'Recusada',
}
function autoriaInteracao(i: InteracaoSolicitacaoConsulta, solicitante: number) {
  if (i.id_usuario === solicitante) return { rotulo: 'Solicitante', classe: styles.solicitante }
  if (Number.isSafeInteger(i.id_usuario) && i.id_usuario > 0
    && (i.tipo === 'ComplementacaoSolicitada' || i.tipo === 'ReplanejamentoProposto')) {
    return { rotulo: 'Gestão', classe: styles.gestao }
  }
  return { rotulo: `Autor ID ${i.id_usuario}`, classe: styles.neutro }
}
function DataInteracao({ valor }: { valor: string }) {
  const data = new Date(valor)
  if (!Number.isFinite(data.getTime())) return <span>Data indisponível</span>
  return <time dateTime={valor}>{new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZoneName: 'short',
  }).format(data)}</time>
}
function horariosDaProposta(interacao: InteracaoSolicitacaoConsulta): Array<Omit<HorarioSolicitacaoConsulta, 'id'>> {
  const valores = interacao.dados?.horarios
  if (!Array.isArray(valores)) return []
  const resultado: Array<Omit<HorarioSolicitacaoConsulta, 'id'>> = []
  for (const h of valores) {
    if (!h || typeof h !== 'object' || typeof h.data_reserva !== 'string'
      || typeof h.hora_inicio !== 'string' || typeof h.hora_fim !== 'string' || !lerData(h.data_reserva)) return []
    const a = microsHora(h.hora_inicio), b = microsHora(h.hora_fim)
    if (a === null || b === null || a >= b) return []
    resultado.push({ data_reserva: h.data_reserva, hora_inicio: h.hora_inicio, hora_fim: h.hora_fim })
  }
  return resultado
}
function HorariosPropostos({ interacao }: { interacao: InteracaoSolicitacaoConsulta }) {
  const horarios = horariosDaProposta(interacao)
  if (!horarios.length) return <p>Horários propostos indisponíveis. Consulte a coordenação antes de aceitar.</p>
  return <ul>{horarios.map((h, i) => <li key={i}>
    {dataBR(h.data_reserva)} das {formatarHoraSolicitacao(h.hora_inicio)} às {formatarHoraSolicitacao(h.hora_fim)}
  </li>)}</ul>
}
export function RespostaAluno({ solicitacao, atualizar }: { solicitacao: DadosResposta; atualizar: () => void }) {
  const historico = solicitacao.interacoes ?? []
  const proposta = solicitacao.status === 'AguardandoRespostaProposta'
  const pendente = historico.filter(i => i.situacao === 'AguardandoResposta' &&
    (proposta ? i.tipo === 'ReplanejamentoProposto' :
      solicitacao.status === 'AguardandoComplementacao' && i.tipo === 'ComplementacaoSolicitada')).at(-1)
  const controle = useEscritaSegura(`solicitacao:${solicitacao.id}:resposta:${pendente?.id ?? 'nenhuma'}`, { texto: '', aceita: '' })
  const { texto, aceita } = controle.dados
  const usuario = obterUsuarioAutenticado()
  if (!usuario?.ativo || usuario.perfil !== 'Membro' || usuario.id !== solicitacao.id_solicitante) return null
  const idUsuario = usuario.id
  function enviar(evento: FormEvent) {
    evento.preventDefault()
    if (!pendente || !solicitacao.id || proposta && aceita !== 'sim' && aceita !== 'nao') return
    void controle.executar(() => {
      if (texto.trim().length < 3 || texto.trim().length > 2000) throw new Error('Escreva uma resposta entre 3 e 2000 caracteres.')
      if (proposta && aceita === 'sim' && !horariosDaProposta(pendente).length) throw new Error('Não é possível aceitar sem horários propostos válidos.')
      return responderSolicitacao(solicitacao.id!, texto.trim(), proposta ? { id: pendente.id, aceita: aceita === 'sim' } : undefined).then(resposta => {
        const confirmada = validarListaSolicitacoes([resposta])[0]
        if (confirmada.id !== solicitacao.id || confirmada.id_solicitante !== idUsuario) throw new ErroHttp('resposta', 'Não foi possível confirmar a resposta para esta solicitação.')
        return confirmada
      })
    }, atualizar)
  }
  return <>
    {historico.length > 0 && <details className={styles.historico}><ControleHistorico quantidade={historico.length} />
      <ol className={styles.mensagens}>{historico.map(i => {
        const autor = autoriaInteracao(i, solicitacao.id_solicitante)
        return <li key={i.id} className={`${styles.mensagem} ${autor.classe}`}>
          <header className={styles.cabecalhoMensagem}>
            <span className={styles.autor}>{autor.rotulo}</span>
            <span className={styles.data}><DataInteracao valor={i.data_criacao} /></span>
          </header>
          <strong className={styles.tipo}>{tiposInteracao[i.tipo] ?? 'Interação'}</strong>
          <p className={styles.texto}>{i.mensagem}</p>
          {i.tipo === 'ReplanejamentoProposto' && <HorariosPropostos interacao={i} />}
          <p className={styles.situacao}>Situação: {situacoesInteracao[i.situacao] ?? i.situacao}</p>
        </li>
      })}</ol>
    </details>}
    {pendente && solicitacao.id != null && <form className="booking-purpose-form" onSubmit={enviar}>
      <h3>{proposta ? 'Responder à proposta de horário' : 'Responder à complementação'}</h3>
      <p>{pendente.mensagem}</p>
      {proposta && <><HorariosPropostos interacao={pendente} />
        <fieldset className={styles.decisao} disabled={controle.bloqueado}>
          <legend>Decisão</legend>
          <div className={styles.opcoes}>
            {([{ valor: 'sim', rotulo: 'Aceitar proposta' }, { valor: 'nao', rotulo: 'Recusar proposta' }] as const).map(opcao =>
              <label key={opcao.valor} className={styles.cartao}>
                <input type="radio" name={'decisao-' + solicitacao.id} value={opcao.valor} required
                  checked={aceita === opcao.valor} onChange={() => controle.alterar('aceita', opcao.valor)} />
                <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="9" />
                  {opcao.valor === 'sim' ? <path d="m8 12 3 3 5-6" /> : <path d="m9 9 6 6m0-6-6 6" />}
                </svg>
                <span>{opcao.rotulo}</span>
              </label>)}
          </div>
        </fieldset>
        <p>Ao aceitar, a API tentará aprovar a solicitação com os horários propostos. A confirmação depende das validações do backend. Recusar a proposta devolve a solicitação para análise.</p>
      </>}
      <label htmlFor={'resposta-' + solicitacao.id}>Sua resposta</label>
      <textarea disabled={controle.bloqueado} id={'resposta-' + solicitacao.id} required minLength={3} maxLength={2000} value={texto} onChange={e => controle.alterar('texto', e.target.value)} />
      <FeedbackEscrita key={controle.chave} controle={controle} consultar={signal => consultarEstadoSolicitacao(solicitacao.id!, signal)} />
      <button className="button button--primary" disabled={controle.bloqueado || proposta && aceita !== 'sim' && aceita !== 'nao'}>{controle.enviando ? 'Enviando resposta...' : 'Enviar resposta'}</button>
    </form>}
  </>
}
