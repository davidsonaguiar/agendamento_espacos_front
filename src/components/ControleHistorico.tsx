import styles from './RespostaAluno.module.css'

export function ControleHistorico({ quantidade }: { quantidade: number }) {
  return <summary className={styles.controleHistorico}><svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M4 5h16v11H8l-4 3V5Z" /></svg><span>Histórico da solicitação ({quantidade})</span><span className={styles.setaHistorico} aria-hidden="true">⌄</span></summary>
}