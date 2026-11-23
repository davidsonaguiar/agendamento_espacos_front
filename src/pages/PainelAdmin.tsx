import { useState, type KeyboardEvent } from 'react'
import { simuladorLocalAtivo } from '../services/sessaoSimulada'
import { FilaSimulada } from '../gestao/FilaSimulada'
import { Cabecalho } from '../components/Cabecalho'
import { useAcessoGestor } from '../gestao/contextoGestor'
import { AvisoConsulta } from '../gestao/Controles'
import { Fila } from '../gestao/Fila'
import { Agenda } from '../gestao/Agenda'
import { Laboratorios } from '../gestao/Laboratorios'
import styles from './PainelAdmin.module.css'

const abas = [
  { nome: 'Aprovações', titulo: 'Fila de aprovação' },
  { nome: 'Agenda', titulo: 'Agenda mestre' },
  { nome: 'Laboratórios', titulo: 'Gestão de laboratórios' },
]

export function PainelAdmin() {
  const acesso = useAcessoGestor()
  const [aviso, setAviso] = useState('')
  const [aba, setAba] = useState(0)
  function navegarAbas(evento: KeyboardEvent<HTMLButtonElement>, indice: number) {
    const destinos: Record<string, number> = { Home: 0, End: abas.length - 1,
      ArrowLeft: (indice + abas.length - 1) % abas.length, ArrowRight: (indice + 1) % abas.length }
    const destino = destinos[evento.key]
    if (destino === undefined) return
    evento.preventDefault()
    setAba(destino)
    document.getElementById('aba-gestor-' + destino)?.focus()
  }

  const espacos = acesso?.espacos
  if (!espacos || !acesso) return <main className="access-feedback">
    <AvisoConsulta erro={acesso?.erro} atualizar={() => acesso?.atualizar()} />
  </main>
  function aposCadastro(nome: string) {
    setAviso(`Espaço "${nome}" cadastrado com sucesso.`)
    acesso?.atualizar()
  }

  return <>
    <Cabecalho />
    <main className={styles.pagina}>
      <header className={styles.cabecalhoPagina}>
        <h1>Painel do gestor</h1><p>Gerencie solicitações e acompanhe a utilização dos laboratórios.</p>
      </header>
      <div className={styles.abas} role="tablist" aria-label="Seções do painel do gestor">
        {abas.map(({ nome }, i) => <button key={nome} id={'aba-gestor-' + i} type="button" role="tab"
          className={styles.botaoAba + (aba === i ? ' ' + styles.abaAtiva : '')}
          aria-selected={aba === i} tabIndex={aba === i ? 0 : -1} aria-controls={'painel-gestor-' + i}
          onKeyDown={e => navegarAbas(e, i)} onClick={() => setAba(i)}>{nome}</button>)}
      </div>
      {abas.map(({ titulo }, i) => <section key={titulo} role="tabpanel" id={'painel-gestor-' + i}
        aria-labelledby={'aba-gestor-' + i} hidden={aba !== i} className={styles.conteudoAba}>
        {aba === i && <>
          <header className={styles.tituloSecao}><h2>{titulo}</h2></header>
          {i === 0 && (simuladorLocalAtivo ? <FilaSimulada /> : <Fila espacos={espacos} />)}
          {i === 1 && (simuladorLocalAtivo ? <p>As reservas confirmadas estão disponíveis no modo conectado.</p> : <Agenda espacos={espacos} />)}
          {i === 2 && aviso && <p role="status">{aviso}</p>}
          {i === 2 && (simuladorLocalAtivo
            ? <p>Desative o simulador local para gerenciar laboratórios pela API.</p>
            : <Laboratorios aoCriar={aposCadastro} espacos={espacos} administrador={acesso.administrador} atualizar={acesso.atualizar} />)}
        </>}
      </section>)}
    </main>
  </>
}
