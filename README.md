# LabAgenda — Frontend

Aplicação web para consulta e solicitação de uso de espaços acadêmicos, com acompanhamento pelo solicitante e análise pela gestão. O LabAgenda busca centralizar informações de disponibilidade e reduzir conflitos de utilização, substituindo controles dispersos por um fluxo de solicitação, resposta e decisão.

Este repositório contém uma SPA em React integrada a uma API FastAPI mantida separadamente. **Enviar uma solicitação não confirma uma reserva:** a aprovação depende das regras e permissões verificadas no backend.

Referência funcional desta documentação: branch `experimento/integracao-aluno-gestor`, commit `2b2e86eb379ba87fbd0c1eca282623640eed1979`. O deploy de produção ainda precisa ser configurado e validado.

## Funcionalidades

### Aluno / solicitante — perfil Membro

- Cadastro público, login e recuperação de sessão.
- Catálogo real com pesquisa e filtros; detalhes com descrição, localização, capacidade, recursos e funcionamento quando fornecidos pela API.
- Calendário e consulta de disponibilidade real, seleção de intervalo contínuo e validação de horários passados ou indisponíveis.
- Formulário de finalidade, revisão e envio autenticado da solicitação.
- Histórico de solicitações próprias, atualização manual, filtros por status e período e ordenação por utilização.
- Período inicial de próximos 7 dias; aviso para solicitações que exigem resposta e estão ocultas pelos filtros.
- Resposta a pedidos de complementação e aceite/recusa de propostas de horário.
- Histórico de interações com identificação conservadora de autoria, tipo, situação e data/hora.
- Preservação de rascunhos e proteções contra envios duplicados e resultados inconclusivos.

### Gestor

O painel `/admin` atende Administrador e coordenador autorizado por vínculo com espaço, conforme o backend. Um perfil Membro comum não recebe acesso administrativo apenas por navegar até a URL.

- Aba **Aprovações**: consulta e filtros de solicitações, aprovação/rejeição com justificativa, pedido de complementação e proposta de novo horário.
- Aba **Agenda**: consulta de reservas confirmadas por espaço e período.
- Aba **Laboratórios**: consulta, cadastro, edição, disponibilidade, funcionamento e vínculos de responsáveis, respeitando as permissões de cada operação.
- Estados de carregamento, falha e acesso negado; revalidação de autorização e isolamento entre contas.

A API é a autoridade final para autorização, conflitos e transições de status. O frontend não substitui essas verificações.

### Recuperação de senha

A interface implementa solicitação e redefinição na rota `/recuperar-senha`; links com `?token=` abrem o formulário de nova senha. Depende de endpoints compatíveis, envio de e-mail e URL de retorno configurados no backend. A existência da tela não comprova funcionamento completo do e-mail no ambiente publicado.

## Tecnologias

| Tecnologia | Uso |
| --- | --- |
| React 19 e TypeScript | Interface, componentes e contratos tipados |
| React Router 7 | Rotas SPA com `BrowserRouter` |
| Vite 8 | Desenvolvimento e build estático |
| CSS próprio e CSS Modules | Estilos compartilhados e escopados; sem biblioteca de componentes de terceiros |
| Fetch API | Integração HTTP com a API |
| Node.js Test Runner, Testing Library, JSDOM e tsx | Testes unitários, de serviços e componentes |
| Playwright / Chromium | Testes E2E com mocks e cenários de simulador |

As versões instaláveis estão em `package.json`; `package-lock.json` fixa a árvore reproduzível de dependências. FastAPI e PostgreSQL pertencem ao backend, não são executados pelo frontend.

## Arquitetura e integração

As páginas combinam componentes de apresentação com hooks de carregamento e serviços HTTP. Adaptadores em `src/data/` validam respostas e preparam os contratos utilizados pelo fluxo conectado.

```text
Navegador / React
  ├─ páginas, componentes e hooks
  └─ serviços HTTP
       ├─ desenvolvimento: origem Vite → proxy → API FastAPI
       └─ produção: API HTTPS ou proxy reverso explicitamente configurado
```

Principais integrações existentes:

| Finalidade | Endpoints utilizados |
| --- | --- |
| Autenticação e sessão | `POST /usuarios/login`, `GET /usuarios/me`, `POST /usuarios/refresh`, `POST /usuarios/logout` |
| Cadastro público | `POST /usuarios/` |
| Recuperação de senha | `POST /usuarios/recuperar-senha`, `POST /usuarios/redefinir-senha` |
| Catálogo e detalhes | `GET /espacos/`, `GET /espacos/{id}` |
| Disponibilidade | `GET /agendamentos/horarios-disponiveis` |
| Criação e histórico | `POST /solicitacoes/`, `GET /solicitacoes/`, `GET /solicitacoes/{id}` |
| Decisão do gestor | `PATCH /solicitacoes/{id}/decisao` |
| Interações | Rotas de complementação e propostas de replanejamento sob `/solicitacoes/{id}` |
| Agenda e gestão | `/agendamentos/`, `/espacos/` e subrotas de funcionamento e vínculos |

A disponibilidade é consultada em períodos de até 31 datas inclusivas. Datas de utilização e horários civis preservam a representação local da API, inclusive segundos e frações. Os instantes de criação das interações são exibidos com data, hora e indicação de fuso.

A criação do aluno envia `id_espaco`, `finalidade` e `horarios`, sem o campo legado `tipo`. O histórico mantém os seis status conhecidos: Pendente, Aprovado, Rejeitado, Cancelada, AguardandoComplementacao e AguardandoRespostaProposta.

O access token e a identificação da sessão são gerenciados pelo módulo de autenticação; a renovação depende do cookie HTTP configurado pela API. Leituras podem renovar a sessão de forma limitada. Escritas não são repetidas automaticamente após erro ou renovação. Registros de tentativas inconclusivas permanecem bloqueados; consultar o estado não comprova, por si só, o resultado da tentativa nem libera reenvio.

## Pré-requisitos

- Git e npm.
- Node.js compatível com o campo `engines`:

  ```text
  ^22.22.2 || ^24.15.0 || >=26.0.0
  ```

- API acessível e compatível para o modo conectado, com origens, hosts e cookies configurados.
- Para E2E, Chromium compatível com a versão instalada do Playwright.

A validação local anterior utilizou Node 24.14.0, abaixo da faixa declarada para Node 24. Apesar dos resultados aprovados, utilize uma versão compatível na reprodução e no deploy. Nenhuma versão do npm está fixada pelo projeto.

## Instalação e execução local

Para uma nova cópia:

```bash
git clone --branch experimento/integracao-aluno-gestor https://github.com/davidsonaguiar/agendamento_espacos_front.git
cd agendamento_espacos_front
npm ci
```

Se o repositório já estiver disponível, execute os comandos no diretório correto e preserve alterações locais. `npm ci` utiliza o lockfile e substitui o conteúdo de `node_modules`; não é necessário atualizar versões para executar o projeto.

Copie `.env.example` para `.env.local` quando este ainda não existir. Exemplo em PowerShell:

```powershell
Copy-Item .env.example .env.local
```

Ajuste o arquivo para a API desejada. Exemplo de desenvolvimento com API local na porta 8001:

```dotenv
VITE_LOCAL_SIMULATOR=false
VITE_API_URL=http://localhost:5173
API_PROXY_TARGET=http://127.0.0.1:8001
```

Inicie o frontend:

```bash
npm run dev
```

Abra `http://localhost:5173/login`. A configuração usa porta estrita: se 5173 estiver ocupada, a inicialização falha em vez de escolher outra porta silenciosamente. O backend precisa estar disponível separadamente; os comandos acima não criam banco, contas ou serviços da API.

Para usar outra origem/porta, mantenha `VITE_API_URL` igual à origem efetiva do Vite. Exemplo temporário em PowerShell, para uma porta livre:

```powershell
$env:VITE_LOCAL_SIMULATOR = 'false'
$env:VITE_API_URL = 'http://127.0.0.1:5185'
$env:API_PROXY_TARGET = 'http://127.0.0.1:8001'
npm run dev -- --host 127.0.0.1 --port 5185
```

Para encerrar o servidor iniciado nesse terminal, use `Ctrl+C`. Não encerre outros processos ou serviços para liberar uma porta sem identificar seu responsável.

## Variáveis de ambiente

| Variável | Significado |
| --- | --- |
| `VITE_API_URL` | URL HTTP(S) absoluta usada pelo navegador como base da API. No desenvolvimento com proxy, corresponde à origem do Vite. Não aceita apenas `/api`. |
| `API_PROXY_TARGET` | Destino do proxy do servidor de desenvolvimento. O padrão no código é `http://localhost:8000`; ajuste explicitamente para o ambiente pretendido. |
| `VITE_LOCAL_SIMULATOR` | Somente o valor `true`, em desenvolvimento, ativa o simulador local. Use `false` no modo conectado e no deploy. |
| `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` | Opcional, apenas para testes: caminho de um Chromium existente compatível. |

Variáveis `VITE_*` são incorporadas ao código do cliente; não coloque nelas senhas, tokens, chaves JWT ou credenciais de banco. `.env.local` é ignorado pelo Git. Alterações de ambiente exigem reiniciar o Vite ou gerar novo build, conforme o caso.

**O proxy do Vite funciona somente em `npm run dev`.** `API_PROXY_TARGET` não configura proxy no conteúdo de `dist/`, no `npm run preview` nem na Vercel.

## Modo conectado e simulador

| Modo | Comportamento |
| --- | --- |
| Conectado | Usa autenticação, catálogo, disponibilidade, solicitações e gestão da API configurada. Operações podem persistir dados reais no ambiente alvo. |
| Simulador local | Disponível apenas com `import.meta.env.DEV` e `VITE_LOCAL_SIMULATOR=true`. Possui autenticação fictícia e armazenamento local separado. Não comprova regras ou persistência do backend. |

O login sinaliza quando o simulador está ativo. Os módulos locais ficam em `sessaoSimulada.ts`, `simuladorLocal.ts` e `src/admin/`. Há componentes e dados demonstrativos preservados, mas **o fluxo completo do simulador não está validado na composição atual**: existe falha E2E relatada e rotas do aluno ainda podem alcançar serviços conectados. A Agenda e a gestão de laboratórios apresentam limitações explícitas nesse modo.

Para inspecionar o simulador, utilize uma origem/porta separada, dados fictícios e um destino de proxy fechado, sem backend real. Não utilize credenciais reais nem trate dados locais como homologação. O modo conectado é a referência funcional desta entrega.

## Rotas

| Rota | Acesso / conteúdo |
| --- | --- |
| `/login` | Público: autenticação |
| `/cadastro` | Público: cadastro de Membro |
| `/recuperar-senha` | Público: solicitação e redefinição de senha |
| `/` | Autenticado: catálogo |
| `/laboratorios/:id` | Autenticado: detalhes reais do espaço |
| `/laboratorios/:id/agendamento` | Autenticado: calendário e seleção |
| `/laboratorios/:id/agendamento/detalhes` | Autenticado: formulário, revisão e confirmação |
| `/meus-agendamentos` | Autenticado: solicitações próprias e respostas |
| `/admin` | Autenticado e autorizado: painel do gestor |

A seleção de data e intervalo utiliza a query string. Finalidade e rascunho não são incluídos na URL. Acesso a uma rota não concede autorização para operar recursos no backend.

## Estrutura principal

```text
src/
  pages/        Telas e composição das rotas
  components/   Componentes reutilizáveis, cartões e proteções de acesso
  hooks/        Sessão, carregamento, disponibilidade, histórico e envio
  services/     HTTP, autenticação e integração com a API
  data/         Validação, adaptação e apresentação; também contém fixtures legadas
  types/        Contratos tipados e modelos de apresentação
  gestao/       Fila, agenda e gestão conectada de espaços
  admin/        Componentes e dados locais do simulador
  styles/       Estilos compartilhados; outros estilos usam CSS Modules
  App.tsx       Declaração das rotas
  main.tsx      Inicialização React e BrowserRouter
tests/          Testes unitários, serviços e componentes
tests/e2e/      Cenários Playwright
docs/           Registros técnicos e de integração
```

## Testes e verificações

Comandos existentes em `package.json`:

| Comando | Escopo |
| --- | --- |
| `npm test` | Unitários/serviços e, depois, componentes |
| `npm run test:unit` | Arquivos `tests/*.test.mjs` |
| `npm run test:components` | Arquivos `tests/*.test.tsx`, com o loader JSDOM |
| `npm run typecheck` | Aplicação, configuração Vite e seleção de arquivos de teste definida no script |
| `npm run typecheck:tests` | Verificação dos testes explicitamente listados no script |
| `npm run build` | Compilação TypeScript e build de produção em `dist/` |
| `npm run preview` | Inspeção local do build estático, sem proxy da API |
| `npm run test:e2e` | Playwright; inicia dois servidores Vite e Chromium |
| `npm run check` | Testes, TypeScript, build e E2E; inclui servidores e navegador |

Para notebooks com pouca memória, execute os dois grupos abaixo **um após o outro**. As opções limitam a memória do Node e o paralelismo entre arquivos:

```bash
node --max-old-space-size=640 --test --test-concurrency=1 tests/*.test.mjs
node --max-old-space-size=640 --import ./tests/register-dom.mjs --test --test-concurrency=1 tests/*.test.tsx
npm run typecheck
npm run build
git diff --check
```

Os testes de serviços e componentes utilizam mocks. Não troque esses mocks por uma API real para executar testes automatizados.

### E2E

`playwright.config.ts` configura um worker e dois projetos: `api` em 4173, com cenários de rede simulada, e `simulador` em 4174. As duas portas devem estar livres; os servidores existentes não são reutilizados.

Se necessário, instale o navegador de teste separadamente:

```bash
npx playwright install chromium
```

Antes de executar E2E, bloqueie o destino de requisições não mockadas para que não alcancem a API real. Em um terminal PowerShell separado, usando como exemplo a porta local 1, que deve estar fechada:

```powershell
$env:API_PROXY_TARGET = 'http://127.0.0.1:1'
npm run test:e2e
```

Esse destino é deliberadamente indisponível: chamadas não interceptadas devem falhar, não alcançar um banco real. Não execute a suíte deixando o proxy apontado para homologação ou produção.

### Evidências e limites da validação

Na validação anterior da versão funcional de referência, foram aprovados **264 testes unitários/de serviços e 162 de componentes, totalizando 426**, além de TypeScript, build e `git diff --check`. Esses resultados não representam uma execução realizada durante a escrita deste README.

A suíte E2E **não está declarada integralmente aprovada**. Existe uma falha relatada associada ao simulador; sua causa atual e o resultado da suíte completa precisam ser confirmados. A revisão visual e a homologação completa da composição publicada também não são substituídas pelos testes com mocks.

## Deploy preliminar na Vercel

**Procedimento proposto; deploy ainda não concluído.** O frontend gera arquivos estáticos. A API FastAPI, o banco e o envio de e-mail precisam de infraestrutura e configuração próprias.

1. Importar o repositório e confirmar explicitamente a branch a publicar.
2. Selecionar o preset **Vite**, instalação `npm ci`, build `npm run build` e saída `dist`.
3. Utilizar uma versão de Node disponível na plataforma que satisfaça `engines`.
4. Configurar as variáveis públicas para cada ambiente de Preview/Production antes do build. Alterar variáveis exige novo deploy.
5. Escolher a integração: API HTTPS direta com CORS, ou proxy reverso explícito na mesma origem do frontend.
6. Configurar fallback SPA para acessos diretos e recargas de `/meus-agendamentos`, `/admin` e demais rotas.
7. Validar login, renovação, permissões, navegação direta e fluxo completo em um ambiente isolado antes de liberar o uso.

Exemplo seguro de variáveis para uma **API HTTPS direta**, com domínio ilustrativo:

```dotenv
VITE_API_URL=https://api.example.org
VITE_LOCAL_SIMULATOR=false
```

A API deve permitir a origem exata do frontend e requisições com credenciais. Cookies de renovação precisam de configuração compatível com HTTPS e com a relação entre os domínios; em contexto cross-site, avaliar `SameSite=None; Secure` e as políticas de cookies de terceiros do navegador. Nunca publique uma URL de `localhost` como API de produção.

Para API direta, o fallback SPA pode ser configurado futuramente em `vercel.json` com o exemplo abaixo. **O arquivo não foi criado nesta etapa:**

```json
{
  "rewrites": [
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```

Se a opção for proxy reverso na mesma origem, configurar os prefixos `/usuarios`, `/espacos`, `/projetos`, `/solicitacoes` e `/agendamentos` **antes** do fallback SPA, incluindo cookies e respostas de erro. Apenas definir `API_PROXY_TARGET` na Vercel não implementa esse proxy.

Referências oficiais: [Vite na Vercel](https://vercel.com/docs/frameworks/frontend/vite), [variáveis de ambiente](https://vercel.com/docs/environment-variables) e [rewrites](https://vercel.com/docs/routing/rewrites).

## Limitações e dependências conhecidas

- Recuperação de senha depende da versão publicada da API, do serviço de e-mail e da URL de retorno; confirmar o fluxo completo no ambiente de entrega.
- O simulador não oferece paridade completa com o modo conectado; há uma falha E2E relatada ainda pendente de confirmação da causa atual.
- Resultados inconclusivos de escritas permanecem bloqueados. Não há reconciliação automática nem idempotência por operação no backend revisado. Não limpar armazenamento para forçar reenvio.
- Segundo confirmação do responsável pelo backend, as duas correções de decisão e concorrência foram incorporadas à branch `dev`: bloqueio restrito com `with_for_update(of=SolicitacaoModelo)` e atualização do estado ORM com `populate_existing()`. A API de entrega deve utilizar uma versão que contenha essas correções; sua implantação e as configurações de produção ainda precisam ser validadas. Publicar este frontend não publica o backend.
- O backend exige propostas em intervalos de uma hora iniciados em hora cheia. Há um relato de HTTP 422 ainda dependente da inspeção do payload efetivamente enviado.
- Quantidade de participantes por solicitação não foi implementada; a capacidade exibida não representa validação desse total.
- O novo visual do histórico foi aplicado ao aluno; o histórico do gestor mantém a apresentação anterior.
- Alguns documentos em `docs/` e `DECISOES_TECNICAS.md` registram etapas anteriores, com descrições demonstrativas, contagens antigas e estados já superados. São registros históricos, não garantia do comportamento atual.
- Os filtros temporais são decisões de implementação do MVP, não requisitos formalmente confirmados pelo professor.

## Documentação relacionada

- [Integração de autenticação](docs/login.md)
- [Disponibilidade e calendário](docs/integracao-disponibilidade-i05-d3.md)
- [Criação de solicitações](docs/integracao-solicitacao-i05-d4.md)
- [Histórico real](docs/integracao-minhas-solicitacoes-i05-d5b.md)
- [Filtros temporais](docs/integracao-minhas-solicitacoes-i05-d5c.md)
- [Decisões técnicas históricas](DECISOES_TECNICAS.md)
- [Backend — davidsonaguiar/agendamento_espacos](https://github.com/davidsonaguiar/agendamento_espacos)

## Autoria e contexto acadêmico

Projeto acadêmico desenvolvido colaborativamente para gerenciamento e agendamento de espaços acadêmicos. A autoria técnica está registrada no [histórico de contribuições do repositório](https://github.com/davidsonaguiar/agendamento_espacos_front/commits/experimento/integracao-aluno-gestor).

A lista nominal de autores, a instituição, o curso, a disciplina e o docente devem ser confirmados pela equipe antes da versão final da entrega. Esses dados não foram presumidos a partir de contas Git, exemplos de interface ou fixtures.
