# Integração de login do PR #2 com D2–D5

Composição em preparação na branch `review/integracao-pr2-login`, a partir de
`9f61ad6`, com o PR #2 fixado em `ebaa705`. O merge permanece sem commit.
Não inclui alterações posteriores do Nicolas nem simulador local.

A composição preserva catálogo, detalhes, disponibilidade, criação sem repetição
automática, histórico real e filtros, além da restrição administrativa e das
validações de destino/cadastro. Incorpora recuperação/redefinição de senha,
responsividade e revalidação ao retornar à aba. O 401 atrasado de /usuarios/me
reutiliza um token já renovado, evitando outra rotação desnecessária.

As dependências fixadas são idênticas entre as pontas. Mantida a faixa local de
Node compatível com as ferramentas e o lockfile correspondente, sem instalação.
`npm run check` reúne testes, typecheck, build e E2E; os testes de navegador devem
usar mocks e proxy isolado. Typecheck inclui a nova suíte de responsividade.

Os registros abaixo são históricos das duas entregas, não comprovação de
homologação da composição. Referências a telas demonstrativas ou não integradas
nesses registros descrevem suas respectivas versões anteriores. A integração
atual passou nas validações automatizadas combinadas descritas abaixo; a
homologação real da composição permanece pendente, incluindo endpoints
publicados de recuperação, SMTP e URL_FRONTEND. Nenhuma escrita real foi
autorizada nesta composição.

## Validação automatizada desta composição

Executados nesta resolução, com HTTP simulado e sem operações reais no backend:

- `npm test`: 230 testes unitários e 87 de componentes aprovados (317 no total).
- `npm run typecheck`: aplicação, configuração e testes aprovados.
- `npm run build`: aprovado.
- Suíte E2E completa: 35 cenários aprovados no Chromium já instalado.
- Cenário de recuperação do catálogo: três repetições adicionais aprovadas.
- Marcadores de conflito ausentes; verificações de whitespace aprovadas.

O executor isolado de rotas foi adaptado ao novo import e ao documento de teste.
Há cobertura adicional de visibilitychange, coalescência e remoção de listeners,
e de perda da autorização administrativa após revalidação do perfil no servidor.
As verificações anteriores de falta de recuperação foram preservadas para HTTP
404, ao lado dos testes novos do formulário funcional, sem remover cobertura.

A falha antiga do catálogo era uma corrida do mock: o primeiro GET podia ser
cancelado pelo StrictMode antes do 401. Agora o teste aplica 401 à segunda página
da carga ativa, confere a troca do Bearer e exige que a página já recebida não
seja consultada novamente. Não há alteração de produção para mascarar essa falha.

A execução E2E utilizou proxy para `127.0.0.1:9`, sem serviço, e interceptações
locais de API. Não acessou homologação. Nenhuma dependência foi instalada e as
versões fixadas no lockfile foram preservadas. O merge continua sem commit.

## Registro histórico local, anterior ao PR #2

# Login + Catálogo — integração I04-B2 a I04-B4B

## Estado e referências

Registro de preparação em **10/11/2026**, na branch `feature/integracao-login-catalogo`,
a partir de `14fe812`. Alterações B2, B3 e B4A permanecem sem commit e foram preservadas.
A B4B altera somente configuração, manifesto/lockfile, infraestrutura de testes e esta documentação.
Não houve merge, alteração do backend ou publicação nesta etapa.

Referências estáticas:

- Login: `origin/feature/frontend-login`, commit `2ca2591803a872ff5cf44f89a43b6098f8f41300`.
- Catálogo: `feature/integracao-catalogo`, commit `14fe812c554605b08e35ba1c6304ede9592e8a02`.
- Backend: `d9281780b06186916928a62f077f8e9e721b97ff`, cujos roteadores e schemas de autenticação foram lidos na B2.

A conferência de código não comprova operação com API, banco ou usuários reais.

## Contrato reconciliado

| Operação | Requisição | Contrato utilizado |
| --- | --- | --- |
| Cadastro público | `POST /usuarios/` | Cria Membro; sem perfil no payload; resposta de usuário |
| Login | `POST /usuarios/login` | `identificacao` e `senha`; resposta com `access_token`, `token_type=bearer` e usuário |
| Renovação | `POST /usuarios/refresh` | Cookie HttpOnly; resposta de login e rotação do cookie |
| Sessão | `GET /usuarios/me` | Bearer; valida usuário ativo no servidor |
| Logout | `POST /usuarios/logout` | Revoga sessão associada ao cookie; HTTP 204 sem JSON |
| Catálogo | `GET /espacos/?skip=0&limit=100` | Bearer; array direto de espaços com recursos e relações |

Perfis globais aceitos: `Membro` e `Administrador`. Coordenador e Monitor não são
inventados como perfis globais ou permissões do frontend. Autorizações pertencem ao backend.
O componente `CadastroServidor` e a rota `/cadastro` permanecem por compatibilidade,
mas usam `cadastrarMembro`. Os aliases antigos de tipo/serviço permanecem temporariamente.
O backend de referência conserva `/usuarios/servidor` como alias depreciado; o frontend usa `/usuarios/`.

O cadastro normaliza CPF e campos textuais, preserva a senha e não autentica automaticamente.
Não há recuperação automática de senha, gestão de estoque, reserva independente de recursos
ou Visão Gestor nesta composição.

## Sessão, renovação e logout

- Access token e usuário ficam em `sessionStorage`; o JavaScript não lê o refresh cookie.
- Chamadas de autenticação usam `credentials: include`, com timeout de 15 segundos.
  O HTTP genérico oferece credenciais como opção; não acrescenta cookies nem refresh aos demais clientes.
- O JWT local fornece apenas a expiração. A validade da sessão é confirmada pelo servidor.
- O guard recupera sessão antes de redirecionar, renova 30 segundos antes de expirar e
  revalida ao recuperar foco. Erros de rede exibem nova tentativa sem presumir sessão inválida.
- Após 401 de `/me`, a recuperação tem uma renovação e uma repetição limitadas.
- Verificações e refresh concorrentes compartilham promessas. Operações de cookie são
  serializadas na aba e, quando disponível, com Web Locks entre abas da mesma origem.
- Logout explícito chama o backend e limpa os dados locais imediatamente. Respostas atrasadas
  de login, refresh ou `/me` não podem restaurar a sessão encerrada.
- Se a revogação falhar, a interface informa isso e oferece nova tentativa. O bloqueio de
  restauração fica na aba; não comprova revogação no servidor nem impede outra aba de usar um cookie válido.
- Login retorna somente a rotas protegidas conhecidas, preservando query/fragmento internos;
  origens externas, caminhos de autenticação e destinos inválidos retornam ao catálogo.

## Catálogo e rotas preservadas

| Rota | Comportamento atual |
| --- | --- |
| `/` | Catálogo da API; busca por nome do espaço ou recurso; filtros por bloco, capacidade e recurso |
| `/laboratorios/:id` | Detalhes do ID real encontrado no catálogo; não presume endpoint individual |
| `/laboratorios/:id/agendamento` | Bloqueio explícito: agendamento ainda não integrado |
| `/laboratorios/:id/agendamento/detalhes` | Mesmo bloqueio; não exibe formulário ou horários fictícios |
| `/meus-agendamentos` | Tela demonstrativa existente, identificada como tal; sem consulta real de solicitações |
| `/login`, `/cadastro`, `/recuperar-senha` | Públicas; demais rotas acima protegidas |

Sem fallback silencioso para fixtures. Campos nulos recebem indicação de ausência; não são
inventados sala, tema, imagens, categorias ou horários. Recursos indisponíveis continuam
pesquisáveis, identificados como indisponíveis. Tipo de uso não é fornecido pelo contrato;
o filtro foi retirado e a limitação é informada na interface.

O catálogo carrega páginas de 100 até uma página curta. Detecta duplicatas, respostas inválidas
e excesso de páginas; a guarda de 100 páginas falha explicitamente em vez de publicar truncamento.
Resultados só são publicados após concluir toda a carga. Um 401 recuperável repete somente a
página afetada, no máximo uma vez, com token renovado; não repete páginas já obtidas.

Cancelamento interrompe a espera do consumidor, sem cancelar um refresh compartilhado necessário
por outro consumidor. Respostas antigas e dados recebidos após logout são descartados.

Limitações conhecidas:

- Offset não garante snapshot consistente se o banco mudar durante a leitura.
- Renovação externa à carga (inclusive pelo guard) muda o token e pode invalidar a carga;
  a interface oferece nova tentativa para não misturar sessões.
- Detalhes recarregam o catálogo completo. Não há cache compartilhado nem endpoint individual presumido.
- Timeout de autenticação não equivale a timeout de todas as consultas de espaços.
- Disponibilidade cadastral não comprova horário livre nem reserva confirmada.

## Ambiente e deploy

### Desenvolvimento: proxy local adotado

Exemplo versionado em `.env.example`, sem credenciais:

```dotenv
VITE_API_URL=http://localhost:5173
API_PROXY_TARGET=http://localhost:8000
```

Copiar para `.env.local` exige ação local; nenhum arquivo de ambiente real foi criado/alterado nesta etapa.
`VITE_API_URL` deve ser absoluta, pois o cliente HTTP rejeita base relativa ou ausente.
`API_PROXY_TARGET` é configuração do processo Vite, não uma variável pública `VITE_*`.

O Vite usa porta 5173 com `strictPort` e encaminha `/usuarios`, `/espacos`, `/projetos`,
`/solicitacoes` e `/agendamentos` para o backend configurado. O proxy evita CORS entre
navegador e backend durante desenvolvimento, mas não elimina requisitos de cookie ou autorização.
Usar consistentemente o mesmo host: não alternar `localhost` e `127.0.0.1` nas URLs da aplicação.
Em acesso remoto, configurar a origem absoluta realmente acessível ao navegador e o backend
acessível ao processo Vite. Reiniciar o Vite após mudar variáveis.

### Produção e preview

O proxy acima existe **somente em `npm run dev`**. Não está em `dist/` nem em `npm run preview`.
Antes do build publicado, escolher uma das opções com a equipe responsável pelo deploy:

1. Origem única com proxy reverso real para os caminhos da API e `VITE_API_URL` nessa origem.
2. API direta, absoluta, com CORS e política de cookies compatíveis com a origem do frontend.

As variáveis `VITE_*` são incorporadas ao build; não incluir segredos. Servir rotas do
BrowserRouter com fallback adequado, sem interceptar as rotas da API.

O backend de referência define refresh cookie HttpOnly, `Path=/usuarios`, `Secure` por padrão e
`SameSite=Lax`. Validar Set-Cookie e envio em refresh/logout na origem final. HTTP remoto pode
não aceitar cookie Secure; SameSite=Lax pode impedir envio em implantação cross-site.
O frontend não remove essas proteções. Prefixos como `/api` exigem alinhamento do Path do cookie.
API direta exige CORS com origem explícita, credenciais e preflight para métodos/cabeçalhos
necessários, incluindo Content-Type e Authorization. Na referência estática, métodos e cabeçalhos
CORS não estavam explicitamente configurados; confirmar com o backend, sem corrigi-lo aqui.

## Dependências e comandos

Instaladas com autorização via `npm install --save-dev`:

| Dependência | Faixa declarada | Versão instalada nesta etapa |
| --- | --- | --- |
| `@playwright/test` | `^1.65.0` | `1.65.0` |
| `@testing-library/react` | `^16.3.3` | `16.3.3` |
| `@testing-library/user-event` | `^14.6.9` | `14.6.9` |
| `jsdom` | `^31.0.0` | `31.0.0` |
| `tsx` | `^4.23.15` | `4.23.15` |

Manifesto e lockfile reconciliados. Instalação adicionou 50 pacotes e auditou 81, sem
vulnerabilidades reportadas pelo npm. Não foi executado `npm audit fix` nem download de navegadores.

**Aviso de runtime:** Node local é `24.14.0`. JSDOM 31 e `w3c-xmlserializer` 6 declaram
`^22.22.2 || ^24.15.0 || >=26.0.0`; npm emitiu `EBADENGINE`. O manifesto registra essa faixa.
Os testes passaram no Node local, mas isso não torna a versão suportada. Alinhar Node para
uma versão suportada antes de padronizar instalação/CI; nenhuma atualização de Node foi feita.
Os testes unitários também emitem o aviso experimental de `stripTypeScriptTypes`.

```sh
npm run test:unit        # Node: serviços, contrato, paginação, rotas e ciclos isolados de hooks
npm run test:components  # Testing Library + JSDOM, API simulada
npm test                # unitários e componentes; sem servidor
npm run typecheck       # aplicação, Vite, testes e configuração Playwright; sem emissão
npm run build           # TypeScript e bundle Vite
npm run check           # npm test + typecheck + build; NÃO inicia E2E
```

`npm run typecheck:tests` verifica os arquivos de componentes, E2E e a configuração sem
executar Playwright. Com TypeScript 7, usa `--ignoreConfig` ao fornecer arquivos explicitamente.
Os testes de componentes usam os componentes reais, com mocks de HTTP que tratam `/espacos/`
como array e rejeitam chamadas inesperadas. Dados de teste não são fallback de produção.

### E2E preparados, não executados

`tests/e2e/autenticacao.spec.ts` contém 19 cenários: os 14 da referência adaptados e cinco
novos de catálogo, retorno ao ID real, dois acessos bloqueados e recuperação de 401 do catálogo.
A API é simulada por interceptação de requisições. Mesmo quando aprovados futuramente,
esses cenários não substituirão testes com backend e banco reais.

`playwright.config.ts` usa Chromium e servidor Vite na porta 4173. **Executar `npm run test:e2e`
inicia servidor** e depende de navegador disponível: exige autorização específica.
`PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` permite indicar executável existente. Não houve
instalação de navegador, execução E2E ou inicialização de servidor nesta B4B.

## Resultados: histórico e integração atual

| Etapa | Evidência |
| --- | --- |
| Login de referência `2ca2591` | Documentou 70 testes de serviços/rotas, 10 de componentes e build aprovados. Os 14 E2E NÃO foram aprovados: navegador bloqueado antes das interações. Não reexecutados nesta branch |
| I04-B2 | 83 testes de autenticação/HTTP e TypeScript aprovados |
| I04-B3 | 139 testes combinados e TypeScript aprovados |
| I04-B4A | 147 testes, TypeScript e build aprovados |
| I04-B4B | 147 testes unitários e 16 testes de componentes aprovados; TypeScript da aplicação/configuração/testes e build aprovados. E2E somente preparados e verificados estaticamente, não executados |

Os resultados atuais usam API simulada. Testes DOM não comprovam layout, cookies reais,
CORS, autorização do servidor ou persistência. Não houve validação ponta a ponta real.

## Pendências para I04-B5

1. Alinhar uma versão suportada do Node, mantendo as versões de ferramentas aprovadas.
2. Definir origem, URL da API e configuração de proxy/deploy com a equipe.
3. Com autorização, validar backend `d928178`, banco populado e usuários de teste Membro/Administrador.
4. Validar cadastro, login por CPF/e-mail, `/me`, cookies, renovação e revogação após logout.
5. Conferir catálogo real por perfil, recursos, paginação, 401 durante carga e erros sem fixtures.
6. Validar duas abas, foco, navegação/retorno, refresh concorrente e perda de rede durante logout.
7. Autorizar separadamente Chromium/servidor/E2E; revisar responsividade, teclado e acessibilidade visual.
8. Manter calendário/formulário bloqueados até sua integração e Meus Agendamentos identificado como demonstrativo.

## Registro histórico da entrega do PR #2

# Módulo 1 — Login e autenticação

## Referência e escopo

Contrato conferido em 19/11/2026 no backend `davidsonaguiar/agendamento_espacos`,
branch `dev`, commit `d9281780b06186916928a62f077f8e9e721b97ff`:
`docs/casos_de_uso/usuarios.md`, roteador, esquemas e configuração HTTP. A recuperação por e-mail foi conferida
na branch `Gabriel_Lins`, commit `a26a330`. A `dev` acima ainda não oferece essas duas rotas.
O backend foi consultado somente para leitura; nenhum arquivo ou commit foi alterado.

Esta entrega pertence a `feature/frontend-login`, com PR para
`feature/frontend-laboratorios`. As páginas, dados e estilos globais de catálogo,
detalhes, solicitações e Meus Agendamentos foram preservados. Os dados demonstrativos
desses módulos continuam demonstrativos.

## Contrato implementado

| Operação | Requisição | Resultado |
| --- | --- | --- |
| Cadastro público | `POST /usuarios/` | HTTP 201, usuário Membro; sem perfil no payload |
| Login | `POST /usuarios/login` | `identificacao` e `senha`; JWT, `token_type=bearer` e usuário |
| Renovação | `POST /usuarios/refresh` | Cookie HttpOnly; nova resposta de login |
| Consulta da sessão | `GET /usuarios/me` | Bearer; usuário ativo validado pelo servidor |
| Solicitar link | `POST /usuarios/recuperar-senha` com `{email}` | HTTP 202 e aviso genérico |
| Redefinir senha | `POST /usuarios/redefinir-senha` com `{token, nova_senha}` | HTTP 204 sem corpo e retorno ao Login |
| Logout atual | `POST /usuarios/logout` | Cookie HttpOnly; HTTP 204 sem JSON |

Perfis globais: `Administrador` e `Membro`. Coordenador e Monitor são vínculos
locais por espaço; o frontend não transforma esses papéis em perfil global.
O nome do componente `CadastroServidor` foi mantido por compatibilidade, mas sua
interface e serviço cadastram membros. O CPF é enviado com 11 dígitos, sem máscara,
e o vínculo é limitado a 50 caracteres (limite da coluna do backend). Não há
validação dos dígitos verificadores do CPF. A senha é enviada sem trim.

O cadastro leva ao Login. Em `/recuperar-senha`, o mesmo aviso de aceite se aplica
a e-mails existentes, inexistentes ou inativos. O link enviado pelo backend abre
`/recuperar-senha?token=…`. A interface valida o comprimento do token (43 a 128
caracteres), a senha (mínimo de 8) e a confirmação. Links inválidos, expirados ou
consumidos oferecem um novo pedido. Uma resposta inesperada do proxy, um endpoint
ausente ou uma falha de rede geram aviso de erro. Os dois POSTs públicos têm
timeout de 15 s e dispensam cookies e Bearer.

Ao concluir, a navegação substitui o link pelo Login no histórico. O módulo não
grava o token de redefinição em armazenamento local. A política de referência do
documento envia apenas a origem nos pedidos subsequentes. A API define a validade
do link (30 minutos por padrão), a invalidação de links anteriores e a revogação
das sessões. O usuário entra novamente com a nova senha.

## Sessão e proteção de rotas

- Access token e usuário ficam em `sessionStorage`; o refresh token nunca é lido
  pelo JavaScript. Login, consulta, refresh e logout usam `credentials: include`.
- O JWT decodificado localmente serve apenas para agendar a renovação. A autorização
  é confirmada em `/usuarios/me`; a assinatura e a sessão são verificadas pelo backend.
- Renovação 30 segundos antes do vencimento, ao abrir/recarregar uma rota protegida,
  ao recuperar o foco ou voltar à aba e após um 401 de `/me`, com uma repetição.
  Se um refresh terminou enquanto o primeiro `/me` estava em trânsito, a repetição usa o token já renovado.
- Chamadas concorrentes de verificação/renovação compartilham a mesma promessa.
  Uma fila serializa login, refresh e logout. Web Locks, quando disponível em
  HTTPS/localhost, também serializa as operações de cookie entre abas da mesma origem.
- Logout limpa os dados locais imediatamente, aguarda refresh pendente e revoga o
  cookie mais recente. Respostas antigas não podem restaurar uma sessão encerrada.
- Se o logout falhar, a interface informa que a revogação não foi confirmada e oferece
  nova tentativa. A restauração automática fica bloqueada nessa aba, inclusive após
  recarregar, até um novo login explícito. Isso não comprova revogação no servidor e
  não bloqueia uma nova aba; valide a revogação quando a conexão voltar.
- Falhas de rede/5xx na consulta preservam os dados locais, mas bloqueiam a tela
  protegida e permitem tentar novamente. Chamadas de autenticação têm limite de 15 s.
- Rotas protegidas: `/`, `/laboratorios/:id`, `/laboratorios/:id/agendamento`,
  `/laboratorios/:id/agendamento/detalhes` e `/meus-agendamentos`.
  Login, cadastro e recuperação de senha são públicos. O login retorna à rota
  interna originalmente solicitada, preservando query string.

## Configuração local

Requer Node.js 24 ou superior. Instale as dependências com `npm ci`, copie
`.env.example` para `.env.local` e execute `npm run dev`.

```dotenv
VITE_API_URL=http://localhost:5173
API_PROXY_TARGET=http://localhost:8000
```

A URL pública deve ser absoluta, conforme o contrato de `services/http.ts`.
O Vite usa a porta 5173 com `strictPort` e encaminha `/usuarios`, `/espacos`,
`/projetos`, `/solicitacoes` e `/agendamentos` ao backend. Em Codespaces ou outro
host remoto, use a URL real acessível do frontend em `VITE_API_URL` e o endereço do
backend acessível ao processo Vite em `API_PROXY_TARGET`. Reinicie o Vite ao alterar
as variáveis. Não publique chaves secretas em variáveis `VITE_*`.

O proxy existe somente no servidor de desenvolvimento. Para `dist/` ou
`npm run preview`, é necessário um proxy reverso real ou uma API acessível com CORS
configurado. Preserve o caminho `/usuarios` do cookie; acrescentar um prefixo como
`/api` exige que a infraestrutura ajuste também o Path do cookie.

No backend de referência, CORS permite origens configuráveis, mas `main.py` não
configura explicitamente `allow_methods` e `allow_headers`. Acesso direto entre
origens precisa ser validado com a equipe do backend, incluindo preflight de POST,
Content-Type, Authorization e credenciais; apenas listar a origem pode não bastar.
O proxy local evita esse preflight entre frontend e backend.

O refresh cookie é `Secure` por padrão e `SameSite=Lax`. Valide a política no navegador
real: use HTTPS em produção; desenvolvimento HTTP remoto pode exigir configuração
apropriada do backend. Não foi removida nem reescrita a flag Secure pelo frontend.

Para receber o link correto, configure `URL_FRONTEND` no ambiente da API com a
origem pública do frontend. O padrão da API é `http://localhost:3000` e o Vite usa
5173. A API também precisa de SMTP e da tabela de tokens de redefinição.

## Verificação em 19/11/2026

Com Node 24, instale as dependências com `npm ci`. Use `npx playwright install chromium`
ou indique um executável do Chromium em `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH`.
Execute `npm run check` para rodar a suíte de serviços, HTTP e rotas, os componentes
em JSDOM, o build de produção e os testes de navegador. Os testes dessa suíte usam
respostas HTTP simuladas. Passaram 79 testes de serviços/HTTP/rotas, 11 de
componentes, o build e os 24 cenários do Playwright.

- Antes das alterações, o Playwright passou em 13 de 14 cenários. Em janelas de
  320 a 420 px, o Login media 492 px. A coluna da grade assumia a largura mínima
  do conteúdo. A grade e o cartão agora encolhem até a largura disponível.
- O cenário de renovação original passou. Um teste adicional reproduziu duas
  rotações após um 401 atrasado. Ele agora exige uma rotação e confere o Bearer
  usado na segunda consulta. No navegador, o relógio controlado verifica o instante
  da renovação e o uso do novo token.
- A matriz de teclado e layout percorre Login, cadastro, solicitação de link e
  redefinição em 320, 375, 390, 420, 768, 1024 e 1366 px. Ela mede a página real,
  percorre todos os controles por Tab e verifica o foco e a visibilidade completa.
  Em uma execução adicional, as quatro telas também couberam com zoom nativo de
  200% (janela de 1366 px, viewport CSS de 683 px). [Login a 320 px](login/login-320.png),
  [Login a 1366 px](login/login-1366.png) e [redefinição a 320 px](login/redefinir-320.png).

### Integração com API em ambiente isolado

Foi executado um fluxo separado no Chromium com a aplicação FastAPI da
`Gabriel_Lins`, SQLite descartável, proxy Vite e servidor SMTP de captura em
loopback. Foram usados apenas cadastros gerados para o teste.

1. Cadastro pela interface e login por CPF. O navegador recebeu o refresh cookie
   com HttpOnly, Secure, SameSite=Lax e Path=/usuarios.
2. Duas abas sem access token restauraram a sessão pelo cookie compartilhado.
   Ambas chegaram a Meus Agendamentos e o cookie rotacionou.
3. A API enviou um e-mail ao SMTP local. O navegador abriu o link recebido, trocou
   a senha e voltou ao Login. A API recusou o segundo uso do link com HTTP 400.
4. As duas abas perderam acesso após recarregar. A senha antiga foi recusada,
   a nova funcionou por e-mail e o refresh após logout retornou HTTP 401.

Os 45 testes de usuários da própria API e os 17 testes de vínculos e listagem de
solicitações também passaram com SQLite. Esses testes cobrem o escopo de espaço
do coordenador e o perfil global do administrador. O backend foi executado com
Python 3.14. Em Python 3.12, a importação de `NovoHorarioSolicitacao` falhou por uma
anotação que referencia a própria classe. A equipe de backend precisa conferir
o runtime de deploy. SMTP externo, banco e CORS/HTTPS de homologação seguem pendentes.

### Composição com os colegas

| Branch consultada | Resultado |
| --- | --- |
| `feature/frontend-laboratorios` em `c5571b3` | Base do PR #2. As telas e os dados de catálogo e agendamentos da base continuam na branch de Login. |
| `feature/integracao-api` em `2d76e8c` | Histórico conciliado na branch de Login. O transporte e os testes mais recentes foram preservados. |
| `feature/integracao-catalogo` em `14fe812` | Merge automático em cópia temporária. Catálogo e detalhes abriram com a API local, com o Bearer renovado. A solicitação de reserva nessa versão ainda mostra o estado de integração pendente. |
| `feature/frontend-gestor` em `fa43b86` (PR #3) | Dois conflitos em `src/App.tsx` e `src/components/Cabecalho.tsx`. O ensaio local conservou a rota protegida, as três abas do painel, o cabeçalho com identidade e o logout funcional. |

Para compor o PR do Gestor, conservar as rotas públicas de acesso e as rotas
protegidas do aluno. Em `App.tsx`, ligar o painel à sessão verificada. Em
`Cabecalho.tsx`, preservar a apresentação específica do gestor e usar o logout
que revoga o cookie. O ensaio verificou a entrada do Administrador e a restrição
do Membro comum. O painel publicado pelo colega ainda aguarda integração de dados
e permissões locais por espaço. O ensaio combinado passou em 110 testes de serviços/HTTP/rotas, 11 de componentes,
24 cenários de navegador e no build. A versão do aluno com envio real de solicitações
e a suíte de 304 testes relatada não constavam das branches publicadas na revisão.
