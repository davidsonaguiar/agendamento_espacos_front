import { useState } from 'react'
import { alterarDisponibilidade, salvarEspaco, consultarEstadoEspaco, type EspacoGestao } from './api'
import { CadastroEspaco } from './CadastroEspaco'
import { Horarios, Responsaveis } from './ConfiguracaoEspaco'
import { Confirmacao, useEscritaSegura } from './Controles'
import styles from '../pages/PainelAdmin.module.css'

function Formulario({ espaco, fechar, salvo }: { espaco: EspacoGestao; fechar: () => void; salvo: () => void }) {
  const operacao = `espaco:${espaco.id}:editar`
  const rascunho = useEscritaSegura(operacao, { nome: espaco.nome, descricao: espaco.descricao ?? '', bloco: espaco.bloco ?? '', capacidade: espaco.capacidade?.toString() ?? '' })
  const { nome, descricao, bloco, capacidade } = rascunho.dados
  const setNome = (v: string) => rascunho.alterar('nome', v)
  const setDescricao = (v: string) => rascunho.alterar('descricao', v)
  const setBloco = (v: string) => rascunho.alterar('bloco', v)
  const setCapacidade = (v: string) => rascunho.alterar('capacidade', v)
  function confirmar() {
    if (nome.trim().length < 3) throw new Error('O nome deve ter ao menos três caracteres.')
    return salvarEspaco(espaco.id, { nome: nome.trim(), descricao: descricao.trim(), bloco: bloco.trim(),
      capacidade: capacidade === '' ? null : Number(capacidade) })
  }
  return <Confirmacao operacao={operacao} consultar={signal => consultarEstadoEspaco(espaco.id, signal)} titulo="Editar laboratório" rotulo="Salvar" confirmar={confirmar} aoSalvar={salvo} fechar={fechar}>
    <label className={styles.campo}>Nome<input value={nome} onChange={e => setNome(e.target.value)} required minLength={3} /></label>
    <label className={styles.campo}>Descrição<textarea value={descricao} onChange={e => setDescricao(e.target.value)} /></label>
    <label className={styles.campo}>Bloco<input value={bloco} onChange={e => setBloco(e.target.value)} /></label>
    <label className={styles.campo}>Capacidade<input type="number" min="0" step="1" required={espaco?.capacidade != null}
      value={capacidade} onChange={e => setCapacidade(e.target.value)} /></label>
  </Confirmacao>
}

export function Laboratorios({ espacos, administrador, atualizar, aoCriar }: {
  espacos: EspacoGestao[]; administrador: boolean; aoCriar: (nome: string) => void; atualizar: () => void
}) {
  const [edicao, setEdicao] = useState<EspacoGestao | null>(null)
  const [alvo, setAlvo] = useState<EspacoGestao | null>(null)
  return <>
    {administrador && <CadastroEspaco aoCriar={aoCriar} />}
    <h3>Laboratórios cadastrados</h3>
    <div className={styles.acoes}>
      <button onClick={atualizar}>Atualizar laboratórios</button>
    </div>
    {espacos.length === 0 && <p className={styles.estadoVazio}>Nenhum laboratório cadastrado.</p>}
    {espacos.map(e => <article className={styles.cartao} key={e.id}>
      <h3>{e.nome}</h3>
      <p>{e.disponibilidade ? 'Ativo' : 'Inativo'}{e.bloco && ' · ' + e.bloco}{e.capacidade !== null && ' · Capacidade ' + e.capacidade}</p>
      {e.descricao && <p>{e.descricao}</p>}
      <div className={styles.acoes}>
        <button onClick={() => setEdicao(e)}>Editar</button>
        {administrador && <button onClick={() => setAlvo(e)}>{e.disponibilidade ? 'Desativar' : 'Reativar'}</button>}
      </div>
      <Horarios espaco={e} atualizar={atualizar} />
      <Responsaveis espaco={e} administrador={administrador} atualizar={atualizar} />
    </article>)}
    {edicao && <Formulario espaco={edicao} fechar={() => setEdicao(null)}
      salvo={() => { setEdicao(null); atualizar() }} />}
    {alvo && administrador && <Confirmacao operacao={`espaco:${alvo.id}:disponibilidade`} consultar={signal => consultarEstadoEspaco(alvo.id, signal)} titulo={(alvo.disponibilidade ? 'Desativar ' : 'Reativar ') + alvo.nome}
      confirmar={() => alterarDisponibilidade(alvo)} fechar={() => setAlvo(null)}
      aoSalvar={() => { setAlvo(null); atualizar() }}>
      <p>{alvo.disponibilidade ? 'O laboratório ficará indisponível para novas solicitações.' : 'O laboratório voltará a ficar disponível para solicitações.'}</p>
    </Confirmacao>}
  </>
}
