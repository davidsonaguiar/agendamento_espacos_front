import { Navigate, Route, Routes, useParams } from 'react-router-dom'
import { CatalogoLaboratorios } from './pages/CatalogoLaboratorios'
import { DetalhesLaboratorio } from './pages/DetalhesLaboratorio'
import { DetalhesSolicitacao } from './pages/DetalhesSolicitacao'
import { SolicitacaoAgendamento } from './pages/SolicitacaoAgendamento'
import { Login } from './pages/Login'
import { CadastroServidor } from './pages/CadastroServidor'
import { RecuperarSenha } from './pages/RecuperarSenha'
import { RotaProtegida } from './components/RotaProtegida'

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
      <Route path="/login" element={<Login />} />
      <Route path="/cadastro" element={<CadastroServidor />} />
      <Route path="/recuperar-senha" element={<RecuperarSenha />} />
      <Route element={<RotaProtegida />}>
        <Route path="/" element={<CatalogoLaboratorios />} />
        <Route path="/laboratorios/:id" element={<RotaDetalhesLaboratorio />} />
        <Route path="/laboratorios/:id/agendamento" element={<RotaSolicitacaoAgendamento />} />
        <Route path="/laboratorios/:id/agendamento/detalhes" element={<RotaSolicitacaoAgendamento detalhes />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App
