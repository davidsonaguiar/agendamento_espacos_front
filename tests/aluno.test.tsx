import assert from 'node:assert/strict'
import { beforeEach, test } from 'node:test'
import { minhasSolicitacoes, solicitar, terminosLivres } from '../src/services/agendamentoAluno'

const dia = '2099-06-15'
const dataHora = (hora: string) => dia + 'T' + hora + ':00'
const intervalo = (inicio: string, fim: string) => ({ data_hora_inicio: dataHora(inicio), data_hora_fim: dataHora(fim) })
const horarios = [intervalo('08:00', '09:00'), intervalo('09:00', '10:00'), intervalo('11:00', '12:00')]

beforeEach(() => {
  sessionStorage.clear()
  sessionStorage.setItem('labagenda.access_token', 'token')
  sessionStorage.setItem('labagenda.usuario', JSON.stringify({ id: 3, nome_completo: 'Ana', cpf: '12345678901',
    email: 'm@example.com', vinculo_institucional: 'M1', perfil: 'Membro', ativo: true }))
})

test('seleção permite encadear somente intervalos contíguos', () => {
  assert.deepEqual(terminosLivres(horarios, dataHora('08:00')), [dataHora('09:00'), dataHora('10:00')])
})

test('revalida o horário e envia apenas os campos aceitos pela API', async () => {
  const chamadas: string[] = []
  globalThis.fetch = async (url, opcoes) => {
    chamadas.push(new URL(String(url)).pathname)
    if (opcoes?.method !== 'POST') return Response.json(horarios)
    assert.deepEqual(JSON.parse(String(opcoes.body)), { id_espaco: 78, finalidade: 'Aula',
      horarios: [{ data_reserva: dia, hora_inicio: '08:00:00', hora_fim: '10:00:00' }] })
    return Response.json({ id: 25 }, { status: 201 })
  }
  assert.equal(await solicitar(78, ' Aula ', dataHora('08:00'), dataHora('10:00')), 25)
  assert.deepEqual(chamadas, ['/agendamentos/horarios-disponiveis', '/solicitacoes/'])
})

test('um intervalo que ficou ocupado não gera POST', async () => {
  globalThis.fetch = async (_url, opcoes) => {
    assert.equal(opcoes?.method, 'GET')
    return Response.json(horarios.slice(1))
  }
  await assert.rejects(solicitar(7, 'Aula', dataHora('08:00'), dataHora('10:00')), /já não está disponível/)
})

test('a agenda pessoal do coordenador mostra apenas seus pedidos', async () => {
  globalThis.fetch = async () => Response.json([{ id: 2, id_solicitante: 3 }, { id: 4, id_solicitante: 9 }])
  assert.deepEqual((await minhasSolicitacoes(3, new AbortController().signal)).map(s => s.id), [2])
})
