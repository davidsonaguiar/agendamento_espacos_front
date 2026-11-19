# I05-D4A/B — formulário e criação de solicitação

A D4A prepara finalidade e payload de espaço a partir da disponibilidade real.
A finalidade tem 3 a 255 caracteres após trim; o rascunho usa history.state,
vinculado ao usuário e laboratório, sem finalidade na URL ou storage permanente.
Datas e horas são locais; segundos e microssegundos são preservados. O início
precisa ser futuro e as telas abertas revalidam o relógio local.

A D4B habilita o envio após revisão válida. Antes do POST, consulta novamente
os intervalos, reconstrói o payload e verifica a sessão pelo mecanismo existente.
Uma sessão expirada pode ser renovada nessa verificação, antes da criação.
O transporte manda somente id_espaco, finalidade e horarios para
POST /solicitacoes/, com Bearer. Não envia tipo nem opcionais desnecessários.
A resposta deve ter HTTP 201, ID positivo, status conhecido e dados coerentes
com usuário, laboratório, finalidade e intervalo submetidos.

O hook usa trava síncrona e desabilita ações durante a tentativa. Nunca repete
o POST automaticamente, nem após 401. Respostas 401/403/404/422/409 são rejeições
confirmadas; falhas anteriores à criação são identificadas separadamente.
Após possível transmissão, rede, timeout, 5xx, JSON/resposta inválida ou status
inesperado são resultados incertos: a solicitação pode ter sido registrada.
A tela preserva o formulário e bloqueia reenvio. O histórico atual ainda usa
fixtures, por isso a orientação é conferir com a coordenação até haver histórico
real integrado. Abort de rede não desfaz uma gravação no servidor.

Sucesso exibe ID, status e dados retornados. Pendente mostra:
"Solicitação enviada e aguardando análise." Não confirma reserva ou aprovação.
A confirmação remove o formulário de envio. Marcadores em history.state mantêm
sucesso/incerteza ao remontar a mesma navegação; uma tentativa interrompida sem
confirmação também é tratada conservadoramente como incerta. Escopo inclui
usuário, laboratório, data e intervalo. O rascunho da D4A continua preservado.

Não há idempotência no endpoint de referência. A trava protege esta interface;
não oferece garantia global entre abas, novas navegações ou outros clientes.
Essa garantia exige suporte coordenado do backend. A criação registra uma
solicitação pendente; conflitos são reavaliados no fluxo de aprovação.

Validação automatizada usa mocks, sem POST real, banco ou migração.
Comandos: npm.cmd test; npm.cmd run typecheck; npm.cmd run build;
git diff --check. Na validação manual autorizada em homologação, o usuário
realizou o envio pelo navegador. Consulta somente leitura confirmou a solicitação
persistida com status Pendente e nenhuma reserva vinculada. O access log estava
desativado, portanto não há registro HTTP daquele envio; o fluxo de confirmação
exige HTTP 201 e valida os dados retornados. O texto aproximado relatado pelo
usuário não coincide literalmente com a mensagem da implementação.
Login e painel gestor não foram alterados.

A usabilidade explicita os motivos de bloqueio por sessão, consulta, seleção,
finalidade, revisão, envio em andamento ou resultado incerto. Alterar a finalidade
após revisar exige nova revisão. O botão desabilitado tem aparência distinta e
mensagem associada por aria-describedby. A publicação inicial de estado está
no tratamento de exceções; falha de navegação antes da transmissão impede o POST.
Falhar ao persistir a navegação após confirmação mantém o resultado local e não
habilita novo envio. A causa do primeiro clique sem resposta não foi comprovada.
