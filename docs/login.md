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
