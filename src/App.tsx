import { Navigate, Route, Routes, useParams } from 'react-router-dom'
import { MeusAgendamentos } from './pages/MeusAgendamentos'
import { Catalogo, Detalhe, Agendar } from './pages/FluxoLaboratorio'
import { Login } from './pages/Login'
import { CadastroServidor } from './pages/CadastroServidor'
import { RecuperarSenha } from './pages/RecuperarSenha'
import { RotaProtegida } from './components/RotaProtegida'
import { RotaPerfil } from './components/RotaPerfil'
import { PainelAdmin } from './pages/PainelAdmin'

function RotaDetalhesLaboratorio() {
  const { id } = useParams()
  if (!id || !/^\d+$/.test(id)) return <Navigate to="/" replace />
  return <Detalhe id={id} />
}

function RotaSolicitacaoAgendamento({ detalhes = false }: { detalhes?: boolean }) {
  const { id } = useParams()
  if (!id || !/^\d+$/.test(id)) return <Navigate to="/" replace />
  return <Agendar id={id} detalhes={detalhes} />
}

function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/cadastro" element={<CadastroServidor />} />
      <Route path="/recuperar-senha" element={<RecuperarSenha />} />
      <Route element={<RotaProtegida />}>
        <Route path="/" element={<Catalogo />} />
        <Route path="/laboratorios/:id" element={<RotaDetalhesLaboratorio />} />
        <Route path="/laboratorios/:id/agendamento" element={<RotaSolicitacaoAgendamento />} />
        <Route path="/laboratorios/:id/agendamento/detalhes" element={<RotaSolicitacaoAgendamento detalhes />} />
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
