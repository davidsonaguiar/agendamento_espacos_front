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
