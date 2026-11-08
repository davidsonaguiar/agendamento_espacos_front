import { Navigate, Route, Routes, useParams } from 'react-router-dom'
import { MeusAgendamentos } from './pages/MeusAgendamentos'
import { CatalogoLaboratorios } from './pages/CatalogoLaboratorios'
import { DetalhesEspacoIntegrado, AgendamentoIntegracaoPendente } from './pages/DetalhesEspacoIntegrado'
import { Login } from './pages/Login'
import { CadastroServidor } from './pages/CadastroServidor'
import { RecuperarSenha } from './pages/RecuperarSenha'
import { RotaProtegida } from './components/RotaProtegida'

function RotaDetalhesLaboratorio() {
  const { id } = useParams()
  if (!id || !/^\d+$/.test(id)) return <Navigate to="/" replace />
  return <DetalhesEspacoIntegrado id={id} />
}

function RotaSolicitacaoAgendamento() {
  const { id } = useParams()
  if (!id || !/^\d+$/.test(id)) return <Navigate to="/" replace />
  return <AgendamentoIntegracaoPendente />
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
        <Route path="/laboratorios/:id/agendamento/detalhes" element={<RotaSolicitacaoAgendamento />} />
        <Route path="/meus-agendamentos" element={<MeusAgendamentos />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App
