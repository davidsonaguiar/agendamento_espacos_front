# Etapa I01 — infraestrutura HTTP

Escopo: cliente isolado, sem importações nas telas e sem chamadas reais à API.
Base verificada: feature/integracao-api, commit c5571b3, árvore inicialmente limpa.

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

## Contratos conferidos no backend (somente leitura)

- main.py registra /usuarios, /espacos, /solicitacoes e /agendamentos.
- usuarios/interface/roteadores/roteador.py: POST /usuarios/login recebe JSON
  identificacao e senha; POST /usuarios/servidor retorna 201; GET /usuarios/me
  utiliza Bearer via HTTPBearer.
- espacos/interface/roteadores/recursos.py: recursos sob /espacos/{id}/recursos.
- agendamento/interface/roteador.py: /agendamentos/disponibilidade e
  /agendamentos/horarios-disponiveis; solicitações têm roteador /solicitacoes.
- compartilhado/dominio/erros.py deriva de HTTPException com detail textual,
  incluindo 401, 403, 404, 409, 413, 422 e 500. Validação FastAPI pode retornar
  detail como lista de objetos com msg. Proxies podem responder texto ou vazio.

Nenhum serviço de endpoint foi implementado. Nenhum backend foi iniciado.

## Composição futura com o login

Inspeção via git show de origin/feature/frontend-login, sem incorporar arquivos.
autenticacao.ts contém transporte privado requisitar, ErroAutenticacao,
validação de sessão e sessionStorage. Isso continua sob responsabilidade do login.

- Ambos usam VITE_API_URL. Login usa fallback http://localhost:8000; este cliente
  exige configuração explícita. Alinhar essa política na composição.
- Trocar futuramente apenas o transporte privado por este cliente, adaptando body
  de string JSON para objeto e passando token do serviço de autenticação.
- Converter ErroHttp para ErroAutenticacao onde necessário, preservando status
  para a lógica existente de 401/403 e mensagens específicas de autenticação.
- Manter validação de JWT/usuário, armazenamento, rotas e sessão no serviço atual.
- Tratar retorno undefined explicitamente no login, que exige JSON válido.
- Preservar cancelamentos, distinguindo-os de falhas de rede.

## Verificação local

Sem runner configurado nesta branch: alternativa sem dependências com node:test,
node:assert e stripTypeScriptTypes do Node 24 instalado, seguindo o mecanismo dos
testes da branch de login. O teste lê o serviço real e substitui apenas a expressão
de ambiente Vite antes de executá-lo. Todos os fetch são mocks restaurados ao final.

Executar: node --test tests/http.test.mjs
Build Windows: npm.cmd run build
Verificação: git diff --check

Não houve validação contra API real. Commit, push e Etapa I02 dependem de autorização.
