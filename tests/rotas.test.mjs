import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFile } from 'node:fs/promises'
import { transformWithOxc } from 'vite'
import { createRoutesFromChildren, matchRoutes } from 'react-router-dom'

// Compila App.tsx real. Somente as telas e o guard são substituídos por
// componentes vazios: verifica a árvore de rotas, não simula autenticação.
let fonte = await readFile(new URL('../src/App.tsx', import.meta.url), 'utf8')
fonte = fonte.replace(/import \{ ([\w, ]+) \} from '\.\/(?:pages|components)\/[^']+'/g,
  (_importacao, nomes) => nomes.split(',').map(nome => `function ${nome.trim()}() { return null }`).join('\n'))
const resultado = await transformWithOxc(fonte, 'src/App.tsx', { jsx: { runtime: 'automatic' } })
const codigo = resultado.code.replace(/from ["'](react-router-dom|react\/jsx-runtime)["']/g,
  (_importacao, modulo) => `from '${import.meta.resolve(modulo)}'`)
const { default: App } = await import(`data:text/javascript;base64,${Buffer.from(codigo).toString('base64')}`)
const rotas = createRoutesFromChildren(App().props.children)

test('as cinco rotas de membro continuam no guard geral', () => {
  const guard = rotas.find(rota => rota.element?.type.name === 'RotaProtegida')
  assert.ok(guard)
  assert.deepEqual(guard.children.filter(rota => rota.path).map(rota => rota.path), [
    '/', '/laboratorios/:id', '/laboratorios/:id/agendamento',
    '/laboratorios/:id/agendamento/detalhes', '/meus-agendamentos',
  ])
  for (const caminho of ['/', '/laboratorios/1', '/laboratorios/1/agendamento',
    '/laboratorios/1/agendamento/detalhes', '/meus-agendamentos']) {
    assert.equal(matchRoutes(rotas, caminho)[0].route, guard)
  }
})
test('painel do gestor exige permissão de gestão dentro do guard de sessão', () => {
  const guard = rotas.find(rota => rota.element?.type.name === 'RotaProtegida')
  const rotaPerfil = guard?.children.find(rota => rota.element?.type.name === 'RotaPerfil')
  assert.ok(rotaPerfil)
  assert.deepEqual(rotaPerfil.children.map(rota => rota.path), ['/admin'])
  const correspondencias = matchRoutes(rotas, '/admin')
  assert.equal(correspondencias?.[0].route, guard)
  assert.equal(correspondencias?.[1].route, rotaPerfil)
  assert.equal(correspondencias?.[2].route.path, '/admin')
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
