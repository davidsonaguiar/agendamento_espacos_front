import { useCallback, useState } from 'react'
import { listarAgenda, type EspacoGestao } from './api'
import { useConsulta } from './consulta'
import { AvisoConsulta, dataBR, hojeLocal, somarDias } from './Controles'
import styles from '../pages/PainelAdmin.module.css'

export function Agenda({ espacos }: { espacos: EspacoGestao[] }) {
  const [selecionado, setId] = useState(espacos[0]?.id)
  const id = espacos.some(e => e.id === selecionado) ? selecionado : espacos[0]?.id
  const [inicio, setInicio] = useState(hojeLocal)
  const [fim, setFim] = useState(() => somarDias(hojeLocal(), 6))
  const valido = Boolean(id && inicio && fim && fim >= inicio)
  const carregar = useCallback((signal: AbortSignal) => valido && id
    ? listarAgenda(id, inicio, somarDias(fim, 1), signal) : Promise.resolve([]), [valido, id, inicio, fim])
  const { dados, erro, atualizar } = useConsulta(carregar)
  if (!espacos.length) return <p>Nenhum laboratório disponível para consulta.</p>
  return <>
    <div className={styles.filtros}>
      <label className={styles.campo}>Laboratório<select value={id} onChange={e => setId(Number(e.target.value))}>
        {espacos.map(e => <option key={e.id} value={e.id}>{e.nome}</option>)}
      </select></label>
      <label className={styles.campo}>Data inicial<input type="date" value={inicio} onChange={e => setInicio(e.target.value)} /></label>
      <label className={styles.campo}>Data final<input type="date" value={fim} onChange={e => setFim(e.target.value)} /></label>
      <button disabled={!valido} onClick={atualizar}>Atualizar agenda</button>
    </div>
    {!valido ? <p role="alert">Informe as duas datas em ordem cronológica.</p> :
      !dados ? <AvisoConsulta erro={erro} atualizar={atualizar} /> :
        !dados.length ? <p className={styles.estadoVazio}>Nenhuma reserva confirmada neste período.</p> :
          dados.map(r => <article key={r.id} className={styles.cartao}>
            <h3>Reserva #{r.id} · Solicitação #{r.id_solicitacao}</h3>
            <p>{dataBR(r.data_hora_inicio)} às {r.data_hora_inicio.slice(11, 16)} até {dataBR(r.data_hora_fim)} às {r.data_hora_fim.slice(11, 16)}</p>
            <p>{r.espaco_reservado ? 'Espaço reservado' : 'Reserva independente de recurso'}
              {r.ids_recursos.length > 0 && ' · Recursos ' + r.ids_recursos.join(', ')}</p>
          </article>)}
  </>
}
