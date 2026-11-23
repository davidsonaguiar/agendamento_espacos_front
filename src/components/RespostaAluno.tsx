import type { FormEvent } from 'react'
import type { InteracaoSolicitacaoResposta, SolicitacaoResposta } from '../types/solicitacao'
import { responderSolicitacao } from '../services/agendamentoAluno'
import { dataBR, useEscritaSegura, FeedbackEscrita } from '../gestao/Controles'
import { consultarEstadoSolicitacao } from '../gestao/api'

function HorariosPropostos({ interacao }: { interacao: InteracaoSolicitacaoResposta }) {
  const horarios = interacao.dados?.horarios
  if (!Array.isArray(horarios)) return null
  return <ul>{horarios.map((h, i) => <li key={i}>
    {dataBR(h.data_reserva)} das {h.hora_inicio.slice(0, 5)} às {h.hora_fim.slice(0, 5)}
  </li>)}</ul>
}

export function RespostaAluno({ solicitacao, atualizar }: { solicitacao: SolicitacaoResposta; atualizar: () => void }) {
  const historico = solicitacao.interacoes ?? []
  const proposta = solicitacao.status === 'AguardandoRespostaProposta'
  const pendente = historico.find(i => i.situacao === 'AguardandoResposta' &&
    (proposta ? i.tipo === 'ReplanejamentoProposto' :
      solicitacao.status === 'AguardandoComplementacao' && i.tipo === 'ComplementacaoSolicitada'))
  const controle = useEscritaSegura(`solicitacao:${solicitacao.id}:resposta:${pendente?.id ?? 'nenhuma'}`, { texto: '', aceita: 'sim' })
  const { texto, aceita } = controle.dados
  const setTexto = (v: string) => controle.alterar('texto', v)
  const setAceita = (v: string) => controle.alterar('aceita', v)
  function enviar(evento: FormEvent) {
    evento.preventDefault()
    if (!pendente || !solicitacao.id) return
    void controle.executar(() => {
      if (texto.trim().length < 3) throw new Error('Escreva pelo menos três caracteres.')
      return responderSolicitacao(solicitacao.id!, texto.trim(), proposta ? { id: pendente.id, aceita: aceita === 'sim' } : undefined)
    }, atualizar)
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
        <label>Decisão<select disabled={controle.bloqueado} value={aceita} onChange={e => setAceita(e.target.value)}>
          <option value="sim">Aceitar proposta</option><option value="nao">Recusar proposta</option>
        </select></label></>}
      <label htmlFor={'resposta-' + solicitacao.id}>Sua resposta</label>
      <textarea disabled={controle.bloqueado} id={'resposta-' + solicitacao.id} required minLength={3} maxLength={2000} value={texto} onChange={e => setTexto(e.target.value)} />
      <FeedbackEscrita key={controle.chave} controle={controle} consultar={signal => consultarEstadoSolicitacao(solicitacao.id!, signal)} />
      <button className="button button--primary" disabled={controle.bloqueado}>Enviar resposta</button>
    </form>}
  </>
}
