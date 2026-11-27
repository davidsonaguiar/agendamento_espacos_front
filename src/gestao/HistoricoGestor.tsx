import type { InteracaoSolicitacaoResposta } from '../types/solicitacao'
import styles from '../components/RespostaAluno.module.css'

const tipos: Record<InteracaoSolicitacaoResposta['tipo'], string> = {
  ComplementacaoSolicitada: 'Pedido de complementação', ComplementacaoRespondida: 'Resposta à complementação',
  ReplanejamentoProposto: 'Proposta de horário', PropostaRespondida: 'Resposta à proposta',
}

export function HistoricoGestor({ interacoes, idSolicitante, idUsuario }: {
  interacoes: InteracaoSolicitacaoResposta[]; idSolicitante: number; idUsuario?: number
}) {
  if (!interacoes.length) return null
  return <details className={styles.historico}><summary>Histórico da solicitação</summary>
    <ol className={styles.mensagens}>{interacoes.map(i => {
      const proprio = Number.isSafeInteger(idUsuario) && idUsuario! > 0 && i.id_usuario === idUsuario
      const solicitante = i.id_usuario === idSolicitante
      const gestao = !solicitante && Number.isSafeInteger(i.id_usuario) && i.id_usuario > 0 &&
        (i.tipo === 'ComplementacaoSolicitada' || i.tipo === 'ReplanejamentoProposto')
      const rotulo = proprio ? 'Você' : solicitante ? 'Solicitante' : gestao ? `Gestão · ID ${i.id_usuario}` : `Autor ID ${i.id_usuario}`
      const classe = solicitante ? styles.solicitante : gestao ? styles.gestao : styles.neutro
      const data = new Date(i.data_criacao)
      const dataValida = Number.isFinite(data.getTime())
      return <li key={i.id} className={`${styles.mensagem} ${classe}`}>
        <header className={styles.cabecalhoMensagem}><span className={styles.autor}>{rotulo}</span>
          <span className={styles.data}>{dataValida ? <time dateTime={i.data_criacao}>{new Intl.DateTimeFormat('pt-BR', {
            day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZoneName: 'short',
          }).format(data)}</time> : 'Data indisponível'}</span></header>
        <strong className={styles.tipo}>{tipos[i.tipo] ?? 'Interação'}</strong>
        <p className={styles.texto}>{i.mensagem}</p>
      </li>
    })}</ol>
  </details>
}