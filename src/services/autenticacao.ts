import type { RespostaLogin, UsuarioAutenticado, DadosCadastroMembro } from '../types/autenticacao'

import { requisitar as requisitarHttp, ErroHttp } from './http'
import type { OpcoesHttp } from './http'

const TOKEN_KEY = 'labagenda.access_token'
const USUARIO_KEY = 'labagenda.usuario'
const LOGOUT_KEY = 'labagenda.logout_pendente'
let versaoSessao = 0
let verificacaoEmAndamento: Promise<UsuarioAutenticado | null> | null = null
let logoutEmAndamento: Promise<void> | null = null

// Cookies são compartilhados entre abas. O lock evita rotacionar o mesmo refresh
// simultaneamente em navegadores com Web Locks (HTTPS/localhost).
let filaCookie: Promise<unknown> = Promise.resolve()
function comLockCookie<T>(acao: () => Promise<T>): Promise<T> {
  const executar = () => typeof navigator !== 'undefined' && navigator.locks
    ? navigator.locks.request('labagenda.cookie-sessao', acao)
    : acao()
  const tarefa = filaCookie.then(executar, executar)
  filaCookie = tarefa.catch(() => undefined)
  return tarefa
}

const ANTECEDENCIA_RENOVACAO_MS = 30_000

let renovacaoEmAndamento: Promise<RespostaLogin | null> | null = null

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
    if (typeof detalhe === 'string' && detalhe.trim()) return detalhe
    if (Array.isArray(detalhe)) {
      const mensagens = detalhe.flatMap(item =>
        item && typeof item === 'object' && 'msg' in item && typeof item.msg === 'string'
          ? [item.msg] : [],
      )
      if (mensagens.length) return mensagens.join(' ')
    }
  }
  if (status === 401) return 'Credenciais inválidas ou sessão encerrada.'
  if (status === 403) return 'Acesso negado. Verifique com a coordenação do COLAB.'
  if (status === 409) return 'Já existe um cadastro com algum dos dados informados.'
  return `Não foi possível concluir a operação (HTTP ${status}). Tente novamente.`
}

async function requisitar<T>(caminho: string, opcoes: OpcoesHttp): Promise<T> {
  const signal = AbortSignal.timeout(15_000)
  try {
    const corpo = await requisitarHttp<unknown>(caminho, {
      ...opcoes, credentials: 'include', signal,
    })
    if (caminho === '/usuarios/logout' && corpo === undefined) return undefined as T
    if (!corpo || typeof corpo !== 'object' || Array.isArray(corpo)) {
      throw new ErroAutenticacao('O servidor respondeu com dados inesperados.')
    }
    return corpo as T
  } catch (erro) {
    if (signal.aborted) throw new ErroAutenticacao('O servidor demorou para responder. Tente novamente.')
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

function usuarioValido(dados: unknown): dados is UsuarioAutenticado {
  if (!dados || typeof dados !== 'object' || Array.isArray(dados)) return false
  const usuario = dados as Record<string, unknown>
  return Number.isSafeInteger(usuario.id) && Number(usuario.id) > 0 &&
    typeof usuario.ativo === 'boolean' &&
    ['nome_completo', 'cpf', 'vinculo_institucional', 'email'].every(campo => typeof usuario[campo] === 'string') &&
    (usuario.perfil === 'Membro' || usuario.perfil === 'Administrador')
}

function respostaLoginValida(dados: unknown): dados is RespostaLogin {
  if (!dados || typeof dados !== 'object' || Array.isArray(dados)) return false
  const resposta = dados as Record<string, unknown>
  return typeof resposta.access_token === 'string' && Boolean(resposta.access_token.trim()) &&
    resposta.token_type === 'bearer' && usuarioValido(resposta.usuario)
}

function guardarSessao(dados: RespostaLogin): void {
  sessionStorage.setItem(TOKEN_KEY, dados.access_token)
  sessionStorage.setItem(USUARIO_KEY, JSON.stringify(dados.usuario))
}

export async function autenticarUsuario(identificacao: string, senha: string): Promise<RespostaLogin> {
  // Aguarda mutações anteriores do cookie antes de criar uma nova sessão.
  await logoutEmAndamento?.catch(() => undefined)
  await renovacaoEmAndamento?.catch(() => undefined)
  const versao = ++versaoSessao
  verificacaoEmAndamento = null
  return comLockCookie(async () => {
    const dados = await requisitar<RespostaLogin>('/usuarios/login', {
      method: 'POST',
      body: { identificacao: identificacao.trim(), senha },
    })
    if (!respostaLoginValida(dados) || !dados.usuario.ativo) {
      throw new ErroAutenticacao('O servidor retornou uma sessão inválida.')
    }
    if (versao !== versaoSessao) throw new ErroAutenticacao('A sessão foi encerrada. Entre novamente.')
    sessionStorage.removeItem(LOGOUT_KEY)
    guardarSessao(dados)
    return dados
  })
}

export async function cadastrarMembro(dados: DadosCadastroMembro): Promise<UsuarioAutenticado> {
  const usuario = await requisitar<UsuarioAutenticado>('/usuarios/', {
    method: 'POST',
    body: dados,
  })
  if (!usuarioValido(usuario)) throw new ErroAutenticacao('O servidor respondeu com dados inesperados.')
  return usuario
}

export function obterTokenAcesso(): string | null {
  return sessionStorage.getItem(TOKEN_KEY)
}

export function obterUsuarioAutenticado(): UsuarioAutenticado | null {
  try {
    const salvo = sessionStorage.getItem(USUARIO_KEY)
    const dados: unknown = salvo ? JSON.parse(salvo) : null
    return usuarioValido(dados) ? dados : null
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
  return expiracao !== null && expiracao <= Date.now()
}

/** Limpa somente dados locais; use desconectarUsuario() para invalidar a sessão no servidor. */
export function encerrarSessao(): void {
  versaoSessao++
  sessionStorage.removeItem(TOKEN_KEY)
  sessionStorage.removeItem(USUARIO_KEY)
}

/** Coalescência: dois componentes não devem girar o mesmo cookie de refresh em paralelo. */
export function renovarSessao(): Promise<RespostaLogin | null> {
  if (sessionStorage.getItem(LOGOUT_KEY)) return Promise.resolve(null)
  if (renovacaoEmAndamento) return renovacaoEmAndamento
  const versao = versaoSessao
  const tarefa = comLockCookie(async (): Promise<RespostaLogin | null> => {
    try {
      const dados = await requisitar<RespostaLogin>('/usuarios/refresh', { method: 'POST' })
      if (!respostaLoginValida(dados) || !dados.usuario.ativo) throw new ErroAutenticacao('O servidor retornou uma sessão inválida.')
      if (versao !== versaoSessao || sessionStorage.getItem(LOGOUT_KEY)) return null
      guardarSessao(dados)
      return dados
    } catch (erro) {
      if (versao !== versaoSessao) return null
      if (erro instanceof ErroAutenticacao && (erro.status === 401 || erro.status === 403)) {
        encerrarSessao()
        return null
      }
      // Erro de rede NÃO apaga a sessão: o usuário poderá tentar novamente.
      throw erro
    }
  })
  renovacaoEmAndamento = tarefa
  void tarefa.then(
    () => { if (renovacaoEmAndamento === tarefa) renovacaoEmAndamento = null },
    () => { if (renovacaoEmAndamento === tarefa) renovacaoEmAndamento = null },
  )
  return tarefa
}

async function consultarUsuario(token: string, versao: number): Promise<UsuarioAutenticado | null> {
  const usuario = await requisitar<UsuarioAutenticado>('/usuarios/me', {
    method: 'GET',
    token,
  })
  if (versao !== versaoSessao) return null
  if (!usuarioValido(usuario) || !usuario.ativo) {
    encerrarSessao()
    return null
  }
  sessionStorage.setItem(USUARIO_KEY, JSON.stringify(usuario))
  return usuario
}

export function verificarSessao(): Promise<UsuarioAutenticado | null> {
  if (sessionStorage.getItem(LOGOUT_KEY)) return Promise.resolve(null)
  if (verificacaoEmAndamento) return verificacaoEmAndamento
  const tarefa = conferirSessao(versaoSessao)
  verificacaoEmAndamento = tarefa
  void tarefa.finally(() => {
    if (verificacaoEmAndamento === tarefa) verificacaoEmAndamento = null
  }).catch(() => undefined)
  return tarefa
}

async function conferirSessao(versao: number): Promise<UsuarioAutenticado | null> {
  let token = obterTokenAcesso()
  let renovou = false
  const expiracao = obterExpiracaoToken(token)
  if (!token || (expiracao !== null && expiracao - Date.now() <= ANTECEDENCIA_RENOVACAO_MS)) {
    const novaSessao = await renovarSessao()
    if (!novaSessao) return null
    token = novaSessao.access_token
    renovou = true
  }

  try {
    return await consultarUsuario(token, versao)
  } catch (erro) {
    if (versao !== versaoSessao) return null
    // Um access token revogado/expirado pode ser recuperado pelo cookie de refresh.
    if (erro instanceof ErroAutenticacao && erro.status === 401 && !renovou) {
      const novaSessao = await renovarSessao()
      if (!novaSessao) return null
      try {
        return await consultarUsuario(novaSessao.access_token, versao)
      } catch (erroRenovado) {
        if (versao !== versaoSessao) return null
        if (erroRenovado instanceof ErroAutenticacao && [401, 403].includes(erroRenovado.status ?? -1)) {
          encerrarSessao()
          return null
        }
        throw erroRenovado
      }
    }
    if (erro instanceof ErroAutenticacao && [401, 403].includes(erro.status ?? -1)) {
      encerrarSessao()
      return null
    }
    throw erro
  }
}

/** Faz logout no backend (revogação da sessão) e limpa os dados locais mesmo se a rede falhar. */
export function desconectarUsuario(): Promise<void> {
  if (logoutEmAndamento) return logoutEmAndamento
  // Bloqueia restauração automática mesmo após recarregar, se a rede falhar.
  sessionStorage.setItem(LOGOUT_KEY, '1')
  encerrarSessao()
  verificacaoEmAndamento = null
  const renovacaoPendente = renovacaoEmAndamento
  const tarefa = (async () => {
    // Aguarda Set-Cookie do refresh para revogar o cookie mais recente.
    await renovacaoPendente?.catch(() => undefined)
    await comLockCookie(() => requisitar<void>('/usuarios/logout', { method: 'POST' }))
  })()
  logoutEmAndamento = tarefa
  void tarefa.finally(() => {
    if (logoutEmAndamento === tarefa) logoutEmAndamento = null
  }).catch(() => undefined)
  return tarefa
}
