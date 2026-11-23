import assert from 'node:assert/strict'
import { test, beforeEach, afterEach } from 'node:test'
import { useState } from 'react'
import { readFile } from 'node:fs/promises'
import { transformWithOxc } from 'vite'
import { render, screen, cleanup, fireEvent, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Confirmacao, useEscritaSegura } from '../src/gestao/Controles'
import { decidir, consultarEstadoSolicitacao, type EspacoGestao } from '../src/gestao/api'
import { CadastroEspaco } from '../src/gestao/CadastroEspaco'
import { Laboratorios } from '../src/gestao/Laboratorios'
import { Horarios, Responsaveis } from '../src/gestao/ConfiguracaoEspaco'
import { Interacao } from '../src/gestao/Interacao'
import { RespostaAluno } from '../src/components/RespostaAluno'
import type { SolicitacaoResposta } from '../src/types/solicitacao'

const usuario = { id: 7, nome_completo: 'Usuario teste', cpf: '00000000007', email: 'teste@example.test', vinculo_institucional: 'T7', ativo: true, perfil: 'Administrador' }
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status })
const espaco: EspacoGestao = { id: 2, nome: 'Espaco teste', descricao: 'Descricao', bloco: 'B', capacidade: 10, disponibilidade: true,
  horarios_funcionamento: [], usuarios_vinculados: [{ id_usuario: 15, nome_completo: 'Vinculo teste', perfil_espaco: 'Monitor' }] }
const solicitacao: SolicitacaoResposta = { id: 1, tipo: 'Espaço', finalidade: 'Finalidade teste', urgencia: false, status: 'AguardandoComplementacao',
  decisao_justificativa: null, id_projeto: null, id_solicitante: 7, id_espaco: 2, projeto: null, espaco: null, solicitante: null,
  usuarios_envolvidos: [], ids_recursos: [], anexos: [], horarios: [{ id: 1, data_reserva: '2090-01-01', hora_inicio: '09:00:00.000001', hora_fim: '10:00:00.000002' }],
  interacoes: [{ id: 10, tipo: 'ComplementacaoSolicitada', situacao: 'AguardandoResposta', mensagem: 'Detalhe a finalidade', dados: null, id_usuario: 9, data_criacao: '2026-01-01T10:00:00' }] }
let chamadas: { caminho: string; metodo: string; corpo: unknown }[]
let transporte: (caminho: string, opcoes?: RequestInit) => Promise<Response>
function sessao(id = 7) {
  sessionStorage.setItem('labagenda.usuario', JSON.stringify({ ...usuario, id }))
  sessionStorage.setItem('labagenda.access_token', 'token-teste-' + id)
}
beforeEach(() => {
  sessionStorage.clear(); sessao(); chamadas = []
  const proto = window.HTMLDialogElement.prototype
  // JSDOM nao implementa dialogos modais; nenhum navegador/servidor e iniciado.
  if (!proto.showModal) proto.showModal = function () { this.setAttribute('open', '') }
  if (!proto.close) proto.close = function () { this.removeAttribute('open') }
  transporte = async () => { throw new Error('Transporte sem mock') }
  globalThis.fetch = async (input, opcoes) => {
    const url = new URL(String(input))
    assert.equal(url.origin, 'http://localhost:8000')
    chamadas.push({ caminho: url.pathname, metodo: opcoes?.method ?? 'GET', corpo: opcoes?.body ? JSON.parse(String(opcoes.body)) : null })
    return transporte(url.pathname, opcoes)
  }
})
afterEach(cleanup)
const escritas = () => chamadas.filter(c => ['POST', 'PATCH', 'PUT', 'DELETE'].includes(c.metodo))
function Editor({ operacao = 'solicitacao:1:decisao', fechar = () => {}, salvo = () => {} }: { operacao?: string; fechar?: () => void; salvo?: () => void }) {
  const rascunho = useEscritaSegura(operacao, { texto: '' })
  return <Confirmacao titulo="Decisao de teste" operacao={operacao} fechar={fechar} aoSalvar={salvo}
    consultar={signal => consultarEstadoSolicitacao(1, signal)} confirmar={() => {
      if (rascunho.dados.texto.length < 3) throw new Error('Preencha tres caracteres.')
      return decidir(1, 'Aprovado', rascunho.dados.texto)
    }}>
    <label>Texto de teste<input value={rascunho.dados.texto} onChange={e => rascunho.alterar('texto', e.target.value)} /></label>
  </Confirmacao>
}
async function preencher() { await userEvent.setup().type(screen.getByLabelText('Texto de teste'), 'Justificativa preservada') }
const enviar = () => fireEvent.submit(screen.getByRole('dialog').querySelector('form')!)
async function incerto() { await screen.findByText(/O resultado e desconhecido/); assert.ok(screen.getByRole('button', { name: 'Confirmar' }).hasAttribute('disabled')) }

test('sucesso confirmado envia uma vez, preserva payload e impede repeticao ao remontar', async () => {
  transporte = async () => json({ id: 1, status: 'Aprovado' })
  let salvos = 0
  const tela = render(<Editor salvo={() => { salvos++ }} />)
  await preencher(); enviar()
  await screen.findByText(/Operacao confirmada/)
  enviar(); assert.equal(escritas().length, 1); assert.equal(salvos, 1)
  assert.deepEqual(escritas()[0].corpo, { status: 'Aprovado', justificativa: 'Justificativa preservada' })
  tela.unmount(); render(<Editor />); enviar(); assert.equal(escritas().length, 1)
})
for (const status of [400, 401, 403, 404, 409, 422, 429]) {
  test('rejeicao HTTP explicita ' + status + ' preserva dados e permite tentativa manual, sem retry automatico', async () => {
    transporte = async () => json({ detail: 'Operacao recusada' }, status)
    render(<Editor />); await preencher(); enviar()
    await screen.findByText(new RegExp('HTTP ' + status))
    assert.equal(escritas().length, 1)
    assert.equal(screen.getByRole('button', { name: 'Confirmar' }).hasAttribute('disabled'), false)
    assert.equal((screen.getByLabelText('Texto de teste') as HTMLInputElement).value, 'Justificativa preservada')
    enviar(); await waitFor(() => assert.equal(escritas().length, 2))
  })
}
for (const tipo of ['rede', 'timeout', 'json', '500', '503', '408']) {
  test('resultado incerto ' + tipo + ' fica bloqueado apos remontagem e preserva rascunho', async () => {
    transporte = async () => {
      if (tipo === 'rede') throw new TypeError('offline')
      if (tipo === 'timeout') throw new DOMException('tempo excedido', 'TimeoutError')
      if (tipo === 'json') return new Response('json invalido', { status: 200 })
      return json({ detail: 'Falha' }, Number(tipo))
    }
    const tela = render(<Editor />); await preencher(); enviar(); await incerto()
    enviar(); assert.equal(escritas().length, 1)
    tela.unmount(); render(<Editor />); await incerto(); enviar()
    assert.equal(escritas().length, 1)
    assert.equal((screen.getByLabelText('Texto de teste') as HTMLInputElement).value, 'Justificativa preservada')
  })
}
test('clique duplo e submissao por Enter nao duplicam escrita pendente', async () => {
  let liberar!: (r: Response) => void
  transporte = () => new Promise(resolve => { liberar = resolve })
  render(<Editor />); await preencher()
  await userEvent.setup().dblClick(screen.getByRole('button', { name: 'Confirmar' }))
  await userEvent.setup().keyboard('{Enter}')
  enviar()
  assert.equal(escritas().length, 1)
  await act(async () => { liberar(json({ id: 1, status: 'Aprovado' })) })
  await screen.findByText(/Operacao confirmada/); enviar(); assert.equal(escritas().length, 1)
})
test('fechar, trocar aba e reabrir dialogo nao removem bloqueio nem texto', async () => {
  transporte = async () => { throw new TypeError('offline') }
  function Abas() { const [aberto, setAberto] = useState(true); return <>{aberto ? <Editor fechar={() => setAberto(false)} /> : <button onClick={() => setAberto(true)}>Voltar a aba</button>}</> }
  render(<Abas />); await preencher(); enviar(); await incerto()
  fireEvent.click(screen.getByRole('button', { name: 'Fechar' }))
  fireEvent.click(screen.getByRole('button', { name: 'Voltar a aba' }))
  await incerto(); enviar(); assert.equal(escritas().length, 1)
  assert.equal((screen.getByLabelText('Texto de teste') as HTMLInputElement).value, 'Justificativa preservada')
})
test('pendente restaurado do armazenamento apos recarga simulada nunca e tratado como falha', async () => {
  sessionStorage.setItem('labagenda.escrita.v1:' + JSON.stringify(['conectado', 7, 'solicitacao:1:decisao']), JSON.stringify({ estado: 'pendente', rascunho: { texto: 'Texto antes da recarga' } }))
  render(<Editor />); await incerto(); enviar(); assert.equal(escritas().length, 0)
  assert.equal((screen.getByLabelText('Texto de teste') as HTMLInputElement).value, 'Texto antes da recarga')
})
for (const statusAtual of ['Pendente', 'Aprovado']) test('GET com status ' + statusAtual + ' nao comprova esta tentativa e nao desbloqueia', async () => {
  transporte = async (_, opcoes) => opcoes?.method === 'GET' ? json({ id: 1, status: statusAtual, interacoes: [] }) : Promise.reject(new TypeError('offline'))
  render(<Editor />); await preencher(); enviar(); await incerto()
  fireEvent.click(screen.getByRole('button', { name: 'Consultar estado' }))
  await screen.findByText(new RegExp('Status atual.*' + statusAtual))
  await incerto(); enviar(); assert.equal(escritas().length, 1)
  assert.equal(chamadas.filter(c => c.metodo === 'GET').length, 1)
})
test('troca de conta durante escrita nao executa callback nem reutiliza dados ou bloqueio', async () => {
  let liberar!: (r: Response) => void
  transporte = () => new Promise(resolve => { liberar = resolve })
  let salvos = 0
  render(<Editor salvo={() => { salvos++ }} />); await preencher(); enviar()
  await act(async () => { sessao(8) })
  assert.equal((screen.getByLabelText('Texto de teste') as HTMLInputElement).value, '')
  assert.equal(screen.getByRole('button', { name: 'Confirmar' }).hasAttribute('disabled'), false)
  await act(async () => { liberar(json({ id: 1, status: 'Aprovado' })) })
  assert.equal(salvos, 0)
  assert.equal((screen.getByLabelText('Texto de teste') as HTMLInputElement).value, '')
  await act(async () => { sessao(7) }); await incerto(); enviar(); assert.equal(escritas().length, 1)
})
test('rascunhos e bloqueios de operacoes e identidades diferentes ficam separados', async () => {
  transporte = async () => { throw new TypeError('offline') }
  const tela = render(<Editor />); await preencher(); enviar(); await incerto()
  tela.rerender(<Editor operacao="solicitacao:2:decisao" />)
  assert.equal((screen.getByLabelText('Texto de teste') as HTMLInputElement).value, '')
  assert.equal(screen.getByRole('button', { name: 'Confirmar' }).hasAttribute('disabled'), false)
  tela.rerender(<Editor />); await incerto()
})
test('registro do simulador nao bloqueia operacao conectada e nao e sobrescrito', async () => {
  const chave = 'labagenda.escrita.v1:' + JSON.stringify(['simulado', 7, 'solicitacao:1:decisao'])
  const valor = JSON.stringify({ estado: 'incerto', rascunho: { texto: 'Simulador' } })
  sessionStorage.setItem(chave, valor)
  transporte = async () => json({ id: 1, status: 'Aprovado' })
  render(<Editor />); await preencher(); enviar(); await screen.findByText(/Operacao confirmada/)
  assert.equal(escritas().length, 1); assert.equal(sessionStorage.getItem(chave), valor)
})
test('falha no armazenamento impede transporte antes da escrita', async () => {
  render(<Editor />); await preencher()
  const proto = Object.getPrototypeOf(sessionStorage) as Storage
  const original = proto.setItem
  proto.setItem = function(key, value) { if (key.startsWith('labagenda.escrita.v1:')) throw new Error('Quota'); return original.call(this, key, value) }
  try { enviar(); await screen.findByText(/Nenhuma escrita foi enviada/); assert.equal(escritas().length, 0) }
  finally { proto.setItem = original }
})
test('validacao local nao transmite e nao transforma campos invalidos em resultado incerto', async () => {
  render(<Editor />); enviar(); await screen.findByText('Preencha tres caracteres.')
  assert.equal(escritas().length, 0)
  assert.equal(screen.getByRole('button', { name: 'Confirmar' }).hasAttribute('disabled'), false)
})
test('falha do callback visual depois de sucesso nao libera repeticao', async () => {
  transporte = async () => json({ id: 1, status: 'Aprovado' })
  render(<Editor salvo={() => { throw new Error('Atualizacao falhou') }} />); await preencher(); enviar()
  await screen.findByText(/Operacao confirmada.*Nao foi possivel atualizar/)
  enviar(); assert.equal(escritas().length, 1)
})
test('cadastro de espaco mantem formulario e bloqueio apos falha e remontagem', async () => {
  transporte = async () => { throw new TypeError('offline') }
  const tela = render(<CadastroEspaco aoCriar={() => { throw new Error('Nao deve confirmar') }} />)
  await userEvent.setup().type(screen.getByLabelText('Nome *'), 'Novo laboratorio')
  fireEvent.submit(screen.getByRole('button', { name: 'Cadastrar laboratório' }).closest('form')!)
  await screen.findByText(/O resultado e desconhecido/)
  tela.unmount(); render(<CadastroEspaco aoCriar={() => {}} />)
  assert.equal((screen.getByLabelText('Nome *') as HTMLInputElement).value, 'Novo laboratorio')
  fireEvent.submit(screen.getByRole('button', { name: 'Cadastrar laboratório' }).closest('form')!)
  assert.equal(escritas().length, 1)
})
test('edicao de laboratorio persiste os campos e nao repete PUT ao reabrir', async () => {
  transporte = async () => { throw new TypeError('offline') }
  render(<Laboratorios espacos={[espaco]} administrador aoCriar={() => {}} atualizar={() => {}} />)
  fireEvent.click(screen.getByRole('button', { name: 'Editar' }))
  fireEvent.change(screen.getByLabelText('Nome', { exact: true }), { target: { value: 'Nome alterado' } })
  fireEvent.submit(screen.getByRole('button', { name: 'Salvar' }).closest('form')!)
  await screen.findByText(/O resultado e desconhecido/)
  fireEvent.click(screen.getByRole('button', { name: 'Fechar' })); fireEvent.click(screen.getByRole('button', { name: 'Editar' }))
  assert.equal((screen.getByLabelText('Nome', { exact: true }) as HTMLInputElement).value, 'Nome alterado')
  fireEvent.submit(screen.getByRole('button', { name: 'Salvar' }).closest('form')!)
  assert.deepEqual(escritas().map(c => c.metodo), ['PUT'])
})
test('funcionamento preserva segundos e bloqueio apos reabrir', async () => {
  transporte = async () => { throw new TypeError('offline') }
  const dados = { ...espaco, horarios_funcionamento: [{ dia_semana: 0, hora_abertura: '09:00:00', hora_fechamento: '18:00:00', ativo: true }] }
  render(<Horarios espaco={dados} atualizar={() => {}} />)
  fireEvent.click(screen.getByRole('button', { name: 'Configurar Domingo', hidden: true }))
  fireEvent.change(screen.getByLabelText('Abertura'), { target: { value: '09:15:30' } })
  fireEvent.submit(screen.getByRole('button', { name: 'Salvar' }).closest('form')!)
  await screen.findByText(/O resultado e desconhecido/)
  fireEvent.click(screen.getByRole('button', { name: 'Fechar' })); fireEvent.click(screen.getByRole('button', { name: 'Configurar Domingo', hidden: true }))
  assert.equal((screen.getByLabelText('Abertura') as HTMLInputElement).value, '09:15:30')
  fireEvent.submit(screen.getByRole('button', { name: 'Salvar' }).closest('form')!)
  assert.equal(escritas().length, 1)
})
test('remover vinculo nao repete DELETE apos fechamento e reabertura', async () => {
  transporte = async () => { throw new TypeError('offline') }
  render(<Responsaveis espaco={espaco} administrador atualizar={() => {}} />)
  fireEvent.click(screen.getByRole('button', { name: 'Remover vínculo', hidden: true })); enviar(); await incerto()
  fireEvent.click(screen.getByRole('button', { name: 'Fechar' })); fireEvent.click(screen.getByRole('button', { name: 'Remover vínculo', hidden: true }))
  enviar(); assert.deepEqual(escritas().map(c => c.metodo), ['DELETE'])
})
test('interacao do gestor conserva mensagem e precisao temporal em resultado incerto', async () => {
  transporte = async () => { throw new TypeError('offline') }
  const tela = render(<Interacao solicitacao={solicitacao} proposta fechar={() => {}} salvo={() => {}} />)
  fireEvent.change(screen.getByLabelText('Mensagem'), { target: { value: 'Proposta de teste' } })
  fireEvent.submit(screen.getByRole('button', { name: 'Enviar' }).closest('form')!)
  await screen.findByText(/O resultado e desconhecido/)
  assert.deepEqual(escritas()[0].corpo, { mensagem: 'Proposta de teste', horarios: [{ data_reserva: '2090-01-01', hora_inicio: '09:00:00.000001', hora_fim: '10:00:00.000002' }], ids_recursos: [] })
  tela.unmount(); render(<Interacao solicitacao={solicitacao} proposta fechar={() => {}} salvo={() => {}} />)
  assert.equal((screen.getByLabelText('Mensagem') as HTMLTextAreaElement).value, 'Proposta de teste')
  fireEvent.submit(screen.getByRole('button', { name: 'Enviar' }).closest('form')!)
  assert.equal(escritas().length, 1)
})
for (const proposta of [false, true]) test('resposta do aluno ' + (proposta ? 'a proposta' : 'a complementacao') + ' preserva texto e bloqueia POST incerto', async () => {
  transporte = async () => { throw new TypeError('offline') }
  const dados: SolicitacaoResposta = proposta ? { ...solicitacao, status: 'AguardandoRespostaProposta', interacoes: [{ ...solicitacao.interacoes[0], tipo: 'ReplanejamentoProposto' }] } : solicitacao
  const tela = render(<RespostaAluno solicitacao={dados} atualizar={() => {}} />)
  await userEvent.setup().type(screen.getByLabelText('Sua resposta'), 'Resposta preservada')
  fireEvent.submit(screen.getByRole('button', { name: 'Enviar resposta' }).closest('form')!)
  await screen.findByText(/O resultado e desconhecido/)
  tela.unmount(); render(<RespostaAluno solicitacao={dados} atualizar={() => {}} />)
  assert.equal((screen.getByLabelText('Sua resposta') as HTMLTextAreaElement).value, 'Resposta preservada')
  fireEvent.submit(screen.getByRole('button', { name: 'Enviar resposta' }).closest('form')!)
  assert.equal(escritas().length, 1)
})

test('vincular responsavel conserva selecao e bloqueio depois de reabrir', async () => {
  transporte = async (_, opcoes) => opcoes?.method === 'GET' ? json([{ id_usuario: 20, nome_completo: 'Membro teste', perfil_espaco: null }]) : Promise.reject(new TypeError('offline'))
  render(<Responsaveis espaco={espaco} administrador atualizar={() => {}} />)
  fireEvent.click(screen.getByRole('button', { name: 'Vincular responsável', hidden: true }))
  fireEvent.change(await screen.findByLabelText('Membro'), { target: { value: '20' } })
  fireEvent.change(screen.getByLabelText('Papel no laboratório'), { target: { value: 'Coordenador' } })
  fireEvent.submit(screen.getByRole('button', { name: 'Vincular' }).closest('form')!)
  await screen.findByText(/O resultado e desconhecido/)
  fireEvent.click(screen.getByRole('button', { name: 'Fechar' }))
  fireEvent.click(screen.getByRole('button', { name: 'Vincular responsável', hidden: true }))
  assert.equal((await screen.findByLabelText('Membro') as HTMLSelectElement).value, '20')
  assert.equal((screen.getByLabelText('Papel no laboratório') as HTMLSelectElement).value, 'Coordenador')
  fireEvent.submit(screen.getByRole('button', { name: 'Vincular' }).closest('form')!)
  assert.deepEqual(escritas().map(c => [c.metodo, c.caminho]), [['POST', '/espacos/2/usuarios/20']])
})
test('desativar nao repete DELETE nem reativa implicitamente depois de resultado incerto', async () => {
  transporte = async () => { throw new TypeError('offline') }
  render(<Laboratorios espacos={[espaco]} administrador aoCriar={() => {}} atualizar={() => {}} />)
  fireEvent.click(screen.getByRole('button', { name: 'Desativar' })); enviar(); await incerto()
  fireEvent.click(screen.getByRole('button', { name: 'Fechar' }))
  fireEvent.click(screen.getByRole('button', { name: 'Desativar' })); enviar()
  assert.deepEqual(escritas().map(c => [c.metodo, c.caminho]), [['DELETE', '/espacos/2']])
})
test('cadastro com duplo submit transmite um unico POST e confirma somente apos resposta', async () => {
  let liberar!: (r: Response) => void
  transporte = () => new Promise(resolve => { liberar = resolve })
  let sucesso = 0
  render(<CadastroEspaco aoCriar={() => { sucesso++ }} />)
  fireEvent.change(screen.getByLabelText('Nome *'), { target: { value: 'Novo laboratorio' } })
  const form = screen.getByRole('button', { name: 'Cadastrar laboratório' }).closest('form')!
  fireEvent.submit(form); fireEvent.submit(form)
  assert.equal(escritas().length, 1); assert.equal(sucesso, 0)
  await act(async () => liberar(json({ ...espaco, id: 50, nome: 'Novo laboratorio' }, 201)))
  assert.equal(sucesso, 1); fireEvent.submit(form); assert.equal(escritas().length, 1)
})
test('falha da consulta GET conserva resultado incerto sem repetir escrita', async () => {
  transporte = async () => { throw new TypeError('offline') }
  render(<Editor />); await preencher(); enviar(); await incerto()
  fireEvent.click(screen.getByRole('button', { name: 'Consultar estado' }))
  await screen.findByText(/Nao foi possivel consultar/)
  enviar(); assert.equal(escritas().length, 1)
})
test('registro corrompido nao e tratado como nova tentativa liberada', async () => {
  sessionStorage.setItem('labagenda.escrita.v1:' + JSON.stringify(['conectado', 7, 'solicitacao:1:decisao']), 'json invalido')
  render(<Editor />); await screen.findByText(/Nao foi possivel ler o registro local/)
  enviar(); assert.equal(escritas().length, 0)
})
test('sem identidade autenticada nao transmite escrita nem mostra rascunho de outra conta', async () => {
  sessionStorage.setItem('labagenda.escrita.v1:' + JSON.stringify(['conectado', 7, 'solicitacao:1:decisao']), JSON.stringify({ estado: 'incerto', rascunho: { texto: 'Texto privado' } }))
  sessionStorage.removeItem('labagenda.usuario'); sessionStorage.removeItem('labagenda.access_token')
  render(<Editor />); enviar(); assert.equal(escritas().length, 0)
  assert.equal((screen.getByLabelText('Texto de teste') as HTMLInputElement).value, '')
})

test('modo simulado bloqueia transporte conectado e usa registro separado', async () => {
  const url = new URL('../src/gestao/Controles.tsx', import.meta.url)
  let fonte = await readFile(url, 'utf8')
  fonte = fonte.replace("import { simuladorLocalAtivo } from '../services/sessaoSimulada'", 'const simuladorLocalAtivo = true')
  let codigo = (await transformWithOxc(fonte, url.pathname, { jsx: { runtime: 'automatic' } })).code
  for (const [, ref] of [...codigo.matchAll(/from\s*['"]([^'"]+)['"]/g)]) {
    const resolvido = ref.startsWith('.') ? new URL(ref.endsWith('.css') ? ref : ref + '.ts', url).href : import.meta.resolve(ref)
    codigo = codigo.replaceAll(`'${ref}'`, `'${resolvido}'`).replaceAll(`"${ref}"`, `'${resolvido}'`)
  }
  const modulo: typeof import('../src/gestao/Controles') = await import(`data:text/javascript;base64,${Buffer.from(codigo).toString('base64')}`)
  let tarefas = 0
  function Simulado() {
    const controle = modulo.useEscritaSegura('operacao-simulada', { texto: 'Teste local' })
    return <><button onClick={() => { void controle.executar(async () => { tarefas++ }, () => {}) }}>Forcar envio</button><modulo.FeedbackEscrita controle={controle} /></>
  }
  render(<Simulado />)
  fireEvent.click(screen.getByRole('button', { name: 'Forcar envio' }))
  await screen.findByText(/exige o modo conectado/)
  assert.equal(tarefas, 0); assert.equal(chamadas.length, 0)
  assert.ok(sessionStorage.getItem('labagenda.escrita.v1:' + JSON.stringify(['simulado', 7, 'operacao-simulada'])))
  assert.equal(sessionStorage.getItem('labagenda.escrita.v1:' + JSON.stringify(['conectado', 7, 'operacao-simulada'])), null)
})
