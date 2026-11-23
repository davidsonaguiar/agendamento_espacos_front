import { useEffect, useCallback, useSyncExternalStore, useLayoutEffect, useId, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { mensagem } from './consulta'
import { obterUsuarioAutenticado, obterTokenAcesso } from '../services/autenticacao'
import { chaveSessaoConsulta, useSessaoConsulta } from '../hooks/useSessaoConsulta'
import { simuladorLocalAtivo } from '../services/sessaoSimulada'
import { ErroHttp } from '../services/http'
import styles from '../pages/PainelAdmin.module.css'

export function AvisoConsulta({ erro, atualizar }: { erro?: string; atualizar: () => void }) {
  if (!erro) return <p role="status">Carregando…</p>
  return <div role="alert"><p>{erro}</p><button type="button" onClick={atualizar}>Tentar novamente</button></div>
}

// Registro da aba: nao guarda tokens, nao expira por tempo e nao e limpo por GET.
// "pendente" recuperado apos recarga tambem representa resultado desconhecido.
type RegistroEscrita = { estado: 'rascunho' | 'pendente' | 'incerto' | 'concluido' | 'rejeitado'; rascunho: Record<string, string>; aviso?: string }
const eventoEscrita = 'labagenda:registro-escrita'
function assinarEscritas(fn: () => void) {
  window.addEventListener(eventoEscrita, fn)
  window.addEventListener('storage', fn)
  return () => { window.removeEventListener(eventoEscrita, fn); window.removeEventListener('storage', fn) }
}
function lerRegistro(chave: string): RegistroEscrita {
  const texto = sessionStorage.getItem(chave)
  if (!texto) return { estado: 'rascunho', rascunho: {} }
  const v: unknown = JSON.parse(texto)
  if (!v || typeof v !== 'object' || !('estado' in v) || !('rascunho' in v)
    || !['rascunho', 'pendente', 'incerto', 'concluido', 'rejeitado'].includes(String(v.estado))
    || !v.rascunho || typeof v.rascunho !== 'object' || Array.isArray(v.rascunho)
    || !Object.values(v.rascunho).every(x => typeof x === 'string')
    || ('aviso' in v && typeof v.aviso !== 'string')) throw Error('Registro local invalido.')
  return v as RegistroEscrita
}
function gravarRegistro(chave: string, registro: RegistroEscrita) {
  sessionStorage.setItem(chave, JSON.stringify(registro))
  window.dispatchEvent(new Event(eventoEscrita))
}
export function useEscritaSegura(operacao: string, iniciais: Record<string, string> = {}) {
  const sessao = useSessaoConsulta()
  const usuario = obterUsuarioAutenticado()
  const identidade = sessao && usuario?.ativo && obterTokenAcesso() ? usuario.id : null
  const chave = 'labagenda.escrita.v1:' + JSON.stringify([simuladorLocalAtivo ? 'simulado' : 'conectado', identidade, operacao])
  const snapshot = useCallback(() => {
    try { return sessionStorage.getItem(chave) } catch { return '!indisponivel' }
  }, [chave])
  useSyncExternalStore(assinarEscritas, snapshot, () => null)
  useEffect(() => {
    if (identidade === null || !Object.keys(iniciais).length) return
    try {
      if (sessionStorage.getItem(chave) === null) gravarRegistro(chave, { estado: 'rascunho', rascunho: { ...iniciais } })
    } catch { /* A leitura/gravacao no envio falha de forma fechada. */ }
  }, [chave, identidade])
  const [ativa, setAtiva] = useState<string>()
  const [falhaLocal, setFalhaLocal] = useState<{ chave: string; texto: string }>()
  let registro: RegistroEscrita
  let indisponivel = false
  try { registro = lerRegistro(chave) } catch { registro = { estado: 'incerto', rascunho: {} }; indisponivel = true }
  const mesmaSessao = () => identidade !== null && chaveSessaoConsulta() === sessao
  const dados = identidade === null ? { ...iniciais } : { ...iniciais, ...registro.rascunho }
  const bloqueado = simuladorLocalAtivo || identidade === null || indisponivel || ['pendente', 'incerto', 'concluido'].includes(registro.estado)
    || falhaLocal?.chave === chave
  function alterar(campo: string, valor: string) {
    if (!mesmaSessao()) return
    try {
      const atual = lerRegistro(chave)
      if (['pendente', 'incerto', 'concluido'].includes(atual.estado)) return
      gravarRegistro(chave, { ...atual, rascunho: { ...iniciais, ...atual.rascunho, [campo]: valor } })
    } catch { setFalhaLocal({ chave, texto: 'Nao foi possivel preservar os dados. Nenhuma nova escrita sera iniciada.' }) }
  }
  async function executar<T>(tarefa: () => Promise<T>, sucesso: (resultado: T) => void) {
    if (!mesmaSessao() || simuladorLocalAtivo || falhaLocal?.chave === chave) return
    let atual: RegistroEscrita
    try {
      atual = lerRegistro(chave)
      if (['pendente', 'incerto', 'concluido'].includes(atual.estado)) return
      // Trava sincronizada e persistida ANTES de chamar qualquer transporte.
      gravarRegistro(chave, { estado: 'pendente', rascunho: { ...iniciais, ...atual.rascunho } })
    } catch { setFalhaLocal({ chave, texto: 'Nao foi possivel registrar a tentativa com seguranca. Nenhuma escrita foi enviada.' }); return }
    setAtiva(chave)
    const encerrar = () => setAtiva(atual => atual === chave ? undefined : atual)
    let promessa: Promise<T>
    try { promessa = tarefa() } catch (erro) {
      // Os callbacks validam os campos sincronicamente antes de devolver a Promise.
      try { gravarRegistro(chave, { ...atual, estado: 'rejeitado', aviso: mensagem(erro) }) } catch { /* Sem transporte; bloqueio pendente e conservador. */ }
      encerrar()
      return
    }
    let resultado: T
    try {
      resultado = await promessa
    } catch (erro) {
      const rejeitado = erro instanceof ErroHttp && (erro.tipo === 'configuracao'
        || erro.tipo === 'http' && erro.status !== undefined && erro.status >= 400 && erro.status < 500 && ![408, 499].includes(erro.status))
      try { gravarRegistro(chave, { ...lerRegistro(chave), estado: rejeitado ? 'rejeitado' : 'incerto', aviso: rejeitado && erro instanceof ErroHttp && erro.status ? `O servidor rejeitou a tentativa (HTTP ${erro.status}). ${mensagem(erro)}` : mensagem(erro) }) }
      catch { /* O registro pendente ja persistido continua bloqueando o reenvio. */ }
      encerrar()
      return
    }
    try {
      if (!mesmaSessao()) {
        gravarRegistro(chave, { ...lerRegistro(chave), estado: 'incerto' })
        return
      }
      gravarRegistro(chave, { ...lerRegistro(chave), estado: 'concluido' })
      // Falha da atualizacao visual nao transforma sucesso confirmado em rejeicao.
      try { sucesso(resultado) } catch { setFalhaLocal({ chave, texto: 'Operacao confirmada. Nao foi possivel atualizar a tela; consulte o estado antes de continuar.' }) }
    } catch { /* Falha ao salvar confirmacao: mantem o bloqueio pendente. */ }
    finally { encerrar() }
  }
  function nova() {
    if (!mesmaSessao()) return
    try { if (lerRegistro(chave).estado === 'concluido') gravarRegistro(chave, { estado: 'rascunho', rascunho: {} }) }
    catch { setFalhaLocal({ chave, texto: 'Nao foi possivel iniciar outra operacao com seguranca.' }) }
  }
  const incerto = registro.estado === 'incerto' || registro.estado === 'pendente' && ativa !== chave
  return { chave, sessao, dados, alterar, executar, nova, bloqueado, incerto, enviando: ativa === chave,
    concluido: registro.estado === 'concluido',
    aviso: falhaLocal?.chave === chave ? falhaLocal.texto : indisponivel ? 'Nao foi possivel ler o registro local. O envio permanece bloqueado.'
      : simuladorLocalAtivo ? 'Esta operacao exige o modo conectado. Nenhuma escrita sera enviada a API pelo simulador.' : identidade === null ? 'Entre novamente para realizar esta operacao.' : incerto ? 'O resultado e desconhecido. A operacao pode ter sido concluida. O reenvio esta bloqueado, inclusive apos recarregar a pagina. Consulte o estado; se nao houver confirmacao conclusiva, procure o responsavel.'
      : registro.estado === 'concluido' ? 'Operacao confirmada. Esta tentativa nao sera enviada novamente.' : registro.aviso }
}
export function FeedbackEscrita({ controle, consultar }: { controle: ReturnType<typeof useEscritaSegura>; consultar?: (signal: AbortSignal) => Promise<string> }) {
  const [consulta, setConsulta] = useState<{ chave: string; texto: string }>()
  const pedido = useRef<AbortController | null>(null)
  useEffect(() => () => { pedido.current?.abort(); pedido.current = null }, [controle.chave, controle.sessao])
  async function conferir() {
    if (!consultar || pedido.current) return
    const cancelamento = new AbortController()
    pedido.current = cancelamento
    setConsulta({ chave: controle.chave, texto: 'Consultando estado...' })
    try {
      const texto = await consultar(cancelamento.signal)
      if (!cancelamento.signal.aborted && chaveSessaoConsulta() === controle.sessao) setConsulta({ chave: controle.chave, texto: texto + ' A consulta nao confirma o resultado desta tentativa e nao libera reenvio.' })
    } catch {
      if (!cancelamento.signal.aborted) setConsulta({ chave: controle.chave, texto: 'Nao foi possivel consultar. O resultado continua desconhecido e o reenvio bloqueado.' })
    } finally { if (pedido.current === cancelamento) pedido.current = null }
  }
  return <>
    {controle.aviso && <p role={controle.concluido ? 'status' : 'alert'}>{controle.aviso}</p>}
    {controle.incerto && consultar && <button type="button" onClick={() => { void conferir() }}>Consultar estado</button>}
    {consulta?.chave === controle.chave && <p role="status">{consulta.texto}</p>}
    {controle.concluido && <button type="button" onClick={controle.nova}>Iniciar outra operacao</button>}
  </>
}
export function Confirmacao({ titulo, children, confirmar, aoSalvar, fechar, operacao, consultar, rotulo = 'Confirmar' }: {
  titulo: string; children: ReactNode; confirmar: () => Promise<unknown>; aoSalvar: () => void; fechar: () => void;
  operacao: string; consultar?: (signal: AbortSignal) => Promise<string>; rotulo?: string
}) {
  const dialogo = useRef<HTMLDialogElement>(null)
  const controle = useEscritaSegura(operacao)
  const id = useId()
  useLayoutEffect(() => {
    const elemento = dialogo.current!
    const abertura = document.activeElement
    elemento.showModal()
    return () => { elemento.close(); if (abertura instanceof HTMLElement && abertura.isConnected) abertura.focus() }
  }, [])
  function enviar(evento: FormEvent) { evento.preventDefault(); void controle.executar(confirmar, aoSalvar) }
  return <dialog className={styles.dialogo} ref={dialogo} aria-labelledby={id}
    onCancel={evento => { evento.preventDefault(); if (!controle.enviando) fechar() }}>
    <form onSubmit={enviar}>
      <h2 id={id}>{titulo}</h2>
      <fieldset disabled={controle.enviando || controle.bloqueado}>{children}</fieldset>
      <FeedbackEscrita key={controle.chave} controle={controle} consultar={consultar} />
      <div className={styles.acoes}>
        <button type="button" disabled={controle.enviando} onClick={fechar}>{controle.incerto || controle.concluido ? 'Fechar' : 'Cancelar'}</button>
        <button type="submit" disabled={controle.bloqueado}>{controle.enviando ? 'Enviando...' : rotulo}</button>
      </div>
    </form>
  </dialog>
}

export function hojeLocal() {
  const hoje = new Date()
  return [String(hoje.getFullYear()), String(hoje.getMonth() + 1).padStart(2, '0'),
    String(hoje.getDate()).padStart(2, '0')].join('-')
}

export function somarDias(data: string, dias: number) {
  const dia = new Date(data + 'T00:00:00Z')
  dia.setUTCDate(dia.getUTCDate() + dias)
  return dia.toISOString().slice(0, 10)
}

export function dataBR(data: string) {
  return data.slice(0, 10).split('-').reverse().join('/')
}
