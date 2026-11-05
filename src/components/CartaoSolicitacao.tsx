import type { SolicitacaoResposta, StatusSolicitacao } from '../types/solicitacao'
import { parseData } from '../data/selecaoAgendamento'

const rotulosStatus: Record<StatusSolicitacao, string> = {
  Pendente: 'Pendente',
  AguardandoComplementacao: 'Aguardando complementação',
  AguardandoRespostaProposta: 'Aguardando resposta à proposta',
  Aprovado: 'Aprovado',
  Rejeitado: 'Rejeitado',
  Cancelada: 'Cancelada',
}

function segundosLocais(valor: string): number | null {
  const partes = /^([01]\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?$/.exec(valor)
  return partes ? Number(partes[1]) * 3600 + Number(partes[2]) * 60 + Number(partes[3] || 0) : null
}

function formatarHora(valor: string): string {
  const segundos = segundosLocais(valor)
  if (segundos === null) return valor
  return segundos % 60 === 0 ? valor.slice(0, 5) : valor
}

function formatarDuracao(inicio: string, fim: string): string | null {
  const a = segundosLocais(inicio)
  const b = segundosLocais(fim)
  if (a === null || b === null || b <= a) return null
  const total = b - a
  return [
    Math.floor(total / 3600) ? `${Math.floor(total / 3600)} h` : '',
    Math.floor(total % 3600 / 60) ? `${Math.floor(total % 3600 / 60)} min` : '',
    total % 60 ? `${total % 60} s` : '',
  ].filter(Boolean).join(' ')
}

export function CartaoSolicitacao({ solicitacao }: { solicitacao: SolicitacaoResposta }) {
  return <article className="agenda-card">
    <header className="agenda-card__header">
      <div>
        <p className="agenda-card__id">Solicitação {solicitacao.id === null ? 'sem identificador' : `#${solicitacao.id}`}</p>
        <h2>{solicitacao.espaco?.nome || `Espaço ID ${solicitacao.id_espaco}`}</h2>
      </div>
      <span className={`agenda-status agenda-status--${solicitacao.status}`}>
        <span className="visually-hidden">Status da solicitação: </span>{rotulosStatus[solicitacao.status]}
      </span>
    </header>
    <dl className="agenda-card__purpose">
      <div><dt>Finalidade</dt><dd>{solicitacao.finalidade}</dd></div>
    </dl>
    <h3>Horários solicitados</h3>
    <ul className="agenda-card__times">
      {solicitacao.horarios.map((horario, indice) => {
        const data = parseData(horario.data_reserva)
        const duracao = data ? formatarDuracao(horario.hora_inicio, horario.hora_fim) : null
        return <li key={horario.id ?? `${horario.data_reserva}-${horario.hora_inicio}-${indice}`}>
          <span className="agenda-card__date">{data ? <time dateTime={horario.data_reserva}>{new Intl.DateTimeFormat('pt-BR').format(data)}</time> : 'Data indisponível'}</span>
          <span>{formatarHora(horario.hora_inicio)} – {formatarHora(horario.hora_fim)}</span>
          {duracao && <span className="agenda-card__duration">Duração: {duracao}</span>}
        </li>
      })}
    </ul>
  </article>
}
