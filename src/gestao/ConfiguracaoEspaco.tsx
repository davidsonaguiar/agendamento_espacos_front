import { useCallback, useState } from 'react'
import { desvincular, registrarFuncionamento, usuariosDisponiveis, vincular, consultarEstadoEspaco, type EspacoGestao, type Vinculo } from './api'
import { AvisoConsulta, Confirmacao, useEscritaSegura } from './Controles'
import { useConsulta } from './consulta'
import styles from '../pages/PainelAdmin.module.css'

type Props = { espaco: EspacoGestao; atualizar: () => void }
const dias = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado']

export function Horarios({ espaco, atualizar }: Props) {
  const [dia, setDia] = useState<number | null>(null)
  return <details><summary>Horários de funcionamento</summary>
    {dias.map((nome, i) => {
      const horario = espaco.horarios_funcionamento.find(h => h.dia_semana === i)
      return <p key={nome}>{nome} · {horario?.ativo ? horario.hora_abertura.slice(0, 5) + '–' + horario.hora_fechamento.slice(0, 5)
        : horario ? 'Fechado' : 'Sem horário cadastrado'} <button aria-label={'Configurar ' + nome} onClick={() => { setDia(i) }}>Configurar</button></p>
    })}
    {dia !== null && <FormularioHorario key={`${espaco.id}:${dia}`} espaco={espaco} dia={dia} atualizar={atualizar} fechar={() => setDia(null)} />}
  </details>
}

function FormularioHorario({ espaco, dia, atualizar, fechar }: Props & { dia: number; fechar: () => void }) {
  const operacao = `espaco:${espaco.id}:funcionamento:${dia}`
  const horario = espaco.horarios_funcionamento.find(h => h.dia_semana === dia)
  const rascunho = useEscritaSegura(operacao, { abertura: horario?.hora_abertura ?? '08:00', fechamento: horario?.hora_fechamento ?? '18:00', ativo: String(horario?.ativo ?? true) })
  const { abertura, fechamento } = rascunho.dados
  const ativo = rascunho.dados.ativo === 'true'
  return <Confirmacao operacao={operacao} consultar={signal => consultarEstadoEspaco(espaco.id, signal)} titulo={'Funcionamento · ' + dias[dia]} rotulo="Salvar" fechar={fechar}
    confirmar={() => {
      if (fechamento <= abertura) throw new Error('O fechamento deve ser posterior à abertura.')
      return registrarFuncionamento(espaco.id, { dia_semana: dia, hora_abertura: abertura, hora_fechamento: fechamento, ativo })
    }} aoSalvar={atualizar}>
    <label className={styles.campo}>Abertura<input type="time" step="1" required value={abertura} onChange={e => rascunho.alterar('abertura', e.target.value)} /></label>
    <label className={styles.campo}>Fechamento<input type="time" step="1" required value={fechamento} onChange={e => rascunho.alterar('fechamento', e.target.value)} /></label>
    <label><input type="checkbox" checked={ativo} onChange={e => rascunho.alterar('ativo', String(e.target.checked))} /> Aberto neste dia</label>
  </Confirmacao>
}

function NovoVinculo({ espaco, administrador, atualizar, fechar }: Props & { administrador: boolean; fechar: () => void }) {
  const carregar = useCallback((signal: AbortSignal) => usuariosDisponiveis(espaco.id, signal), [espaco.id])
  const consulta = useConsulta(carregar)
  const operacao = `espaco:${espaco.id}:vincular`
  const rascunho = useEscritaSegura(operacao, { usuario: '', perfil: 'Monitor' })
  const { usuario, perfil } = rascunho.dados
  const setUsuario = (v: string) => rascunho.alterar('usuario', v)
  const setPerfil = (v: string) => rascunho.alterar('perfil', v)
  return <Confirmacao operacao={operacao} consultar={signal => consultarEstadoEspaco(espaco.id, signal)} titulo="Vincular responsável" rotulo="Vincular" fechar={fechar} aoSalvar={atualizar}
    confirmar={() => {
      if (!consulta.dados?.some(u => String(u.id_usuario) === usuario)) throw new Error('Selecione um membro disponível.')
      return vincular(espaco.id, Number(usuario), perfil)
    }}>
    {!consulta.dados ? <AvisoConsulta erro={consulta.erro} atualizar={consulta.atualizar} /> :
      !consulta.dados.length ? <p>Nenhum membro disponível.</p> :
        <label className={styles.campo}>Membro<select required value={usuario} onChange={e => setUsuario(e.target.value)}>
          <option value="">Selecione</option>{consulta.dados.map(u => <option value={u.id_usuario} key={u.id_usuario}>{u.nome_completo} (#{u.id_usuario})</option>)}
        </select></label>}
    <label className={styles.campo}>Papel no laboratório<select value={perfil} onChange={e => setPerfil(e.target.value)}>
      <option>Monitor</option>{administrador && <option>Coordenador</option>}
    </select></label>
  </Confirmacao>
}

export function Responsaveis({ espaco, administrador, atualizar }: Props & { administrador: boolean }) {
  const [novo, setNovo] = useState(false)
  const [remover, setRemover] = useState<Vinculo | null>(null)
  return <details><summary>Responsáveis</summary>
    {espaco.usuarios_vinculados.map(u => <p key={u.id_usuario}>{u.nome_completo} · {u.perfil_espaco ?? 'Sem papel'}
      {(administrador || u.perfil_espaco === 'Monitor') && <button onClick={() => setRemover(u)}>Remover vínculo</button>}</p>)}
    <button onClick={() => setNovo(true)}>Vincular responsável</button>
    {novo && <NovoVinculo espaco={espaco} administrador={administrador} atualizar={atualizar} fechar={() => setNovo(false)} />}
    {remover && <Confirmacao operacao={`espaco:${espaco.id}:desvincular:${remover.id_usuario}`} consultar={signal => consultarEstadoEspaco(espaco.id, signal)} titulo={'Remover vínculo de ' + remover.nome_completo} fechar={() => setRemover(null)}
      aoSalvar={atualizar} confirmar={() => desvincular(espaco.id, remover.id_usuario)}>
      <p>O vínculo de {remover.perfil_espaco} em {espaco.nome} será removido.</p>
    </Confirmacao>}
  </details>
}
