import assert from 'node:assert/strict'
import { beforeEach, test } from 'node:test'
import { decidir, espacosGerenciados, listarAgenda } from '../src/gestao/api'

const usuario = { id: 7, perfil: 'Membro', nome_completo: 'Ana Colega', ativo: true,
  cpf: '11111111111', email: 'ana@example.com', vinculo_institucional: 'M123' }
const espaco = (id: number, papel = 'Monitor') => ({
  id, nome: 'Laboratório ' + id, descricao: null, capacidade: null, bloco: null, disponibilidade: true, horarios_funcionamento: [], usuarios_vinculados: [{ id_usuario: 7, perfil_espaco: papel }],
})
const json = (dados: unknown, status = 200) => new Response(JSON.stringify(dados), { status })

beforeEach(() => {
  sessionStorage.clear()
  sessionStorage.setItem('labagenda.usuario', JSON.stringify(usuario))
  sessionStorage.setItem('labagenda.access_token', 'antigo')
})

test('lê a segunda página de espaços e limita o coordenador aos próprios vínculos', async () => {
  const skips: string[] = []
  globalThis.fetch = async input => {
    const skip = new URL(String(input)).searchParams.get('skip')!
    skips.push(skip)
    return json(skip === '0' ? Array.from({ length: 100 }, (_, i) => espaco(i + 1)) : [espaco(101, 'Coordenador')])
  }
  const dados = await espacosGerenciados(7, 'Membro', new AbortController().signal)
  assert.deepEqual(skips, ['0', '100'])
  assert.deepEqual(dados.map(e => e.id), [101])
})

test('PATCH com 401 nao renova nem repete a decisao e propaga a falha', async () => {
  const chamadas: { caminho: string; metodo?: string }[] = []
  globalThis.fetch = async (input, opcoes) => {
    chamadas.push({ caminho: new URL(String(input)).pathname, metodo: opcoes?.method })
    assert.equal(new Headers(opcoes?.headers).get('authorization'), 'Bearer antigo')
    return json({ detail: 'Expirado' }, 401)
  }
  for (const [id, status] of [[1, 'Aprovado'], [2, 'Rejeitado']] as const) {
    await assert.rejects(decidir(id, status, 'Motivo de teste'), erro => {
      assert.equal((erro as { status?: number }).status, 401)
      return true
    })
    assert.equal(chamadas.filter(c => c.caminho === `/solicitacoes/${id}/decisao` && c.metodo === 'PATCH').length, 1)
  }
  assert.equal(chamadas.length, 2)
  assert.equal(chamadas.filter(c => c.caminho === '/usuarios/refresh').length, 0)
  assert.equal(sessionStorage.getItem('labagenda.access_token'), 'antigo')
})

test('conflitos, falta de permissão e falha de rede não repetem a mutação', async () => {
  for (const status of [403, 409, 0]) {
    let chamadas = 0
    globalThis.fetch = async () => {
      chamadas++
      if (!status) throw new Error('offline')
      return json({ detail: 'Operação recusada' }, status)
    }
    await assert.rejects(decidir(1, 'Aprovado', 'Motivo de teste'))
    assert.equal(chamadas, 1)
  }
})

test('agenda envia o período local e descarta reservas de outro espaço', async () => {
  globalThis.fetch = async input => {
    const params = new URL(String(input)).searchParams
    assert.equal(params.get('id_espaco'), '2')
    assert.equal(params.get('data_hora_inicio'), '2026-11-01T00:00:00')
    assert.equal(params.get('data_hora_fim'), '2026-12-01T00:00:00')
    return json([{ id: 4, id_espaco: 3 }, { id: 5, id_espaco: 2 }])
  }
  const dados = await listarAgenda(2, '2026-11-01', '2026-12-01', new AbortController().signal)
  assert.deepEqual(dados.map(r => r.id), [5])
})


test('se o refresh trocar a identidade, a decisão nunca é reenviada com a outra conta', async () => {
  let tentativas = 0
  globalThis.fetch = async input => {
    if (String(input).endsWith('/usuarios/refresh')) {
      return json({ access_token: 'outra-conta', token_type: 'bearer', usuario: { ...usuario, id: 25 } })
    }
    tentativas++
    return json({ detail: 'Expirado' }, 401)
  }
  await assert.rejects(decidir(1, 'Aprovado', 'Justificativa'))
  assert.equal(tentativas, 1)
})

test('paginação com IDs repetidos falha sem exibir acesso parcial', async () => {
  globalThis.fetch = async () => json(Array.from({ length: 100 }, () => espaco(12)))
  await assert.rejects(espacosGerenciados(7, 'Administrador', new AbortController().signal), /inconsistentes/)
})

test('resposta antiga não encerra a sessão enquanto o login restaura o cookie', async () => {
  let encerramentos = 0
  const evento = () => { encerramentos++ }
  window.addEventListener('labagenda:sessao-encerrada', evento)
  try {
    globalThis.fetch = async () => {
      sessionStorage.clear()
      return json([])
    }
    await assert.rejects(espacosGerenciados(7, 'Membro', new AbortController().signal))
    assert.equal(encerramentos, 0)
  } finally {
    window.removeEventListener('labagenda:sessao-encerrada', evento)
  }
})
