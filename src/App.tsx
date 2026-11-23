import './styles/logout.css'
import { Navigate, Route, Routes, useParams } from 'react-router-dom'
import { MeusAgendamentos } from './pages/MeusAgendamentos'
import { CatalogoLaboratorios } from './pages/CatalogoLaboratorios'
import { DetalhesEspacoIntegrado } from './pages/DetalhesEspacoIntegrado'
import { SolicitacaoAgendamento } from './pages/SolicitacaoAgendamento'
import { DetalhesSolicitacao } from './pages/DetalhesSolicitacao'
import { Login } from './pages/Login'
import { CadastroServidor } from './pages/CadastroServidor'
import { RecuperarSenha } from './pages/RecuperarSenha'
import { RotaProtegida } from './components/RotaProtegida'
import { RotaPerfil } from './components/RotaPerfil'
import { PainelAdmin } from './pages/PainelAdmin'

function RotaDetalhesLaboratorio() {
  const { id } = useParams()
  if (!id || !/^\d+$/.test(id)) return <Navigate to="/" replace />
  return <DetalhesEspacoIntegrado id={id} />
}

function RotaSolicitacaoAgendamento() {
  const { id } = useParams()
  if (!id || !/^\d+$/.test(id)) return <Navigate to="/" replace />
  return <SolicitacaoAgendamento key={id} id={id} />
}

function RotaDetalhesSolicitacao() {
  const { id } = useParams()
  if (!id || !/^\d+$/.test(id)) return <Navigate to="/" replace />
  return <DetalhesSolicitacao key={id} id={id} />
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
        <Route path="/laboratorios/:id/agendamento/detalhes" element={<RotaDetalhesSolicitacao />} />
        <Route path="/meus-agendamentos" element={<MeusAgendamentos />} />
        <Route element={<RotaPerfil />}>
          <Route path="/admin" element={<PainelAdmin />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App
