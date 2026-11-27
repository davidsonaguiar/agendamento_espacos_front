import type { ReactNode } from 'react'
import type { SolicitacaoConsulta, StatusOficialSolicitacao } from '../types/solicitacaoConsulta'
import { lerData } from '../data/disponibilidade'
import { classificarStatusSolicitacao } from '../data/solicitacoesRecebidas'
import { formatarDuracaoSolicitacao, formatarHoraSolicitacao, ordenarHorarios } from '../data/apresentacaoSolicitacoes'

const rotulosStatus: Record<StatusOficialSolicitacao, string> = {
  Pendente: 'Pendente', AguardandoComplementacao: 'Aguardando complementação', AguardandoRespostaProposta: 'Novo horário proposto',
  Aprovado: 'Aprovado', Rejeitado: 'Rejeitado', Cancelada: 'Cancelada',
}
export function CartaoSolicitacao({ solicitacao, children }: { solicitacao: SolicitacaoConsulta; children?: ReactNode }) {
  const status = classificarStatusSolicitacao(solicitacao.status)
  const justificativa = ['Aprovado', 'Rejeitado'].includes(solicitacao.status) ? solicitacao.decisao_justificativa?.trim() : ''
  return <article className="agenda-card">
    <header className="agenda-card__header">
      <div>
        <p className="agenda-card__id">Solicitação {solicitacao.id == null ? 'sem identificador' : `#${solicitacao.id}`}</p>
        <h2>{solicitacao.espaco?.nome.trim() || `Espaço ID ${solicitacao.id_espaco}`}</h2>
      </div>
      <span className={`agenda-status agenda-status--${status.tipo === 'conhecido' ? status.valor : 'desconhecido'}`}>
        <span className="visually-hidden">Status da solicitação: </span>{status.tipo === 'conhecido' ? rotulosStatus[status.valor] : `Status desconhecido: ${status.valor}`}
      </span>
    </header>
    <dl className="agenda-card__purpose"><div><dt>Finalidade</dt><dd>{solicitacao.finalidade}</dd></div>
      {justificativa && <div><dt>Justificativa da decisão</dt><dd>{justificativa}</dd></div>}
    </dl>
    <h3>Horários solicitados</h3>
    {solicitacao.horarios.length ? <ul className="agenda-card__times">
      {ordenarHorarios(solicitacao.horarios).map((horario, indice) => {
        const data = lerData(horario.data_reserva)
        const duracao = formatarDuracaoSolicitacao(horario.hora_inicio, horario.hora_fim)
        return <li key={horario.id ?? `${horario.data_reserva}-${horario.hora_inicio}-${indice}`}>
          <span className="agenda-card__date">{data ? <time dateTime={horario.data_reserva}>{new Intl.DateTimeFormat('pt-BR').format(data)}</time> : 'Data indisponível'}</span>
          <span>{formatarHoraSolicitacao(horario.hora_inicio)} – {formatarHoraSolicitacao(horario.hora_fim)}</span>
          {duracao && <span className="agenda-card__duration">Duração: {duracao}</span>}
        </li>
      })}
    </ul> : <p>Horários não informados.</p>}
    {children}
  </article>
}
