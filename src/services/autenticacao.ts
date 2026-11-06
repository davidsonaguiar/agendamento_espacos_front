import type { RespostaLogin, UsuarioAutenticado, DadosCadastroServidor } from '../types/autenticacao'

import { requisitar as requisitarHttp, ErroHttp } from './http'
import type { OpcoesHttp } from './http'

const TOKEN_KEY = 'labagenda.access_token'
const USUARIO_KEY = 'labagenda.usuario'

export class ErroAutenticacao extends Error {
  readonly status?: number

  constructor(mensagem: string, status?: number) {
    super(mensagem)
    this.name = 'ErroAutenticacao'
    this.status = status
  }
}

function mensagemErro(corpo: unknown, status: number): string {
  if (corpo && typeof corpo === 'object' && 'detail' in corpo) {
    const detalhe = (corpo as { detail?: unknown }).detail
    if (typeof detalhe === 'string') return detalhe
    if (Array.isArray(detalhe)) {
      const mensagens = detalhe.map((item) =>
        item && typeof item === 'object' && 'msg' in item && typeof item.msg === 'string'
          ? item.msg
          : null,
      ).filter((mensagem): mensagem is string => Boolean(mensagem))
      if (mensagens.length) return mensagens.join(' ')
    }
  }
  if (status === 401) return 'E-mail ou senha inválidos.'
  if (status === 403) return 'Acesso negado. Verifique com a coordenação do COLAB.'
  if (status === 409) return 'Já existe um cadastro com algum dos dados informados.'
  return 'Não foi possível concluir a operação. Tente novamente.'
}

async function requisitar<T>(caminho: string, opcoes: OpcoesHttp): Promise<T> {
  try {
    const corpo = await requisitarHttp<unknown>(caminho, opcoes)
    if (!corpo || typeof corpo !== 'object' || Array.isArray(corpo)) {
      throw new ErroAutenticacao('O servidor respondeu com dados inesperados.')
    }
    return corpo as T
  } catch (erro) {
    if (!(erro instanceof ErroHttp)) throw erro
    if (erro.tipo === 'http') {
      throw new ErroAutenticacao(mensagemErro(erro.corpo, erro.status!), erro.status)
    }
    if (erro.tipo === 'rede') {
      throw new ErroAutenticacao('Não foi possível conectar ao servidor. Verifique se o backend está em execução.', erro.status)
    }
    if (erro.tipo === 'resposta') {
      throw new ErroAutenticacao('O servidor respondeu com dados inesperados.', erro.status)
    }
    throw new ErroAutenticacao(erro.message, erro.status)
  }
}

function usuarioValido(valor: unknown): valor is UsuarioAutenticado {
  if (!valor || typeof valor !== 'object' || Array.isArray(valor)) return false
  const usuario = valor as Record<string, unknown>
  return typeof usuario.id === 'number' && Number.isSafeInteger(usuario.id) && usuario.id > 0 &&
    typeof usuario.ativo === 'boolean' &&
    ['nome_completo', 'cpf', 'vinculo_institucional', 'email'].every(
      campo => typeof usuario[campo] === 'string',
    ) &&
    ['Administrador', 'Coordenador', 'Servidor', 'Monitor', 'Aluno'].includes(String(usuario.perfil))
}

export async function autenticarUsuario(identificacao: string, senha: string): Promise<RespostaLogin> {
  const dados = await requisitar<RespostaLogin>('/usuarios/login', {
    method: 'POST',
    body: { identificacao, senha },
  })

  if (typeof dados.access_token !== 'string' || !dados.access_token.trim() ||
      dados.token_type !== 'bearer' || !usuarioValido(dados.usuario)) {
    throw new ErroAutenticacao('O servidor retornou uma sessão inválida.')
  }

  sessionStorage.setItem(TOKEN_KEY, dados.access_token)
  sessionStorage.setItem(USUARIO_KEY, JSON.stringify(dados.usuario))
  return dados
}

export async function cadastrarServidor(dados: DadosCadastroServidor): Promise<UsuarioAutenticado> {
  const usuario = await requisitar<UsuarioAutenticado>('/usuarios/servidor', {
    method: 'POST',
    body: dados,
  })
  if (!usuarioValido(usuario)) {
    throw new ErroAutenticacao('O servidor respondeu com dados inesperados.')
  }
  return usuario
}

export function obterTokenAcesso(): string | null {
  return sessionStorage.getItem(TOKEN_KEY)
}

export function obterUsuarioAutenticado(): UsuarioAutenticado | null {
  try {
    const salvo = sessionStorage.getItem(USUARIO_KEY)
    return salvo ? JSON.parse(salvo) as UsuarioAutenticado : null
  } catch {
    return null
  }
}

export function obterExpiracaoToken(token: string | null = obterTokenAcesso()): number | null {
  if (!token) return null
  try {
    const parte = token.split('.')[1]
    if (!parte) return null
    const base64 = parte.replace(/-/g, '+').replace(/_/g, '/')
    const conteudo = JSON.parse(atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, '='))) as { exp?: unknown }
    return typeof conteudo.exp === 'number' && Number.isFinite(conteudo.exp) ? conteudo.exp * 1000 : null
  } catch {
    return null
  }
}

export function tokenExpirou(token: string | null = obterTokenAcesso()): boolean {
  if (!token) return true
  const expiracao = obterExpiracaoToken(token)
  // A ausência da claim exp não autentica ninguém: /usuarios/me sempre valida no servidor.
  return expiracao !== null && expiracao <= Date.now()
}

export function encerrarSessao(): void {
  sessionStorage.removeItem(TOKEN_KEY)
  sessionStorage.removeItem(USUARIO_KEY)
}

export async function verificarSessao(): Promise<UsuarioAutenticado | null> {
  const token = obterTokenAcesso()
  if (!token || tokenExpirou(token)) {
    encerrarSessao()
    return null
  }

  try {
    const usuario = await requisitar<UsuarioAutenticado>('/usuarios/me', {
      method: 'GET',
      token,
    })
    if (!usuarioValido(usuario) || !usuario.ativo) {
      encerrarSessao()
      return null
    }
    sessionStorage.setItem(USUARIO_KEY, JSON.stringify(usuario))
    return usuario
  } catch (erro) {
    if (erro instanceof ErroAutenticacao && (erro.status === 401 || erro.status === 403)) {
      encerrarSessao()
      return null
    }
    throw erro
  }
}
