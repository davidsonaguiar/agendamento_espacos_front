import { Link, Outlet } from 'react-router-dom'
import { useAcessoGestor } from '../gestao/contextoGestor'

export function RotaPerfil() {
  const acesso = useAcessoGestor()
  // A autenticacao e o redirecionamento para login pertencem a RotaProtegida.
  // A ausencia do contexto nunca confirma permissao de gestao.
  if (!acesso) {
    return <main className="access-feedback" role="status">
      Aguardando confirmação da sessão...
    </main>
  }
  if (acesso.erro !== undefined) {
    return <main className="access-feedback" role="alert">
      <h1>Não foi possível verificar sua permissão</h1>
      <p>Verifique sua conexão e tente novamente.</p>
      <button type="button" onClick={acesso.atualizar}>Tentar novamente</button>
      <Link to="/">Voltar ao catálogo</Link>
    </main>
  }
  if (!Array.isArray(acesso.espacos)) {
    return <main className="access-feedback" role="status">
      Verificando permissão de acesso ao painel...
    </main>
  }
  // No modo conectado, o contexto contem apenas os espacos autorizados pela API.
  // No simulador, o provedor resolve uma lista local separada, sem fallback de rede.
  if (!acesso.administrador && acesso.espacos.length === 0) {
    return (
      <main className="access-feedback" role="alert">
        <h1>Acesso restrito</h1>
        <p>Seu perfil não tem permissão para acessar esta área.</p>
        <Link to="/">Voltar ao catálogo</Link>
      </main>
    )
  }

  return <Outlet />
}
