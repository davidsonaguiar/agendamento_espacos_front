# Módulo 1 — Login, autenticação e sessão

Origem: `feature/frontend-login`, commit `e07fdb6`.
Composição I02-B1 em `feature/integracao-api`, ainda sem commit de merge.

## Telas e fluxos

- `/login`: login com e-mail ou CPF e senha, via `POST /usuarios/login`.
- `/cadastro`: cadastro público **exclusivamente de servidor**, via `POST /usuarios/servidor`. A API `dev` não oferece cadastro público de Aluno, Monitor, Coordenador e Administrador.
- `/recuperar-senha`: orientação para procurar a coordenação. **Não há endpoint de recuperação de senha na API dev**; esta página não envia e-mails nem altera senhas.
- Páginas de laboratório e agendamento: protegidas pela validação `GET /usuarios/me`, usando token Bearer.
- Token JWT expirado ou rejeitado (401/403) termina a sessão e leva o usuário para `/login`. Erros temporários de rede exibem a opção de tentar novamente, sem apagar imediatamente o token.

## Executar

1. `npm ci`
2. `npm run build`
3. `node --test tests/autenticacao.test.mjs`
4. Configure `.env.local` a partir de `.env.example`, usando `VITE_API_URL=http://localhost:8000`.
5. Inicie o backend FastAPI da branch `dev` do repositório `davidsonaguiar/agendamento_espacos` com banco e variáveis de ambiente configurados.
6. `npm run dev`; visite `http://localhost:5173/login`.

## Testes manuais com API real antes do merge

- Com usuário real válido: autenticar, abrir o catálogo e recarregar a página.
- Com senha incorreta: observar mensagem de erro, sem acesso ao catálogo.
- Sem token: abrir `http://localhost:5173/` diretamente; deve redirecionar a `/login`.
- JWT inválido/expirado: tentar `/` e verificar redirecionamento para `/login`.
- Cadastro: testar criação de um **servidor** com SIAPE e CPF de teste autorizados; confirmar conflito (409) para duplicidade.
- Backend fora do ar: acesso mostra erro de conexão/"Tentar novamente", sem simular login.
- Recuperação de senha: deve exibir explicação de indisponibilidade, sem prometer um envio.
- Abrir a página em uma janela estreita para validar o layout responsivo.

## Limitações técnicas

A navegação é protegida no React para experiência de uso; autorização e segurança de acesso a dados devem ser aplicadas pelas rotas do backend. O token é mantido em `sessionStorage` durante a aba atual. Não existe implementação de recuperação automática de senha sem contrato de API. Os testes automatizados isolam o serviço HTTP com mocks; **não substituem testes ponta a ponta com o backend e banco operantes**.


## Composição I02-B1

O serviço de autenticação reutiliza src/services/http.ts. Não mantém fetch próprio,
nem fallback de URL. VITE_API_URL é obrigatória conforme a I01; reiniciar o Vite
após configurar o ambiente. ErroAutenticacao mantém as mensagens de detail e os
fallbacks específicos de 401/403/409. Erros de configuração permanecem explícitos;
respostas vazias, JSON inválido e dados de usuário inválidos são rejeitados.
O cliente HTTP continua responsável apenas pelo transporte. A autenticação
continua responsável pelo token, sessionStorage, validação de usuário e logout.
JWT usa exp para expiração local; a autoridade para a sessão continua sendo /usuarios/me.

As cinco rotas protegidas são /, /laboratorios/:id,
/laboratorios/:id/agendamento, /laboratorios/:id/agendamento/detalhes e
/meus-agendamentos. Login, cadastro e recuperação continuam públicos.
Cabeçalho, estilos globais, dados demonstrativos e páginas existentes foram
preservados. Não foi criado modo offline nem bypass de autenticação.

### Testes da composição

Executar no Windows:
- node --test tests/http.test.mjs tests/autenticacao.test.mjs tests/rotas.test.mjs
- npm.cmd run build
- git diff --check
- git diff --cached --check

Os testes de autenticação executam os serviços reais de autenticação e HTTP,
substituindo apenas a variável de ambiente e mockando fetch/sessionStorage.
Os testes de rotas compilam o App.tsx real com o Vite instalado, substituindo
somente telas e guard por componentes vazios para inspecionar a configuração.
Eles não executam efeitos do guard nem navegação em navegador. Não há ferramenta
de DOM/browser configurada; não foram adicionadas dependências.

### Roteiro manual pendente

1. Sem sessão, abrir diretamente cada uma das cinco rotas: esperar login, sem
   conteúdo protegido. Conferir também recarregamento e navegação voltar/avançar.
2. Autenticar com usuário válido, navegar pelas cinco rotas e recarregar
   /meus-agendamentos. Conferir o link Agendamentos e indicação de seção ativa.
3. Testar IDs inválidos nos três caminhos parametrizados e caminho desconhecido:
   após validar sessão, esperar redirecionamento ao início.
4. Testar expiração com página aberta e durante navegação; confirmar limpeza da
   sessão e retorno ao login. Testar 401/403 na consulta de sessão.
5. Com token existente, interromper conexão: esperar bloqueio com nova tentativa
   sem apagar token. Restaurar conexão e tentar novamente.
6. Conferir cadastro, conflito 409, credenciais incorretas e recuperação informativa.
7. Conferir contraste dos horários selecionados, foco do título da seleção,
   filtros da agenda e layout responsivo de autenticação e páginas existentes.

### API real: pendências externas

A API não foi iniciada nem validada nesta composição. No backend de referência,
alinhar com o responsável: CORS para POST e Authorization entre origens diferentes;
e chamadas de CredenciaisInvalidasErro com mensagem em seguranca_http.py, enquanto
o construtor atual não recebe argumentos. Não corrigir esses pontos neste frontend.
Validar depois host/origens permitidos, URL, usuário de teste e contratos reais.
