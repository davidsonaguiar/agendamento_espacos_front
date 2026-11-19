# Etapa I01 — infraestrutura HTTP

Escopo: cliente HTTP compartilhado e integração de cadastro/listagem de espaços
no painel do gestor. Os testes usam mocks; não foi validado contra API real.
Contrato de autenticação usado pelo frontend: backend `dev`, commit
d9281780b06186916928a62f077f8e9e721b97ff. O backend `main` tem diferenças
no cadastro e nos perfis; alinhe o ambiente implantado com `dev` antes de integrar.

## Uso e configuração

Copiar .env.example para .env.local e reiniciar o Vite. VITE_API_URL deve ser
uma URL absoluta HTTP(S), sem credenciais, query ou fragmento. A variável é
pública no bundle: nunca incluir segredos. A ausência de URL gera ErroHttp
de configuração antes de fetch; não existe fallback para o servidor Vite.

requisitar<T>(caminho, { method, body, headers, signal, token }) usa fetch nativo.
body é um valor JSON, serializado pelo cliente. Caminhos com ou sem barra inicial
são acrescentados ao prefixo da URL base. Query strings podem vir no caminho.
Token é opcional e fornecido pelo chamador. Nenhum armazenamento ou log é usado.
Não há suporte a upload/multipart nesta etapa.

O retorno é Promise<T | undefined>: respostas vazias, 204 e HEAD retornam undefined.
T não valida o esquema em runtime; cada serviço futuro deve validar seu contrato.
JSON inválido em sucesso gera erro de resposta. ErroHttp contém tipo, status
quando conhecido e corpo original decodificado (ou texto) para erros HTTP.
Mensagens reconhecem detail textual, detail com msg de validação, message,
mensagem e texto simples. Conteúdos desconhecidos têm mensagem com status.
Renderizar mensagens como texto, nunca como HTML. Cancelamentos preservam o
erro original; falhas de transporte/leitura são erros de rede.
O corpo preservado pode conter dados da API: não enviá-lo automaticamente a logs.

## Contratos conferidos no backend `dev` (somente leitura)

- main.py registra /usuarios, /espacos, /solicitacoes e /agendamentos.
- usuarios/interface/roteadores/roteador.py: POST /usuarios/login recebe JSON
  identificacao e senha; POST /usuarios/ retorna 201 para cadastro público
  (/usuarios/servidor é alias legado); GET /usuarios/me, POST /usuarios/refresh
  e POST /usuarios/logout estão disponíveis. Perfis globais: Administrador e
  Membro; GET /usuarios/me
  utiliza Bearer via HTTPBearer.
- espacos/interface/roteadores/recursos.py: recursos sob /espacos/{id}/recursos.
- agendamento/interface/roteador.py: /agendamentos/disponibilidade e
  /agendamentos/horarios-disponiveis; solicitações têm roteador /solicitacoes.
- compartilhado/dominio/erros.py deriva de HTTPException com detail textual,
  incluindo 401, 403, 404, 409, 413, 422 e 500. Validação FastAPI pode retornar
  detail como lista de objetos com msg. Proxies podem responder texto ou vazio.

O serviço `src/services/espacos.ts` integra GET e POST `/espacos/` com sessão
autenticada. O cadastro exige Administrador e envia `nome`, `descricao`,
`capacidade`, `bloco` e `disponibilidade`; a API responde 201. O GET lista
espaços conforme as permissões do perfil. Respostas são validadas em runtime.
O simulador local não persiste espaços no backend.

## Composição do cliente de espaços com o login

O cliente HTTP compartilhado continua em `src/services/http.ts`. O serviço de
autenticação valida a sessão antes de chamadas protegidas e fornece o token
Bearer ao serviço de espaços. A página do gestor exibe falhas da API e permite
tentar o carregamento novamente; não apresenta sucesso quando o backend falha.

## Verificação local

Validado com mocks de API nos testes de componente e E2E, além de `npm test`,
`npm run build` e `npm run test:e2e`. Não houve validação contra uma instância
real do backend; confirme `VITE_API_URL`, CORS e credenciais no ambiente integrado.
