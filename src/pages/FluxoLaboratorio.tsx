import { simuladorLocalAtivo } from '../services/sessaoSimulada'
import { CatalogoLaboratorios } from './CatalogoLaboratorios'
import { CatalogoSimulado } from './CatalogoSimulado'
import { DetalhesLaboratorio } from './DetalhesLaboratorio'
import { DetalhesEspacoIntegrado } from './DetalhesEspacoIntegrado'
import { SolicitacaoAgendamento } from './SolicitacaoAgendamento'
import { DetalhesSolicitacao } from './DetalhesSolicitacao'
import { AgendamentoConectado } from './AgendamentoConectado'

export function Catalogo() {
  return simuladorLocalAtivo ? <CatalogoSimulado /> : <CatalogoLaboratorios />
}

export function Detalhe({ id }: { id: string }) {
  return simuladorLocalAtivo ? <DetalhesLaboratorio id={id} /> : <DetalhesEspacoIntegrado id={id} />
}

export function Agendar({ id, detalhes }: { id: string; detalhes: boolean }) {
  if (simuladorLocalAtivo) return detalhes ? <DetalhesSolicitacao id={id} /> : <SolicitacaoAgendamento id={id} />
  return <AgendamentoConectado key={id} id={id} detalhes={detalhes} />
}
