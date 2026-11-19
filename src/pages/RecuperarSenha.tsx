import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { LayoutAutenticacao } from '../components/LayoutAutenticacao'
import { redefinirSenha, solicitarRecuperacaoSenha } from '../services/recuperacaoSenha'

/** O mesmo caminho recebe pedidos por e-mail e links ?token= gerados pela API. */
export function RecuperarSenha() {
  const [parametros] = useSearchParams()
  const token = parametros.get('token')
  return <FormularioRecuperacao key={parametros.toString()} token={token} />
}

function FormularioRecuperacao({ token }: { token: string | null }) {
  const navigate = useNavigate()
  const ativo = useRef(false)
  useEffect(() => {
    ativo.current = true
    return () => { ativo.current = false }
  }, [])
  const redefinindo = token !== null
  const linkInvalido = redefinindo && (token.length < 43 || token.length > 128)
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [confirmacao, setConfirmacao] = useState('')
  const [mensagem, setMensagem] = useState('')
  const [erro, setErro] = useState('')
  const [enviando, setEnviando] = useState(false)

  async function enviarSolicitacao(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    if (!email.trim()) return
    setErro('')
    setMensagem('')
    setEnviando(true)
    try {
      await solicitarRecuperacaoSenha(email)
      setMensagem('Se o e-mail estiver cadastrado e ativo, você receberá instruções para redefinir a senha.')
    } catch (falha) {
      setErro(falha instanceof Error ? falha.message : 'Não foi possível solicitar a recuperação.')
    } finally {
      setEnviando(false)
    }
  }

  async function enviarNovaSenha(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    setErro('')
    if (!token || linkInvalido) return
    if (senha.length < 8) {
      setErro('A nova senha precisa ter pelo menos 8 caracteres.')
      return
    }
    if (senha !== confirmacao) {
      setErro('As senhas não coincidem.')
      return
    }
    setEnviando(true)
    try {
      await redefinirSenha(token, senha)
      if (!ativo.current) return
      navigate('/login', {
        replace: true,
        state: { aviso: 'Senha redefinida com sucesso. Entre com a nova senha.' },
      })
    } catch (falha) {
      setErro(falha instanceof Error ? falha.message : 'Não foi possível redefinir a senha.')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <LayoutAutenticacao>
      <div className="login-card__header">
        <h2>{redefinindo ? 'Definir nova senha' : 'Recuperar senha'}</h2>
        <p>{redefinindo ? 'Crie uma nova senha para sua conta.' : 'Receba um link de recuperação no seu e-mail.'}</p>
      </div>
      {linkInvalido ? (
        <>
          <p className="login-error" role="alert">Link de redefinição inválido. Solicite um novo e-mail.</p>
          <Link className="login-link" replace to="/recuperar-senha">Solicitar outro link</Link>
        </>
      ) : redefinindo ? (
        <form className="login-form" onSubmit={enviarNovaSenha}>
          <label className="login-field">
            <span>Nova senha (mínimo 8 caracteres)</span>
            <input type="password" autoComplete="new-password" required minLength={8} value={senha}
              onChange={evento => setSenha(evento.target.value)} disabled={enviando} />
          </label>
          <label className="login-field">
            <span>Confirmar nova senha</span>
            <input type="password" autoComplete="new-password" required minLength={8} value={confirmacao}
              aria-describedby={erro ? 'erro-redefinicao' : undefined}
              onChange={evento => setConfirmacao(evento.target.value)} disabled={enviando} />
          </label>
          {erro && <p id="erro-redefinicao" className="login-error" role="alert">{erro}</p>}
          <button className="login-submit" type="submit" disabled={enviando}>
            {enviando ? 'Redefinindo...' : 'Salvar nova senha'}
          </button>
          <Link className="login-link" replace to="/recuperar-senha">Solicitar outro link</Link>
        </form>
      ) : (
        <form className="login-form" onSubmit={enviarSolicitacao}>
          <label className="login-field">
            <span>E-mail cadastrado</span>
            <input type="email" autoComplete="email" required maxLength={254}
              placeholder="seuemail@ifal.edu.br" value={email}
              onChange={evento => setEmail(evento.target.value)} disabled={enviando} />
          </label>
          {erro && <p className="login-error" role="alert">{erro}</p>}
          {mensagem && <p className="login-info" role="status">{mensagem}</p>}
          <button className="login-submit" type="submit" disabled={enviando}>
            {enviando ? 'Enviando...' : 'Enviar link de recuperação'}
          </button>
        </form>
      )}
      <Link className="login-submit login-submit--link" replace={redefinindo} to="/login">Voltar ao login</Link>
    </LayoutAutenticacao>
  )
}
