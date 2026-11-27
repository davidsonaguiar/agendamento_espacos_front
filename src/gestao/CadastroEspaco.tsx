import type { FormEvent } from 'react'
import { useEscritaSegura, FeedbackEscrita } from './Controles'
import { consultarEstadoEspaco } from './api'
import { criarEspaco } from './espacos'
import type { CriarEspacoInput } from './tiposEspaco'
import styles from '../pages/PainelAdmin.module.css'

export function CadastroEspaco({ aoCriar }: { aoCriar: (nome: string) => void }) {
  const controle = useEscritaSegura('espaco:cadastrar', { nomeEspaco: '', descricaoEspaco: '', capacidadeEspaco: '', blocoEspaco: '', disponibilidadeEspaco: 'true' })
  const { nomeEspaco, descricaoEspaco, capacidadeEspaco, blocoEspaco } = controle.dados
  const disponibilidadeEspaco = controle.dados.disponibilidadeEspaco === 'true'
  const setNomeEspaco = (v: string) => controle.alterar('nomeEspaco', v)
  const setDescricaoEspaco = (v: string) => controle.alterar('descricaoEspaco', v)
  const setCapacidadeEspaco = (v: string) => controle.alterar('capacidadeEspaco', v)
  const setBlocoEspaco = (v: string) => controle.alterar('blocoEspaco', v)
  const setDisponibilidadeEspaco = (v: boolean) => controle.alterar('disponibilidadeEspaco', String(v))
  const salvandoEspaco = controle.enviando
  function cadastrarEspaco(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    void controle.executar(() => {
      if (nomeEspaco.trim().length < 3) throw new Error('O nome deve ter ao menos três caracteres.')
      const dados: CriarEspacoInput = { nome: nomeEspaco.trim(), descricao: descricaoEspaco.trim() || null,
        capacidade: capacidadeEspaco ? Number(capacidadeEspaco) : null, bloco: blocoEspaco.trim() || null, disponibilidade: disponibilidadeEspaco }
      return criarEspaco(dados)
    }, criado => aoCriar(criado.nome))
  }

  return <form className={styles.formularioEspaco} onSubmit={evento => { void cadastrarEspaco(evento) }}>
  <h3>Cadastrar laboratório</h3>
  <div className={styles.camposEspaco}>
    <label className={styles.campo}>
      <span>Nome *</span>
      <input
        value={nomeEspaco}
        onChange={evento => setNomeEspaco(evento.target.value)}
        required
        minLength={3}
        maxLength={120}
        disabled={controle.bloqueado}
      />
    </label>
    <label className={styles.campo}>
      <span>Descrição</span>
      <input
        value={descricaoEspaco}
        onChange={evento => setDescricaoEspaco(evento.target.value)}
        disabled={controle.bloqueado}
      />
    </label>
    <label className={styles.campo}>
      <span>Capacidade</span>
      <input
        type="number"
        min="1"
        step="1"
        value={capacidadeEspaco}
        onChange={evento => setCapacidadeEspaco(evento.target.value)}
        disabled={controle.bloqueado}
      />
    </label>
    <label className={styles.campo}>
      <span>Bloco</span>
      <input
        value={blocoEspaco}
        onChange={evento => setBlocoEspaco(evento.target.value)}
        disabled={controle.bloqueado}
      />
    </label>
    <label className={styles.checkboxEspaco}>
      <input
        type="checkbox"
        checked={disponibilidadeEspaco}
        onChange={evento => setDisponibilidadeEspaco(evento.target.checked)}
        disabled={controle.bloqueado}
      />
      Disponível para agendamento
    </label>
  </div>
  <p className={styles.dicaEspaco}>O backend define o horário padrão de funcionamento de segunda a sexta, das 8h às 18h.</p>
  <FeedbackEscrita key={controle.chave} controle={controle} consultar={signal => consultarEstadoEspaco(null, signal)} />
  <button className={styles.botaoEspaco} type="submit" disabled={controle.bloqueado}>
    {salvandoEspaco ? 'Cadastrando...' : 'Cadastrar laboratório'}
  </button>
</form>
}
