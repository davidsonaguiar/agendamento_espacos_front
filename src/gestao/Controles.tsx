import { useLayoutEffect, useId, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { mensagem } from './consulta'
import styles from '../pages/PainelAdmin.module.css'

export function AvisoConsulta({ erro, atualizar }: { erro?: string; atualizar: () => void }) {
  if (!erro) return <p role="status">Carregando…</p>
  return <div role="alert"><p>{erro}</p><button type="button" onClick={atualizar}>Tentar novamente</button></div>
}

export function Confirmacao({ titulo, children, confirmar, aoSalvar, fechar, rotulo = 'Confirmar' }: {
  titulo: string
  children: ReactNode
  confirmar: () => Promise<unknown>
  aoSalvar: () => void
  fechar: () => void
  rotulo?: string
}) {
  const dialogo = useRef<HTMLDialogElement>(null)
  const bloqueio = useRef(false)
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState('')
  const id = useId()
  useLayoutEffect(() => {
    const elemento = dialogo.current!
    const abertura = document.activeElement
    elemento.showModal()
    return () => {
      elemento.close()
      if (abertura instanceof HTMLElement && abertura.isConnected) abertura.focus()
    }
  }, [])

  async function enviar(evento: FormEvent) {
    evento.preventDefault()
    if (bloqueio.current) return
    bloqueio.current = true
    setEnviando(true)
    setErro('')
    try {
      await confirmar()
      aoSalvar()
    } catch (falha) {
      setErro(mensagem(falha))
    } finally {
      bloqueio.current = false
      setEnviando(false)
    }
  }

  return <dialog className={styles.dialogo} ref={dialogo} aria-labelledby={id}
    onCancel={evento => { evento.preventDefault(); if (!bloqueio.current) fechar() }}>
    <form onSubmit={enviar}>
      <h2 id={id}>{titulo}</h2>
      <fieldset disabled={enviando}>{children}</fieldset>
      {erro && <p role="alert">{erro}</p>}
      <div className={styles.acoes}>
        <button type="button" disabled={enviando} onClick={fechar}>Cancelar</button>
        <button type="submit" disabled={enviando}>{enviando ? 'Enviando…' : rotulo}</button>
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
