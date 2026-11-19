import { useSyncExternalStore } from 'react'
import { obterTokenAcesso, obterUsuarioAutenticado } from '../services/autenticacao'

/** Snapshot só de identidade/token, nunca de uma lista. Não altera a autenticação. */
export function chaveSessaoConsulta(): string {
  const u = obterUsuarioAutenticado()
  return u?.ativo && !sessionStorage.getItem('labagenda.logout_pendente') ? JSON.stringify([u.id, obterTokenAcesso()]) : ''
}
const ouvintes = new Set<() => void>()
let removerObservacao: (() => void) | undefined
function assinar(ouvinte: () => void) {
  ouvintes.add(ouvinte)
  if (!removerObservacao) {
    // sessionStorage não emite storage no próprio documento. Observar as três
    // mutações nativas permite invalidar a tela no mesmo evento do logout/login,
    // sem polling nem alterações no módulo de autenticação. Sem escritas aqui.
    const storage = window.sessionStorage
    const proto = Object.getPrototypeOf(storage) as Storage
    const original = { setItem: proto.setItem, removeItem: proto.removeItem, clear: proto.clear }
    const avisar = () => ouvintes.forEach(fn => fn())
    const relevante = (key: string) => ['labagenda.access_token', 'labagenda.usuario', 'labagenda.logout_pendente'].includes(key)
    function setItem(this: Storage, key: string, value: string) { original.setItem.call(this, key, value); if (this === storage && relevante(key)) avisar() }
    function removeItem(this: Storage, key: string) { original.removeItem.call(this, key); if (this === storage && relevante(key)) avisar() }
    function clear(this: Storage) { original.clear.call(this); if (this === storage) avisar() }
    proto.setItem = setItem; proto.removeItem = removeItem; proto.clear = clear
    window.addEventListener('storage', avisar)
    window.addEventListener('focus', avisar)
    document.addEventListener('visibilitychange', avisar)
    removerObservacao = () => {
      if (proto.setItem === setItem) proto.setItem = original.setItem
      if (proto.removeItem === removeItem) proto.removeItem = original.removeItem
      if (proto.clear === clear) proto.clear = original.clear
      window.removeEventListener('storage', avisar)
      window.removeEventListener('focus', avisar)
      document.removeEventListener('visibilitychange', avisar)
    }
  }
  return () => {
    ouvintes.delete(ouvinte)
    if (!ouvintes.size) { removerObservacao?.(); removerObservacao = undefined }
  }
}
export const useSessaoConsulta = () => useSyncExternalStore(assinar, chaveSessaoConsulta, () => '')
