import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFile } from 'node:fs/promises'
import { transformWithOxc } from 'vite'
import { createRoutesFromChildren, matchRoutes } from 'react-router-dom'

// Compila App.tsx real. Somente as telas e o guard são substituídos por
// componentes vazios: verifica a árvore de rotas, não simula autenticação.
let fonte = await readFile(new URL('../src/App.tsx', import.meta.url), 'utf8')
fonte = fonte.replace("import './styles/logout.css'", '')
fonte = fonte.replace(/import \{ ([\w, ]+) \} from '\.\/(?:pages|components)\/[^']+'/g,
  (_importacao, nomes) => nomes.split(',').map(nome => `function ${nome.trim()}() { return null }`).join('\n'))
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

// Executor isolado do ciclo useState/useEffect: sem DOM, navegador ou pacotes novos.
// Exercita o código real com fronteiras de autenticação/transporte controladas.
let executorIdB3 = 0
async function executarHooksB3(caminho, nome, modulos) {
  const chave = `__labagendaHooksB3_${++executorIdB3}`
  const estados = [], efeitos = [], timers = new Map()
  let indiceEstado = 0, indiceEfeito = 0, montado = true, agendado = false, renderizar
  const ambiente = { modulos, window: new EventTarget() }
  ambiente.setTimeout = (callback, atraso) => { const id = {}; timers.set(id, { callback, atraso }); return id }
  ambiente.clearTimeout = id => timers.delete(id)
  ambiente.modulos.react = {
    useState(inicial) {
      const indice = indiceEstado++
      if (!(indice in estados)) estados[indice] = inicial
      return [estados[indice], valor => {
        if (!montado) throw Error('Atualização após desmontagem')
        const proximo = typeof valor === 'function' ? valor(estados[indice]) : valor
        if (Object.is(estados[indice], proximo)) return
        estados[indice] = proximo
        if (!agendado) {
          agendado = true
          queueMicrotask(() => { agendado = false; if (montado) renderizar() })
        }
      }]
    },
    useRef(inicial) {
      const indice = indiceEstado++
      if (!(indice in estados)) estados[indice] = { current: inicial }
      return estados[indice]
    },
    useEffect(callback, deps) {
      const indice = indiceEfeito++
      const anterior = efeitos[indice]
      if (!anterior || deps.some((valor, i) => !Object.is(valor, anterior.deps[i]))) {
        anterior?.limpar?.()
        efeitos[indice] = { deps, callback, pendente: true }
      }
    },
  }
  globalThis[chave] = ambiente
  const fonte = await readFile(new URL(caminho, import.meta.url), 'utf8')
  let codigo = (await transformWithOxc(fonte, caminho, { jsx: { runtime: 'automatic' } })).code
  codigo = codigo.replace(/from\s*["']([^"']+)["']/g, (_trecho, referencia) => {
    const mock = ambiente.modulos[referencia]
    if (!mock) return `from '${import.meta.resolve(referencia)}'`
    const exports = Object.keys(mock).map(nome => `export const ${nome} = globalThis['${chave}'].modulos[${JSON.stringify(referencia)}].${nome}`).join('\n')
    return `from 'data:text/javascript;base64,${Buffer.from(exports).toString('base64')}'`
  })
  codigo = `const window = globalThis['${chave}'].window; const setTimeout = globalThis['${chave}'].setTimeout; const clearTimeout = globalThis['${chave}'].clearTimeout;\n` + codigo
  const moduloTela = await import(`data:text/javascript;base64,${Buffer.from(codigo).toString('base64')}`)
  const componente = moduloTela[nome]
  const controle = {
    atual: null, exports: moduloTela, timers, eventos: ambiente.window,
    render() { renderizar() },
    desmontar() { montado = false; efeitos.forEach(efeito => efeito.limpar?.()); delete globalThis[chave] },
    async flush() { await new Promise(resolve => setImmediate(resolve)) },
  }
  renderizar = () => {
    indiceEstado = 0; indiceEfeito = 0
    controle.atual = componente()
    efeitos.forEach(efeito => {
      if (efeito.pendente) { efeito.pendente = false; efeito.limpar = efeito.callback() }
    })
  }
  renderizar()
  return controle
}

async function montarGuardB3(t, verificar) {
  const local = { pathname: '/laboratorios/77', search: '?origem=catalogo' }
  const guard = await executarHooksB3('../src/components/RotaProtegida.tsx', 'RotaProtegida', {
    'react-router-dom': { Link: () => null, useLocation: () => local, Navigate: function Navigate() {}, Outlet: function Outlet() {} },
    '../services/autenticacao': { verificarSessao: verificar, obterTokenAcesso: () => 'token', obterExpiracaoToken: () => Date.now() + 90_000 },
  })
  t.after(() => guard.desmontar())
  return { guard, local }
}
test('guard válido autoriza e agenda renovação antes do vencimento', async t => {
  let chamadas = 0
  const { guard } = await montarGuardB3(t, async () => { chamadas++; return { id: 1 } })
  await guard.flush()
  assert.equal(guard.atual.type.name, 'Outlet')
  assert.equal(chamadas, 1)
  const timer = [...guard.timers.values()][0]
  assert.ok(timer.atraso >= 59_000 && timer.atraso <= 60_000)
  timer.callback()
  await guard.flush()
  assert.equal(chamadas, 2)
  assert.equal(guard.atual.type.name, 'Outlet')
})
test('guard aguarda recuperação de sessão sem redirecionar prematuramente', async t => {
  let liberar
  const { guard } = await montarGuardB3(t, () => new Promise(resolve => { liberar = resolve }))
  assert.equal(guard.atual.props.role, 'status')
  liberar({ id: 1 })
  await guard.flush()
  assert.equal(guard.atual.type.name, 'Outlet')
})
test('guard inválido preserva destino e query sem loop', async t => {
  let chamadas = 0
  const { guard } = await montarGuardB3(t, async () => { chamadas++; return null })
  await guard.flush()
  assert.equal(guard.atual.type.name, 'Navigate')
  assert.equal(guard.atual.props.to, '/login')
  assert.equal(guard.atual.props.replace, true)
  assert.equal(guard.atual.props.state.destino, '/laboratorios/77?origem=catalogo')
  guard.render()
  assert.equal(chamadas, 1)
})
test('guard offline mostra erro e permite nova tentativa sem redirecionar', async t => {
  let chamadas = 0
  const { guard } = await montarGuardB3(t, async () => { if (++chamadas === 1) throw Error('offline'); return { id: 1 } })
  await guard.flush()
  assert.equal(guard.atual.props.role, 'alert')
  guard.atual.props.children[2].props.onClick()
  await guard.flush()
  assert.equal(guard.atual.type.name, 'Outlet')
})
test('guard não atualiza após desmontagem e remove listener e timer', async t => {
  let liberar, chamadas = 0
  const { guard } = await montarGuardB3(t, () => { chamadas++; return new Promise(resolve => { liberar = resolve }) })
  guard.desmontar()
  liberar({ id: 1 })
  await guard.flush()
  guard.eventos.dispatchEvent(new Event('focus'))
  assert.equal(chamadas, 1)
  assert.equal(guard.timers.size, 0)
})
test('guard coalesce foco concorrente e revalida quando foco retorna', async t => {
  let liberar, chamadas = 0
  const { guard } = await montarGuardB3(t, () => { chamadas++; return new Promise(resolve => { liberar = resolve }) })
  guard.eventos.dispatchEvent(new Event('focus'))
  guard.eventos.dispatchEvent(new Event('focus'))
  assert.equal(chamadas, 1)
  liberar({ id: 1 })
  await guard.flush()
  guard.eventos.dispatchEvent(new Event('focus'))
  assert.equal(chamadas, 2)
  liberar(null)
  await guard.flush()
  assert.equal(guard.atual.type.name, 'Navigate')
})

function elementosB4(raiz, predicado) {
  const encontrados = []
  function visitar(no) {
    if (Array.isArray(no)) return no.forEach(visitar)
    if (!no || typeof no !== 'object') return
    if (predicado(no)) encontrados.push(no)
    visitar(no.props?.children)
  }
  visitar(raiz)
  return encontrados
}
const eventoSubmitB4 = { preventDefault() {} }
const roteadorB4 = (state, navegacoes) => {
  const navegar = (destino, opcoes) => navegacoes.push({ destino, opcoes })
  return { Link: function Link() {}, NavLink: function NavLink() {}, useNavigate: () => navegar,
    useLocation: () => ({ pathname: '/', state }) }
}
async function montarLoginB4(t, state = {}, auth = {}) {
  const navegacoes = []
  const tela = await executarHooksB3('../src/pages/Login.tsx', 'Login', {
    'react-router-dom': roteadorB4(state, navegacoes),
    '../components/LayoutAutenticacao': { LayoutAutenticacao: function LayoutAutenticacao() {} },
    '../services/autenticacao': { autenticarUsuario: async () => {}, desconectarUsuario: async () => {}, ...auth },
  })
  t.after(() => tela.desmontar())
  return { tela, navegacoes }
}
async function preencherLoginB4(tela) {
  elementosB4(tela.atual, no => no.type === 'input' && no.props.name === 'identificacao')[0].props.onChange({ target: { value: ' membro@example.com ' } })
  elementosB4(tela.atual, no => no.type === 'input' && no.props.name === 'senha')[0].props.onChange({ target: { value: ' senha ' } })
  await tela.flush()
}

test('rotas preservam catálogo real, detalhes por ID e bloqueio de agendamento', async () => {
  const app = await readFile(new URL('../src/App.tsx', import.meta.url), 'utf8')
  assert.match(app, /return <DetalhesEspacoIntegrado id=\{id\} \/>/)
  assert.match(app, /return <AgendamentoIntegracaoPendente \/>/)
  assert.doesNotMatch(app, /from '.\/pages\/(DetalhesLaboratorio|SolicitacaoAgendamento|DetalhesSolicitacao)'/)
  const guard = rotas.find(rota => rota.element?.type.name === 'RotaProtegida')
  assert.equal(guard.children.find(rota => rota.path === '/').element.type.name, 'CatalogoLaboratorios')
  assert.equal(guard.children.find(rota => rota.path === '/meus-agendamentos').element.type.name, 'MeusAgendamentos')
})
test('destino aceita somente rotas internas protegidas e preserva query e fragmento', async t => {
  const { tela } = await montarLoginB4(t)
  const destino = tela.exports.destinoAposLogin
  for (const caminho of ['/', '/meus-agendamentos?status=Pendente', '/laboratorios/77?busca=impressora%203D#recursos', '/laboratorios/77/agendamento?mes=2026-11', '/laboratorios/77/agendamento/detalhes?inicio=09%3A00']) {
    assert.equal(destino(caminho), caminho)
  }
  for (const caminho of [null, 42, {}, 'https://externo.test', '//externo.test', '/\\externo.test', '/%2f%2fexterno.test', '/%5cexterno.test', '/\n/externo.test', '/login?destino=/login', '/cadastro', '/recuperar-senha', '/nao-existe', ' /meus-agendamentos', '/laboratorios/1/../../login']) {
    assert.equal(destino(caminho), '/')
  }
})
test('login usa serviço renovável e retorna à agenda com query após sucesso', async t => {
  const chamadas = []
  const { tela, navegacoes } = await montarLoginB4(t, { destino: '/meus-agendamentos?status=Aprovado' }, {
    autenticarUsuario: async (...dados) => chamadas.push(dados),
  })
  await preencherLoginB4(tela)
  await elementosB4(tela.atual, no => no.type === 'form')[0].props.onSubmit(eventoSubmitB4)
  await tela.flush()
  assert.deepEqual(chamadas, [['membro@example.com', ' senha ']])
  assert.deepEqual(navegacoes, [{ destino: '/meus-agendamentos?status=Aprovado', opcoes: { replace: true } }])
})
test('login exibe erro e carregamento sem navegar por falha de autenticação', async t => {
  let rejeitar
  const { tela, navegacoes } = await montarLoginB4(t, {}, {
    autenticarUsuario: () => new Promise((_resolve, reject) => { rejeitar = reject }),
  })
  await preencherLoginB4(tela)
  const envio = elementosB4(tela.atual, no => no.type === 'form')[0].props.onSubmit(eventoSubmitB4)
  await tela.flush()
  assert.equal(elementosB4(tela.atual, no => no.type === 'button' && no.props.type === 'submit')[0].props.disabled, true)
  rejeitar(Error('Credenciais inválidas'))
  await envio
  await tela.flush()
  assert.equal(navegacoes.length, 0)
  assert.equal(elementosB4(tela.atual, no => no.props?.role === 'alert')[0].props.children, 'Credenciais inválidas')
})
test('login permite nova tentativa de revogação após logout offline', async t => {
  let chamadas = 0
  const { tela, navegacoes } = await montarLoginB4(t, { logoutPendente: true }, { desconectarUsuario: async () => { chamadas++ } })
  elementosB4(tela.atual, no => no.type === 'button' && no.props.type === 'button')[0].props.onClick()
  await tela.flush()
  assert.equal(chamadas, 1)
  assert.equal(navegacoes[0].opcoes.state.aviso, 'Sessão encerrada.')
})
test('cadastro apresenta Membro, valida confirmação e envia CPF normalizado', async t => {
  const navegacoes = [], cadastros = []
  const tela = await executarHooksB3('../src/pages/CadastroServidor.tsx', 'CadastroServidor', {
    'react-router-dom': roteadorB4({}, navegacoes),
    '../components/LayoutAutenticacao': { LayoutAutenticacao: function LayoutAutenticacao() {} },
    '../services/autenticacao': { cadastrarMembro: async dados => cadastros.push(dados) },
  })
  t.after(() => tela.desmontar())
  const valores = ['Ana Teste', '123.456.789-01', 'MAT123', 'ana@example.com', 'SenhaValida123!', 'outra']
  elementosB4(tela.atual, no => no.type === 'input').forEach((input, indice) => input.props.onChange({ target: { value: valores[indice] } }))
  await tela.flush()
  await elementosB4(tela.atual, no => no.type === 'form')[0].props.onSubmit(eventoSubmitB4)
  await tela.flush()
  assert.equal(cadastros.length, 0)
  assert.equal(elementosB4(tela.atual, no => no.props?.role === 'alert')[0].props.children, 'As senhas não coincidem.')
  elementosB4(tela.atual, no => no.type === 'input').at(-1).props.onChange({ target: { value: 'SenhaValida123!' } })
  await tela.flush()
  await elementosB4(tela.atual, no => no.type === 'form')[0].props.onSubmit(eventoSubmitB4)
  assert.deepEqual(cadastros[0], { nome_completo: 'Ana Teste', cpf: '12345678901', vinculo_institucional: 'MAT123', email: 'ana@example.com', senha: 'SenhaValida123!' })
  assert.equal('perfil' in cadastros[0], false)
  assert.equal(navegacoes[0].destino, '/login')
})
for (const falha of [false, true]) {
  test(`cabeçalho identifica usuário e evita logout duplicado; falha=${falha}`, async t => {
    const navegacoes = []
    let chamadas = 0, concluir
    const tela = await executarHooksB3('../src/components/Cabecalho.tsx', 'Cabecalho', {
      'react-router-dom': roteadorB4({}, navegacoes),
      '../services/autenticacao': {
        obterUsuarioAutenticado: () => ({ nome_completo: 'Ana Teste', cpf: 'nao-exibir', email: 'nao-exibir@example.com' }),
        desconectarUsuario: () => { chamadas++; return new Promise((resolve, reject) => { concluir = () => falha ? reject(Error('offline')) : resolve() }) },
      },
    })
    t.after(() => tela.desmontar())
    const avatar = elementosB4(tela.atual, no => no.props?.className === 'user-avatar')[0]
    assert.equal(avatar.props.children, 'AT')
    assert.doesNotMatch(JSON.stringify(tela.atual), /nao-exibir/)
    const sair = elementosB4(tela.atual, no => no.type === 'button')[0].props.onClick
    sair(); sair()
    await tela.flush()
    assert.equal(chamadas, 1)
    assert.equal(elementosB4(tela.atual, no => no.type === 'button')[0].props.disabled, true)
    concluir()
    await tela.flush()
    assert.equal(navegacoes.length, 1)
    assert.equal(navegacoes[0].destino, '/login')
    assert.equal(navegacoes[0].opcoes.state.logoutPendente, falha)
    if (falha) assert.match(navegacoes[0].opcoes.state.aviso, /Não foi possível confirmar/)
  })
}


test('/admin possui guard dedicado que exige Administrador', () => {
  const matches = matchRoutes(rotas, '/admin')
  assert.equal(matches[0].route.element.type.name, 'RotaProtegida')
  assert.equal(matches[0].route.element.props.somenteAdministrador, true)
  assert.equal(matches[1].route.element.type.name, 'PainelAdmin')
})
