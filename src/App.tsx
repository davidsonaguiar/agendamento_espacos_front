import { Navigate, Route, Routes, useParams } from 'react-router-dom'
import { MeusAgendamentos } from './pages/MeusAgendamentos'
import { CatalogoLaboratorios } from './pages/CatalogoLaboratorios'
import { DetalhesLaboratorio } from './pages/DetalhesLaboratorio'
import { DetalhesSolicitacao } from './pages/DetalhesSolicitacao'
import { SolicitacaoAgendamento } from './pages/SolicitacaoAgendamento'
import { PainelAdmin } from './pages/PainelAdmin'

function RotaDetalhesLaboratorio() {
  const { id } = useParams()

  if (!id || !/^\d+$/.test(id)) return <Navigate to="/" replace />

  return <DetalhesLaboratorio id={id} />
}

function RotaSolicitacaoAgendamento({ detalhes = false }: { detalhes?: boolean }) {
  const { id } = useParams()

  if (!id || !/^\d+$/.test(id)) return <Navigate to="/" replace />

  return detalhes ? <DetalhesSolicitacao id={id} /> : <SolicitacaoAgendamento id={id} />
}

function App() {
  return (
    <Routes>
      <Route path="/" element={<CatalogoLaboratorios />} />
      <Route path="/laboratorios/:id" element={<RotaDetalhesLaboratorio />} />
      <Route path="/laboratorios/:id/agendamento" element={<RotaSolicitacaoAgendamento />} />
      <Route path="/laboratorios/:id/agendamento/detalhes" element={<RotaSolicitacaoAgendamento detalhes />} />
      <Route path="/meus-agendamentos" element={<MeusAgendamentos />} />
      <Route path="/admin" element={<PainelAdmin />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App
