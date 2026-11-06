import { Link } from 'react-router-dom'
import { LayoutAutenticacao } from '../components/LayoutAutenticacao'

export function RecuperarSenha() {
  return (
    <LayoutAutenticacao>
      <div className="login-card__header">
        <h2>Recuperar senha</h2>
        <p>Orientações para recuperar seu acesso.</p>
      </div>
      <p className="login-info" role="status">
        A recuperação automática de senha ainda não está disponível na API do COLAB.
        Para recuperar o acesso, procure a coordenação do laboratório.
        Por segurança, não compartilhe sua senha.
      </p>
      <Link className="login-submit login-submit--link" to="/login">Voltar ao login</Link>
    </LayoutAutenticacao>
  )
}
