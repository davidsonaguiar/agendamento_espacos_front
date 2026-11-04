import type { RespostaLogin, UsuarioAutenticado } from '../types/autenticacao'

const API_URL = (import.meta.env.VITE_API_URL ?? 'http://localhost:8000').replace(/\/$/, '')
const TOKEN_KEY = 'labagenda.access_token'
const USUARIO_KEY = 'labagenda.usuario'

function extrairMensagemErro(corpo: unknown, status: number) {
  if (corpo && typeof corpo === 'object' && 'detail' in corpo) {
    const detalhe = (corpo as { detail?: unknown }).detail

    if (typeof detalhe === 'string') return detalhe

    if (Array.isArray(detalhe)) {
      const mensagens = detalhe
        .map((item) => {
          if (!item || typeof item !== 'object' || !('msg' in item)) return null
          const mensagem = (item as { msg?: unknown }).msg
          return typeof mensagem === 'string' ? mensagem : null
        })
        .filter((mensagem): mensagem is string => Boolean(mensagem))

      if (mensagens.length) return mensagens.join(' ')
    }
  }

  if (status === 401) return 'E-mail ou senha inválidos.'
  if (status === 403) return 'Seu usuário está inativo. Procure a coordenação do COLAB.'

  return 'Não foi possível entrar. Tente novamente.'
}

export async function autenticarUsuario(identificacao: string, senha: string): Promise<RespostaLogin> {
  let resposta: Response

  try {
    resposta = await fetch(`${API_URL}/usuarios/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identificacao, senha }),
    })
  } catch {
    throw new Error('Não foi possível conectar ao servidor. Verifique se o backend está em execução.')
  }

  let corpo: unknown = null

  try {
    corpo = await resposta.json()
  } catch {
    corpo = null
  }

  if (!resposta.ok) {
    throw new Error(extrairMensagemErro(corpo, resposta.status))
  }

  const dados = corpo as RespostaLogin
  sessionStorage.setItem(TOKEN_KEY, dados.access_token)
  sessionStorage.setItem(USUARIO_KEY, JSON.stringify(dados.usuario))

  return dados
}

export function obterTokenAcesso() {
  return sessionStorage.getItem(TOKEN_KEY)
}

export function obterUsuarioAutenticado(): UsuarioAutenticado | null {
  const usuarioSalvo = sessionStorage.getItem(USUARIO_KEY)
  if (!usuarioSalvo) return null

  try {
    return JSON.parse(usuarioSalvo) as UsuarioAutenticado
  } catch {
    return null
  }
}

export function encerrarSessao() {
  sessionStorage.removeItem(TOKEN_KEY)
  sessionStorage.removeItem(USUARIO_KEY)
}
