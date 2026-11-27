import assert from 'node:assert/strict'
import { beforeEach, afterEach, test } from 'node:test'
import { render, screen, cleanup, fireEvent, waitFor, within, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { MeusAgendamentos } from '../src/pages/MeusAgendamentos'
import type { SolicitacaoConsulta } from '../src/types/solicitacaoConsulta'

const usuario = { id: 7, nome_completo: 'Aluno ficticio', cpf: '00000000007', email: 'mock@example.invalid', vinculo_institucional: 'TESTE', perfil: 'Membro', ativo: true }
function pedido(proposta = false, id = 41, dono = 7): SolicitacaoConsulta {
  return { id, id_solicitante: dono, id_espaco: 2, finalidade: 'Estudo simulado ' + id, urgencia: false,
    status: proposta ? 'AguardandoRespostaProposta' : 'AguardandoComplementacao', decisao_justificativa: null, id_projeto: null,
    espaco_reservado: true, espaco: { id: 2, nome: 'Espaco ficticio', descricao: null, capacidade: 12, bloco: null, disponibilidade: true },
    projeto: null, solicitante: null, usuarios_envolvidos: [], ids_recursos: [], anexos: [],
    horarios: [{ id, data_reserva: '2090-01-01', hora_inicio: '09:00:00', hora_fim: '10:00:00' }],
    interacoes: [{ id: 17, tipo: proposta ? 'ReplanejamentoProposto' : 'ComplementacaoSolicitada', situacao: 'AguardandoResposta',
      mensagem: proposta ? 'Podemos utilizar este novo horario?' : 'Informe a quantidade de participantes.', id_usuario: 8, data_criacao: '2026-11-24T10:00:00',
      dados: proposta ? { horarios: [{ data_reserva: '2090-01-02', hora_inicio: '13:00:00.123456', hora_fim: '14:00:00.123456' }] } : null }] }
}
let lista: SolicitacaoConsulta[]
let chamadas: { path: string; method: string; body: unknown }[]
let responder: () => Promise<Response>
beforeEach(() => {
  sessionStorage.clear()
  sessionStorage.setItem('labagenda.usuario', JSON.stringify(usuario))
  sessionStorage.setItem('labagenda.access_token', 'token-somente-mock')
  lista = [pedido()]; chamadas = []
  responder = async () => { throw new TypeError('Falha simulada') }
  globalThis.fetch = async (input, opcoes) => {
    const path = new URL(String(input)).pathname, method = opcoes?.method ?? 'GET'
    chamadas.push({ path, method, body: opcoes?.body ? JSON.parse(String(opcoes.body)) : null })
    if (path === '/solicitacoes/' && method === 'GET') return Response.json(lista)
    if (path === '/solicitacoes/41' && method === 'GET') return Response.json(lista[0])
    assert.equal(method, 'POST')
    assert.match(new Headers(opcoes?.headers).get('Authorization') ?? '', /^Bearer /)
    return responder()
  }
})
afterEach(cleanup)
const montar = () => render(<MemoryRouter><MeusAgendamentos /></MemoryRouter>)
async function mostrar() {
  await screen.findByRole('button', { name: 'Mostrar todas as solicitações' })
  await userEvent.setup().click(screen.getByRole('button', { name: 'Mostrar todas as solicitações' }))
  return screen.findByLabelText('Sua resposta')
}
const enviar = () => fireEvent.submit(screen.getByRole('button', { name: 'Enviar resposta' }).closest('form')!)
const escritas = () => chamadas.filter(c => c.method === 'POST')

test('padrao 7 dias mostra aviso de resposta fora do periodo e preserva escolha ao atualizar', async () => {
  montar()
  assert.equal((screen.getByLabelText('Período de utilização') as HTMLSelectElement).value, '7dias')
  await mostrar()
  assert.ok(within(screen.getByLabelText('Sua resposta').closest('form')!).getByText('Informe a quantidade de participantes.'))
  await userEvent.setup().selectOptions(screen.getByLabelText('Período de utilização'), '30dias')
  await userEvent.setup().click(screen.getByRole('button', { name: 'Atualizar' }))
  await screen.findByRole('button', { name: 'Mostrar todas as solicitações' })
  assert.equal((screen.getByLabelText('Período de utilização') as HTMLSelectElement).value, '30dias')
  assert.equal(escritas().length, 0)
})

test('complementacao envia POST unico e atualiza historico com estado retornado', async () => {
  responder = async () => { lista = [{ ...lista[0], status: 'Pendente', interacoes: lista[0].interacoes.map(i => ({ ...i, situacao: 'Respondida' })) }]; return Response.json(lista[0]) }
  montar(); await mostrar()
  await userEvent.setup().type(screen.getByLabelText('Sua resposta'), '  Serao doze participantes.  ')
  enviar(); fireEvent.submit(screen.getByLabelText('Sua resposta').closest('form')!)
  await waitFor(() => assert.ok(screen.queryByLabelText('Sua resposta') === null))
  assert.match(screen.getByRole('article').textContent!, /Pendente/)
  assert.deepEqual(escritas().map(c => [c.path, c.body]), [['/solicitacoes/41/complementacao/resposta', { mensagem: 'Serao doze participantes.' }]])
})
for (const aceita of [true, false]) test('proposta ' + (aceita ? 'aceita' : 'recusada') + ' usa contrato real e preserva microssegundos', async () => {
  lista = [pedido(true)]
  responder = async () => { lista = [{ ...lista[0], status: aceita ? 'Aprovado' : 'Pendente', interacoes: lista[0].interacoes.map(i => ({ ...i, situacao: aceita ? 'Aceita' : 'Recusada' })) }]; return Response.json(lista[0]) }
  montar(); await mostrar()
  assert.match(screen.getByRole('button', { name: 'Enviar resposta' }).closest('form')!.textContent!, /13:00:00\.123456/)
  await userEvent.setup().click(screen.getByRole('radio', { name: aceita ? 'Aceitar proposta' : 'Recusar proposta' }))
  await userEvent.setup().type(screen.getByLabelText('Sua resposta'), 'Resposta do aluno.')
  enviar()
  await waitFor(() => assert.ok(screen.queryByLabelText('Sua resposta') === null))
  assert.match(screen.getByRole('article').textContent!, aceita ? /Aprovado/ : /Pendente/)
  assert.deepEqual(escritas().map(c => [c.path, c.body]), [['/solicitacoes/41/propostas-replanejamento/17/resposta', { mensagem: 'Resposta do aluno.', aceita }]])
})
for (const codigo of [403, 409, 422]) test('HTTP ' + codigo + ' preserva resposta e nao repete POST', async () => {
  responder = async () => Response.json({ detail: 'Falha explicita' }, { status: codigo })
  montar(); await mostrar(); await userEvent.setup().type(screen.getByLabelText('Sua resposta'), 'Texto preservado')
  enviar(); await screen.findByText(new RegExp('HTTP ' + codigo))
  assert.equal(escritas().length, 1)
  assert.equal((screen.getByLabelText('Sua resposta') as HTMLTextAreaElement).value, 'Texto preservado')
  assert.equal(screen.getByRole('button', { name: 'Enviar resposta' }).hasAttribute('disabled'), false)
})
for (const falha of ['rede', '500', 'invalida']) test('resultado incerto ' + falha + ' persiste ao remontar e GET nao desbloqueia', async () => {
  responder = async () => {
    if (falha === 'rede') throw new TypeError('offline')
    return falha === '500' ? Response.json({ detail: 'Falha' }, { status: 500 }) : Response.json({ id: 41 })
  }
  const tela = montar(); await mostrar(); await userEvent.setup().type(screen.getByLabelText('Sua resposta'), 'Texto preservado')
  enviar(); await screen.findByText(/O resultado e desconhecido/)
  tela.unmount(); montar(); await mostrar()
  assert.equal((screen.getByLabelText('Sua resposta') as HTMLTextAreaElement).value, 'Texto preservado')
  await userEvent.setup().click(screen.getByRole('button', { name: 'Consultar estado' }))
  await screen.findByText(/nao libera reenvio/)
  assert.equal(screen.getByRole('button', { name: 'Enviar resposta' }).hasAttribute('disabled'), true)
  fireEvent.submit(screen.getByLabelText('Sua resposta').closest('form')!)
  assert.equal(escritas().length, 1)
})

test('troca de usuario oculta formulario e nao apresenta resposta antiga', async () => {
  let concluir!: (r: Response) => void
  responder = () => new Promise(resolve => { concluir = resolve })
  montar(); await mostrar(); await userEvent.setup().type(screen.getByLabelText('Sua resposta'), 'Resposta privada')
  enviar(); const antiga = lista[0]
  await act(async () => { lista = [antiga, { ...pedido(false, 42, 9), status: 'Pendente', interacoes: [] }]; sessionStorage.setItem('labagenda.usuario', JSON.stringify({ ...usuario, id: 9 })) })
  await waitFor(() => assert.ok(screen.queryByLabelText('Sua resposta') === null))
  await act(async () => { concluir(Response.json({ ...antiga, status: 'Pendente' })) })
  assert.equal(screen.queryByText('Resposta privada'), null)
  assert.equal(escritas().length, 1)
})

test('cartoes de decisao iniciam vazios e bloqueiam envio sem escolha inclusive por submit', async () => {
  lista = [pedido(true)]
  montar(); await mostrar()
  const grupo = screen.getByRole('group', { name: 'Decisão' })
  assert.equal(within(grupo).getAllByRole('radio').length, 2)
  assert.ok(within(grupo).getAllByRole('radio').every(r => !(r as HTMLInputElement).checked))
  await userEvent.setup().type(screen.getByLabelText('Sua resposta'), 'Resposta preservada')
  assert.ok(screen.getByRole('button', { name: 'Enviar resposta' }).hasAttribute('disabled'))
  enviar()
  assert.equal(escritas().length, 0)
  assert.equal(screen.queryByText(/O resultado e desconhecido/), null)
})

test('cartoes permitem selecao por teclado sem enviar e preservam decisao e texto ao remontar', async () => {
  lista = [pedido(true)]
  const tela = montar(); await mostrar()
  const user = userEvent.setup()
  const aceitar = screen.getByRole('radio', { name: 'Aceitar proposta' }) as HTMLInputElement
  const recusar = screen.getByRole('radio', { name: 'Recusar proposta' }) as HTMLInputElement
  aceitar.focus()
  await user.keyboard(' ')
  assert.ok(aceitar.checked)
  await user.keyboard('{ArrowRight}')
  assert.ok(recusar.checked)
  assert.equal(aceitar.checked, false)
  assert.ok(document.activeElement === recusar)
  await user.type(screen.getByLabelText('Sua resposta'), 'Preciso de outro dia.')
  assert.equal(screen.getByRole('button', { name: 'Enviar resposta' }).hasAttribute('disabled'), false)
  assert.equal(escritas().length, 0)
  tela.unmount(); montar(); await mostrar()
  assert.ok((screen.getByRole('radio', { name: 'Recusar proposta' }) as HTMLInputElement).checked)
  assert.equal((screen.getByLabelText('Sua resposta') as HTMLTextAreaElement).value, 'Preciso de outro dia.')
})

test('historico identifica autores conservadoramente, tipos, situacoes e instantes da API', async () => {
  const base = lista[0].interacoes[0]
  const instante = '2026-11-24T14:41:55.807047+00:00'
  lista[0].interacoes = [
    { ...base, data_criacao: instante },
    { ...base, id: 18, tipo: 'ComplementacaoRespondida', situacao: 'Respondida', id_usuario: 7, mensagem: 'Resposta do solicitante.\nSegunda linha.' },
    { ...base, id: 19, tipo: 'ComplementacaoRespondida', situacao: 'Respondida', id_usuario: 99, mensagem: 'Autoria sem papel confirmado.' },
  ]
  montar(); await mostrar()
  const user = userEvent.setup()
  const resumo = screen.getByText(/^Histórico da solicitação/).closest('summary')!
  resumo.focus(); assert.ok(document.activeElement === resumo)
  await user.click(resumo)
  const detalhes = resumo.closest('details')!
  assert.ok(detalhes.open)
  const itens = within(detalhes).getAllByRole('listitem')
  assert.equal(itens.length, 3)
  assert.ok(within(itens[0]).getByText('Gestão'))
  assert.ok(within(itens[0]).getByText('Pedido de complementação'))
  assert.ok(within(itens[0]).getByText('Situação: Aguardando resposta'))
  assert.ok(within(itens[1]).getByText('Solicitante'))
  assert.ok(within(itens[1]).getByText('Resposta à complementação'))
  assert.ok(within(itens[2]).getByText('Autor ID 99'))
  assert.ok(!itens[2].textContent!.includes('Gestão'))
  const data = itens[0].querySelector('time')!
  assert.equal(data.getAttribute('datetime'), instante)
  const esperado = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZoneName: 'short' }).format(new Date(instante))
  assert.equal(data.textContent, esperado)
  assert.equal(within(detalhes).queryByText(/Aprovação registrada|Rejeição registrada/), null)
  await user.click(resumo)
  assert.equal(detalhes.open, false)
  assert.equal(escritas().length, 0)
})

test('historico preserva horarios propostos com precisao', async () => {
  lista = [pedido(true)]
  montar(); await mostrar()
  const resumo = screen.getByText(/^Histórico da solicitação/).closest('summary')!
  await userEvent.setup().click(resumo)
  const detalhes = resumo.closest('details')!
  assert.ok(within(detalhes).getByText('Proposta de horário'))
  assert.match(detalhes.textContent!, /13:00:00\.123456/)
  assert.match(detalhes.textContent!, /14:00:00\.123456/)
  assert.equal(escritas().length, 0)
})
