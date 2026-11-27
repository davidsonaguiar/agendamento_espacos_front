import { useEffect, useState } from 'react'

/** Revalida telas abertas quando o início vence e ao retornar à janela. */
export function useRelogioLocal() {
  const [agora, setAgora] = useState(() => new Date())
  useEffect(() => {
    const atualizar = () => setAgora(new Date())
    const timer = window.setInterval(atualizar, 1000)
    window.addEventListener('focus', atualizar)
    document.addEventListener('visibilitychange', atualizar)
    return () => {
      window.clearInterval(timer)
      window.removeEventListener('focus', atualizar)
      document.removeEventListener('visibilitychange', atualizar)
    }
  }, [])
  return agora
}
