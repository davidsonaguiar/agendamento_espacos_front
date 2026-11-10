# Módulo 1 — Login e autenticação

## Referência e escopo

Contrato conferido em 10/11/2026 no backend `davidsonaguiar/agendamento_espacos`,
branch `dev`, commit `d9281780b06186916928a62f077f8e9e721b97ff`:
`docs/casos_de_uso/usuarios.md`, roteador, esquemas e configuração HTTP.
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
| Logout atual | `POST /usuarios/logout` | Cookie HttpOnly; HTTP 204 sem JSON |

Perfis globais: `Administrador` e `Membro`. Coordenador e Monitor são vínculos
locais por espaço; o frontend não transforma esses papéis em perfil global.
O nome do componente `CadastroServidor` foi mantido por compatibilidade, mas sua
interface e serviço cadastram membros. O CPF é enviado com 11 dígitos, sem máscara,
e o vínculo é limitado a 50 caracteres (limite da coluna do backend). Não há
validação dos dígitos verificadores do CPF. A senha é enviada sem trim.

O cadastro não autentica automaticamente. Após criar a conta, o usuário volta ao
login. Não se implementou recuperação automática de senha: esse endpoint não existe.
Cadastro interno, mudança de senha e logout de todas as sessões ficam fora desta entrega.

## Sessão e proteção de rotas

- Access token e usuário ficam em `sessionStorage`; o refresh token nunca é lido
  pelo JavaScript. Todas as chamadas de autenticação usam `credentials: include`.
- O JWT decodificado localmente serve apenas para agendar a renovação. A autorização
  é confirmada em `/usuarios/me`; a assinatura e a sessão são verificadas pelo backend.
- Renovação 30 segundos antes do vencimento, ao abrir/recarregar uma rota protegida,
  ao recuperar o foco e após um 401 de `/me`, com apenas uma repetição.
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
  Login, cadastro e orientações de recuperação são públicos. O login retorna à rota
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

## Comparação com as branches e o ZIP

- `feature/frontend-laboratorios` (`c5571b3`) foi usada como referência para
  preservar telas, dados e estilos dos colegas. A publicação ocorreu por commits
  pela interface do GitHub, pois o push pelo terminal não tinha credenciais.
- O código de `feature/integracao-api` (`2d76e8c`) foi reutilizado para transporte
  HTTP e testes de HTTP/rotas. A publicação pelo navegador não transporta os merges
  do histórico local preparado: os commits originais continuam em sua branch.
  `credentials` foi acrescentado como opt-in, mantendo o comportamento dos clientes
  existentes. Os testes de autenticação foram adaptados para Membro e cookie.
- `feature/integracao-catalogo` (`14fe812`) foi comparada sem incorporar sua
  funcionalidade. O histórico local preparado permitiu merge sem conflitos, mas
  essa conclusão não se aplica aos commits publicados pela interface do GitHub.
  A simulação da branch publicada detectou conflitos com a integração de catálogo
  em autenticação, transporte, testes e configuração; uma futura integração precisa
  reconciliá-los preservando o contrato documentado aqui. Não se declara essa
  integração aprovada. O PR desta entrega tem destino somente frontend-laboratorios.
- O ZIP foi revisado arquivo a arquivo: aproveitados contrato Membro, cadastro,
  refresh, logout, tipos e estilos. App foi reconciliado com as rotas atuais; o
  serviço foi adaptado para o HTTP compartilhado, com correções de concorrência,
  bloqueio após logout, fila entre abas e timeout. Configuração do proxy tornou-se
  parametrizável. Não foram executados/importados o script de publicação e as
  instruções de commit do ZIP.

## Testes e resultado desta revisão

```sh
npm test                 # serviços, transporte HTTP, rotas e componentes (DOM simulado)
npm run build           # TypeScript e bundle de produção
npx playwright install chromium
npm run test:e2e         # Chromium com API simulada
npm run check           # executa todos; exige navegador instalado e executável
```

Para um Chromium já instalado, o Playwright aceita a variável
`PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` com o caminho do executável.

Resultados em 10/11/2026:

- 70 testes de serviços/HTTP/rotas aprovados.
- 10 testes de componentes aprovados (Testing Library + JSDOM), incluindo as cinco
  rotas protegidas, retorno à agenda após login, filtros preservados, cadastro,
  indisponibilidade e nova tentativa de logout.
- Build completo aprovado (`tsc -b && vite build`).
- 14 cenários de navegador preparados e execução tentada, mas bloqueados antes de
  executar as interações: Chromium abortou com `socket() failed: Operation not
  permitted`. A instalação alternativa do Headless Shell retornou download inválido.
  Esses cenários **não estão aprovados**; `npm run check` não foi concluído com sucesso.
- Os testes executados usam HTTP simulado. Não houve validação ponta a ponta contra
  backend/banco reais, nem validação visual em navegador nesta sessão.

## Validação pendente com a API real

1. Criar membro com dados de teste autorizados e conferir 201 e conflitos 409.
2. Entrar por e-mail e CPF; verificar conta inativa/credenciais incorretas.
3. Conferir o Set-Cookie HttpOnly/Secure/SameSite/Path e seu envio em refresh/logout,
   tanto em desenvolvimento quanto na origem de produção; verificar CORS/preflight.
4. Abrir todas as rotas protegidas, recarregar sem access token, aguardar renovação
   e testar duas abas simultâneas. Sem Web Locks, a fila cobre somente a própria aba.
5. Confirmar revogação no servidor após logout e recusa de token antigo; testar
   perda de rede durante logout e renovação, sem interpretar aviso local como revogação.
6. Executar os 14 cenários Playwright em ambiente com Chromium funcional e revisar
   layout móvel/desktop. Testes DOM não substituem essa verificação.
