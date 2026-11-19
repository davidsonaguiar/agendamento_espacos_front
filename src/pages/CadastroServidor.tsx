import { useState, type ChangeEvent, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { LayoutAutenticacao } from '../components/LayoutAutenticacao'
import { cadastrarMembro } from '../services/autenticacao'

// Nome mantido por compatibilidade com as rotas existentes do frontend.
export function CadastroServidor() {
  const navigate = useNavigate()
  const [nome, setNome] = useState('')
  const [cpf, setCpf] = useState('')
  const [vinculo, setVinculo] = useState('')
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [confirmacao, setConfirmacao] = useState('')
  const [erro, setErro] = useState('')
  const [carregando, setCarregando] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const cpfLimpo = cpf.replace(/\D/g, '')
    if (nome.trim().length < 3 || cpfLimpo.length !== 11 || vinculo.trim().length < 3 || senha.length < 8) {
      setErro('Confira nome, CPF (11 dígitos), vínculo institucional e senha (mínimo 8 caracteres).')
      return
    }
    if (senha !== confirmacao) {
      setErro('As senhas não coincidem.')
      return
    }

    setCarregando(true)
    setErro('')
    try {
      await cadastrarMembro({
        nome_completo: nome.trim(), cpf: cpfLimpo,
        vinculo_institucional: vinculo.trim(), email: email.trim(), senha,
      })
      navigate('/login', { replace: true, state: { aviso: 'Cadastro concluído. Entre com suas credenciais.' } })
    } catch (falha) {
      setErro(falha instanceof Error ? falha.message : 'Não foi possível cadastrar. Tente novamente.')
    } finally {
      setCarregando(false)
    }
  }

  return (
    <LayoutAutenticacao cadastro>
      <div className="login-card__header">
        <h2>Criar conta</h2>
        <p>Cadastro de membros da comunidade institucional.</p>
      </div>
      <p className="login-info">O cadastro público gera o perfil Membro. Permissões de coordenação e monitoria são atribuídas por espaço pelos responsáveis.</p>
      <form className="login-form" onSubmit={handleSubmit}>
        <label className="login-field"><span>Nome completo</span>
          <input required minLength={3} maxLength={150} autoComplete="name" value={nome} onChange={(e: ChangeEvent<HTMLInputElement>) => setNome(e.target.value)} disabled={carregando} placeholder="Seu nome completo" /></label>
        <label className="login-field"><span>CPF</span>
          <input required maxLength={14} inputMode="numeric" value={cpf} onChange={(e: ChangeEvent<HTMLInputElement>) => setCpf(e.target.value)} disabled={carregando} placeholder="000.000.000-00" /></label>
        <label className="login-field"><span>Vínculo institucional (matrícula ou registro)</span>
          <input required minLength={3} maxLength={50} value={vinculo} onChange={(e: ChangeEvent<HTMLInputElement>) => setVinculo(e.target.value)} disabled={carregando} placeholder="Sua matrícula ou vínculo" /></label>
        <label className="login-field"><span>E-mail</span>
          <input required type="email" autoComplete="email" value={email} onChange={(e: ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)} disabled={carregando} placeholder="seuemail@ifal.edu.br" /></label>
        <label className="login-field"><span>Senha (mínimo 8 caracteres)</span>
          <input required minLength={8} type="password" autoComplete="new-password" value={senha} onChange={(e: ChangeEvent<HTMLInputElement>) => setSenha(e.target.value)} disabled={carregando} /></label>
        <label className="login-field"><span>Confirmar senha</span>
          <input required type="password" autoComplete="new-password" value={confirmacao} onChange={(e: ChangeEvent<HTMLInputElement>) => setConfirmacao(e.target.value)} disabled={carregando} /></label>
        {erro && <p className="login-error" role="alert">{erro}</p>}
        <button className="login-submit" type="submit" disabled={carregando}>{carregando ? 'Cadastrando...' : 'Criar conta'}</button>
        <p className="login-signup">Já tem conta? <Link to="/login">Entrar</Link></p>
      </form>
    </LayoutAutenticacao>
  )
}
