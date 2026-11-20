import { useRef, useState, type FormEvent } from 'react'
import type { InteracaoSolicitacaoResposta, SolicitacaoResposta } from '../types/solicitacao'
import { responderSolicitacao } from '../services/agendamentoAluno'
import { mensagem } from '../gestao/consulta'
import { dataBR } from '../gestao/Controles'

function HorariosPropostos({ interacao }: { interacao: InteracaoSolicitacaoResposta }) {
  const horarios = interacao.dados?.horarios
  if (!Array.isArray(horarios)) return null
  return <ul>{horarios.map((h, i) => <li key={i}>
    {dataBR(h.data_reserva)} das {h.hora_inicio.slice(0, 5)} às {h.hora_fim.slice(0, 5)}
  </li>)}</ul>
}

export function RespostaAluno({ solicitacao, atualizar }: { solicitacao: SolicitacaoResposta; atualizar: () => void }) {
  const [texto, setTexto] = useState('')
  const [aceita, setAceita] = useState('sim')
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState('')
  const ocupado = useRef(false)
  const historico = solicitacao.interacoes ?? []
  const proposta = solicitacao.status === 'AguardandoRespostaProposta'
  const pendente = historico.find(i => i.situacao === 'AguardandoResposta' &&
    (proposta ? i.tipo === 'ReplanejamentoProposto' :
      solicitacao.status === 'AguardandoComplementacao' && i.tipo === 'ComplementacaoSolicitada'))
  async function enviar(evento: FormEvent) {
    evento.preventDefault()
    if (!pendente || !solicitacao.id || ocupado.current) return
    if (texto.trim().length < 3) { setErro('Escreva pelo menos três caracteres.'); return }
    ocupado.current = true
    setEnviando(true)
    setErro('')
    try {
      await responderSolicitacao(solicitacao.id, texto.trim(), proposta ? { id: pendente.id, aceita: aceita === 'sim' } : undefined)
      atualizar()
    } catch (falha) {
      setErro(mensagem(falha))
    } finally {
      ocupado.current = false
      setEnviando(false)
    }
  }
  return <>
    {solicitacao.decisao_justificativa && <p><strong>Justificativa da decisão</strong> {solicitacao.decisao_justificativa}</p>}
    {historico.length > 0 && <details><summary>Histórico da solicitação</summary>
      {historico.map(i => <div key={i.id}><p>{i.mensagem}</p>{i.tipo === 'ReplanejamentoProposto' && <HorariosPropostos interacao={i} />}</div>)}
    </details>}
    {pendente && <form className="booking-purpose-form" onSubmit={enviar}>
      <h3>{proposta ? 'Responder à proposta de horário' : 'Responder à complementação'}</h3>
      <p>{pendente.mensagem}</p>
      {proposta && <><HorariosPropostos interacao={pendente} />
        <label>Decisão<select value={aceita} onChange={e => setAceita(e.target.value)}>
          <option value="sim">Aceitar proposta</option><option value="nao">Recusar proposta</option>
        </select></label></>}
      <label htmlFor={'resposta-' + solicitacao.id}>Sua resposta</label>
      <textarea id={'resposta-' + solicitacao.id} required minLength={3} maxLength={2000} value={texto} onChange={e => setTexto(e.target.value)} />
      {erro && <p role="alert">{erro}</p>}
      <button className="button button--primary" disabled={enviando}>Enviar resposta</button>
    </form>}
  </>
}
