import assert from 'node:assert/strict'
import { test, beforeEach } from 'node:test'
import { readFile } from 'node:fs/promises'
import { stripTypeScriptTypes } from 'node:module'

// Exercita serviço e transporte HTTP reais com fetch simulado, sem tocar no backend.
const fonteHttp = (await readFile(new URL('../src/services/http.ts', import.meta.url), 'utf8'))
  .replace('import.meta.env.VITE_API_URL', JSON.stringify('http://localhost:5173'))
const httpDataUrl = `data:text/javascript;base64,${Buffer.from(stripTypeScriptTypes(fonteHttp)).toString('base64')}`
const fonte = (await readFile(new URL('../src/services/recuperacaoSenha.ts', import.meta.url), 'utf8'))
  .replace("from './http'", `from '${httpDataUrl}'`)
const api = await import(`data:text/javascript;base64,${Buffer.from(stripTypeScriptTypes(fonte)).toString('base64')}`)

beforeEach(() => { globalThis.fetch = () => { throw Error('fetch não configurado') } })

const resposta = (status, corpo) => new Response(corpo === undefined ? null : JSON.stringify(corpo), { status })

test('solicita recuperação por e-mail, sem enviar cookies e sem token de sessão', async () => {
  let chamadas = 0
  globalThis.fetch = async (url, opcoes) => {
    chamadas++
    assert.equal(url, 'http://localhost:5173/usuarios/recuperar-senha')
    assert.equal(opcoes.method, 'POST')
    assert.equal(opcoes.credentials, 'omit')
    assert.equal(opcoes.headers.get('Authorization'), null)
    assert.deepEqual(JSON.parse(opcoes.body), { email: 'membro@ifal.edu.br' })
    return resposta(202, { detail: 'Se o e-mail estiver cadastrado...' })
  }
  await api.solicitarRecuperacaoSenha(' membro@ifal.edu.br ')
  assert.equal(chamadas, 1)
})

test('não permite inferir contas inexistentes pela interface do serviço', async () => {
  globalThis.fetch = async () => resposta(202, { detail: 'Resposta genérica' })
  assert.equal(await api.solicitarRecuperacaoSenha('naoexiste@ifal.edu.br'), undefined)
})

test('redefine senha com token no JSON; aceita resposta vazia HTTP 204', async () => {
  const token = 't'.repeat(43)
  globalThis.fetch = async (url, opcoes) => {
    assert.equal(url, 'http://localhost:5173/usuarios/redefinir-senha')
    assert.equal(opcoes.method, 'POST')
    assert.deepEqual(JSON.parse(opcoes.body), { token, nova_senha: 'NovaSenha123!' })
    return resposta(204)
  }
  assert.equal(await api.redefinirSenha(token, 'NovaSenha123!'), undefined)
})

test('token inválido ou expirado mostra orientação sem revelar token', async () => {
  globalThis.fetch = async () => resposta(400, { detail: 'Link inválido' })
  await assert.rejects(api.redefinirSenha('t'.repeat(43), 'NovaSenha123!'), /Link de redefinição inválido ou expirado/)
})

test('API da branch dev sem endpoint retorna indisponibilidade, não falso sucesso', async () => {
  globalThis.fetch = async () => resposta(404, { detail: 'Not Found' })
  await assert.rejects(api.solicitarRecuperacaoSenha('membro@ifal.edu.br'), /ainda não está disponível nesta versão/)
})

test('erro de conexão é identificado corretamente', async () => {
  globalThis.fetch = async () => { throw new TypeError('Failed to fetch') }
  await assert.rejects(api.solicitarRecuperacaoSenha('membro@ifal.edu.br'), /conectar à API/)
})

test('resposta 200 de proxy não confirma pedido ou redefinição', async () => {
  globalThis.fetch = async () => resposta(200, {})
  await assert.rejects(api.solicitarRecuperacaoSenha('teste@example.com'), /Não foi possível/)
  await assert.rejects(api.redefinirSenha('t'.repeat(43), 'SenhaNova123!'), /Não foi possível/)
})

test('422 orienta corrigir o campo sem repetir detalhes sensíveis da API', async () => {
  globalThis.fetch = async () => resposta(422, { detail: 'detalhe interno' })
  await assert.rejects(api.solicitarRecuperacaoSenha('teste'), /Informe um e-mail válido/)
  await assert.rejects(api.redefinirSenha('t'.repeat(43), 'curta'), /Confira a nova senha/)
})
