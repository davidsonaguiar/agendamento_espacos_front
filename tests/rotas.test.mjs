import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFile } from 'node:fs/promises'
import { transformWithOxc } from 'vite'
import { createRoutesFromChildren, matchRoutes } from 'react-router-dom'

// Compila App.tsx real. Somente as telas e o guard são substituídos por
// componentes vazios: verifica a árvore de rotas, não simula autenticação.
let fonte = await readFile(new URL('../src/App.tsx', import.meta.url), 'utf8')
fonte = fonte.replace(/import \{ (\w+) \} from '\.\/(?:pages|components)\/[^']+'/g,
  (_importacao, nome) => `function ${nome}() { return null }`)
const resultado = await transformWithOxc(fonte, 'src/App.tsx', { jsx: { runtime: 'automatic' } })
const codigo = resultado.code.replace(/from ["'](react-router-dom|react\/jsx-runtime)["']/g,
  (_importacao, modulo) => `from '${import.meta.resolve(modulo)}'`)
const { default: App } = await import(`data:text/javascript;base64,${Buffer.from(codigo).toString('base64')}`)
const rotas = createRoutesFromChildren(App().props.children)

test('as cinco rotas pertencem ao mesmo guard RotaProtegida', () => {
  const guard = rotas.find(rota => rota.element?.type.name === 'RotaProtegida')
  assert.ok(guard)
  assert.deepEqual(guard.children.map(rota => rota.path), [
    '/', '/laboratorios/:id', '/laboratorios/:id/agendamento',
    '/laboratorios/:id/agendamento/detalhes', '/meus-agendamentos',
  ])
  for (const caminho of ['/', '/laboratorios/1', '/laboratorios/1/agendamento',
    '/laboratorios/1/agendamento/detalhes', '/meus-agendamentos']) {
    assert.equal(matchRoutes(rotas, caminho)[0].route, guard)
  }
})
test('login, cadastro e recuperação permanecem públicos', () => {
  for (const caminho of ['/login', '/cadastro', '/recuperar-senha']) {
    const correspondencias = matchRoutes(rotas, caminho)
    assert.equal(correspondencias.length, 1)
    assert.equal(correspondencias[0].route.path, caminho)
  }
})
test('caminho desconhecido mantém redirecionamento para início', () => {
  const [correspondencia] = matchRoutes(rotas, '/nao-existe')
  assert.equal(correspondencia.route.path, '*')
  assert.equal(correspondencia.route.element.props.to, '/')
  assert.equal(correspondencia.route.element.props.replace, true)
})
