import type { SolicitacaoResposta } from '../types/solicitacao'
import { pedirComplemento, proporHorario, consultarEstadoSolicitacao } from './api'
import { Confirmacao, useEscritaSegura, hojeLocal } from './Controles'
import styles from '../pages/PainelAdmin.module.css'

export function Interacao({ solicitacao, proposta, fechar, salvo }: {
  solicitacao: SolicitacaoResposta; proposta: boolean; fechar: () => void; salvo: () => void
}) {
  const operacao = `solicitacao:${solicitacao.id}:interacao`
  const iniciais = solicitacao.horarios.map(h => ({ data_reserva: h.data_reserva, hora_inicio: h.hora_inicio, hora_fim: h.hora_fim }))
  const rascunho = useEscritaSegura(operacao, { mensagem: '', horarios: JSON.stringify(iniciais) })
  const mensagem = rascunho.dados.mensagem
  const setMensagem = (v: string) => rascunho.alterar('mensagem', v)
  const horarios = (() => {
    try {
      const v: unknown = JSON.parse(rascunho.dados.horarios)
      if (Array.isArray(v) && v.every(h => h && typeof h === 'object' && typeof h.data_reserva === 'string' && typeof h.hora_inicio === 'string' && typeof h.hora_fim === 'string')) return v as typeof iniciais
    } catch { /* Preserva a tela caso o rascunho local esteja danificado. */ }
    return iniciais
  })()
  function alterar(i: number, campo: keyof typeof horarios[number], valor: string) {
    rascunho.alterar('horarios', JSON.stringify(horarios.map((h, j) => j === i ? { ...h, [campo]: valor } : h)))
  }
  function confirmar() {
    if (mensagem.trim().length < 3) throw new Error('Escreva uma mensagem com pelo menos três caracteres.')
    if (!proposta) return pedirComplemento(solicitacao.id!, mensagem.trim())
    if (!horarios.length || horarios.some(h => h.hora_fim.padEnd(8, ':00') <= h.hora_inicio.padEnd(8, ':00'))) {
      throw new Error('Cada horário deve terminar depois do início.')
    }
    return proporHorario(solicitacao.id!, mensagem.trim(), horarios, solicitacao.ids_recursos)
  }
  return <Confirmacao operacao={operacao} consultar={signal => consultarEstadoSolicitacao(solicitacao.id!, signal)} titulo={proposta ? 'Sugerir novo horário' : 'Pedir complementação'}
    confirmar={confirmar} rotulo="Enviar" aoSalvar={salvo} fechar={fechar}>
    {proposta && horarios.map((h, i) => <fieldset key={i}>
      <legend>Horário {i + 1}</legend>
      <label className={styles.campo}>Data<input type="date" required min={hojeLocal()} value={h.data_reserva} onChange={e => alterar(i, 'data_reserva', e.target.value)} /></label>
      <label className={styles.campo}>Início<input type="time" required step="1" value={h.hora_inicio} onChange={e => alterar(i, 'hora_inicio', e.target.value)} /></label>
      <label className={styles.campo}>Fim<input type="time" required step="1" value={h.hora_fim} onChange={e => alterar(i, 'hora_fim', e.target.value)} /></label>
    </fieldset>)}
    <label className={styles.campo}>Mensagem<textarea required minLength={3} maxLength={2000} value={mensagem} onChange={e => setMensagem(e.target.value)} /></label>
  </Confirmacao>
}
