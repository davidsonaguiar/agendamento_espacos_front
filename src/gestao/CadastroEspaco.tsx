import { useState, type FormEvent } from 'react'
import { criarEspaco } from './espacos'
import type { CriarEspacoInput } from './tiposEspaco'
import styles from '../pages/PainelAdmin.module.css'

export function CadastroEspaco({ aoCriar }: { aoCriar: (nome: string) => void }) {
  const [nomeEspaco, setNomeEspaco] = useState('')
  const [descricaoEspaco, setDescricaoEspaco] = useState('')
  const [capacidadeEspaco, setCapacidadeEspaco] = useState('')
  const [blocoEspaco, setBlocoEspaco] = useState('')
  const [disponibilidadeEspaco, setDisponibilidadeEspaco] = useState(true)
  const [salvandoEspaco, setSalvandoEspaco] = useState(false)
  const [erroEspacos, setErroEspacos] = useState('')
  async function cadastrarEspaco(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    if (nomeEspaco.trim().length < 3) {
      setErroEspacos('O nome deve ter ao menos três caracteres.')
      return
    }
    setSalvandoEspaco(true)
    setErroEspacos('')

    const dados: CriarEspacoInput = {
      nome: nomeEspaco.trim(),
      descricao: descricaoEspaco.trim() || null,
      capacidade: capacidadeEspaco ? Number(capacidadeEspaco) : null,
      bloco: blocoEspaco.trim() || null,
      disponibilidade: disponibilidadeEspaco,
    }
    try {
      const criado = await criarEspaco(dados)
      setNomeEspaco('')
      setDescricaoEspaco('')
      setCapacidadeEspaco('')
      setBlocoEspaco('')
      setDisponibilidadeEspaco(true)
      aoCriar(criado.nome)
    } catch (erro) {
      setErroEspacos(erro instanceof Error ? erro.message : 'Não foi possível cadastrar o espaço.')
    } finally {
      setSalvandoEspaco(false)
    }
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
        disabled={salvandoEspaco}
      />
    </label>
    <label className={styles.campo}>
      <span>Descrição</span>
      <input
        value={descricaoEspaco}
        onChange={evento => setDescricaoEspaco(evento.target.value)}
        disabled={salvandoEspaco}
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
        disabled={salvandoEspaco}
      />
    </label>
    <label className={styles.campo}>
      <span>Bloco</span>
      <input
        value={blocoEspaco}
        onChange={evento => setBlocoEspaco(evento.target.value)}
        disabled={salvandoEspaco}
      />
    </label>
    <label className={styles.checkboxEspaco}>
      <input
        type="checkbox"
        checked={disponibilidadeEspaco}
        onChange={evento => setDisponibilidadeEspaco(evento.target.checked)}
        disabled={salvandoEspaco}
      />
      Disponível para agendamento
    </label>
  </div>
  <p className={styles.dicaEspaco}>O backend define o horário padrão de funcionamento de segunda a sexta, das 8h às 18h.</p>
  {erroEspacos && <p className={styles.erro} role="alert">{erroEspacos}</p>}
  <button className={styles.botaoEspaco} type="submit" disabled={salvandoEspaco}>
    {salvandoEspaco ? 'Cadastrando...' : 'Cadastrar laboratório'}
  </button>
</form>
}
