export type TipoErroHttp = 'configuracao' | 'http' | 'rede' | 'resposta'

export class ErroHttp extends Error {
  readonly tipo: TipoErroHttp
  readonly status?: number
  readonly corpo?: unknown

  constructor(tipo: TipoErroHttp, mensagem: string, status?: number, corpo?: unknown) {
    super(mensagem)
    this.name = 'ErroHttp'
    this.tipo = tipo
    this.status = status
    this.corpo = corpo
  }
}

export interface OpcoesHttp {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS'
  body?: unknown
  headers?: HeadersInit
  signal?: AbortSignal
  token?: string
}

function mensagemErro(corpo: unknown, status: number): string {
  if (typeof corpo === 'string' && corpo.trim()) return corpo
  if (corpo && typeof corpo === 'object') {
    const dados = corpo as Record<string, unknown>
    if (typeof dados.detail === 'string' && dados.detail.trim()) return dados.detail
    if (Array.isArray(dados.detail)) {
      const mensagens = dados.detail.flatMap((item: unknown) =>
        item && typeof item === 'object' && 'msg' in item && typeof item.msg === 'string'
          ? [item.msg] : [],
      )
      if (mensagens.length) return mensagens.join(' ')
    }
    if (typeof dados.message === 'string' && dados.message.trim()) return dados.message
    if (typeof dados.mensagem === 'string' && dados.mensagem.trim()) return dados.mensagem
  }
  return `A requisição falhou (HTTP ${status}).`
}

/** Retorna undefined para respostas vazias. O tipo T não valida o contrato em runtime. */
export async function requisitar<T = unknown>(
  caminho: string,
  opcoes: OpcoesHttp = {},
): Promise<T | undefined> {
  const base = import.meta.env.VITE_API_URL?.trim()
  if (!base) {
    throw new ErroHttp('configuracao', 'Configure VITE_API_URL antes de acessar a API.')
  }

  let url: URL
  try {
    const baseUrl = new URL(base)
    if (!['http:', 'https:'].includes(baseUrl.protocol) || baseUrl.username ||
        baseUrl.password || baseUrl.search || baseUrl.hash) throw new Error()
    // Caminhos pertencem à API configurada; não aceitamos URLs externas.
    if (/^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(caminho) || caminho.includes('\\')) throw new Error()
    url = new URL(`${base.replace(/\/+$/, '')}/${caminho.replace(/^\/+/, '')}`)
  } catch {
    throw new ErroHttp('configuracao', 'VITE_API_URL deve ser uma URL HTTP(S) absoluta e o caminho deve ser relativo à API.')
  }

  const { method = 'GET', body, headers, signal, token } = opcoes
  const cabecalhos = new Headers(headers)
  if (!cabecalhos.has('Accept')) cabecalhos.set('Accept', 'application/json')
  if (body !== undefined) cabecalhos.set('Content-Type', 'application/json')
  if (token) cabecalhos.set('Authorization', `Bearer ${token}`)
  const dados = body === undefined ? undefined : JSON.stringify(body)

  let resposta: Response | undefined = undefined
  let texto: string
  try {
    signal?.throwIfAborted()
    resposta = await fetch(url.href, { method, headers: cabecalhos, body: dados, signal })
    texto = resposta.status === 204 || method === 'HEAD' ? '' : await resposta.text()
  } catch (erro) {
    // Mantém o cancelamento distinguível de falhas de conectividade.
    if (signal?.aborted || (erro instanceof Error && erro.name === 'AbortError')) throw erro
    throw new ErroHttp('rede', 'Não foi possível ler a resposta da API. Verifique a conexão.', resposta?.status)
  }

  let corpo: unknown = undefined
  let jsonValido = true
  if (texto.trim()) {
    try { corpo = JSON.parse(texto) } catch { corpo = texto; jsonValido = false }
  }
  if (!resposta.ok) {
    throw new ErroHttp('http', mensagemErro(corpo, resposta.status), resposta.status, corpo)
  }
  if (!jsonValido) {
    throw new ErroHttp('resposta', 'A API retornou uma resposta que não é JSON válido.', resposta.status, corpo)
  }
  return corpo as T | undefined
}
