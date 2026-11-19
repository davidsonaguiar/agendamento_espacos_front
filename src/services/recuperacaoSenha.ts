import { ErroHttp, requisitar } from './http'

type Operacao = 'solicitar' | 'redefinir'

/** Mensagens de erro amigáveis que não revelam se uma conta existe. */
function explicarErro(erro: unknown, operacao: Operacao): Error {
  if (!(erro instanceof ErroHttp)) {
    if (erro instanceof Error && erro.name === 'TimeoutError') {
      return new Error('A API demorou para responder. Tente novamente.')
    }
    return new Error('Não foi possível concluir a operação.')
  }
  if (erro.status === 404 || erro.status === 405) {
    return new Error('A recuperação de senha ainda não está disponível nesta versão da API.')
  }
  if (erro.tipo === 'rede') {
    return new Error('Não foi possível conectar à API. Verifique sua conexão e tente novamente.')
  }
  if (erro.status === 400 && operacao === 'redefinir') {
    return new Error('Link de redefinição inválido ou expirado. Solicite um novo e-mail.')
  }
  if (erro.status === 422) {
    return new Error(operacao === 'solicitar' ? 'Informe um e-mail válido.' : 'Confira a nova senha e tente novamente.')
  }
  return new Error('Não foi possível concluir a operação agora. Tente novamente.')
}

/** POST /usuarios/recuperar-senha: 202, sem revelar existência de cadastro. */
export async function solicitarRecuperacaoSenha(email: string): Promise<void> {
  try {
    await requisitar('/usuarios/recuperar-senha', {
      method: 'POST',
      statusEsperado: 202,
      body: { email: email.trim() },
      signal: AbortSignal.timeout(15_000),
      credentials: 'omit',
    })
  } catch (erro) {
    throw explicarErro(erro, 'solicitar')
  }
}

/** POST /usuarios/redefinir-senha: 204 sem JSON. */
export async function redefinirSenha(token: string, novaSenha: string): Promise<void> {
  try {
    await requisitar('/usuarios/redefinir-senha', {
      method: 'POST',
      statusEsperado: 204,
      body: { token, nova_senha: novaSenha },
      signal: AbortSignal.timeout(15_000),
      credentials: 'omit',
    })
  } catch (erro) {
    throw explicarErro(erro, 'redefinir')
  }
}
