# I05-D5A — contrato e serviço de leitura

GET /solicitacoes/ retorna HTTP 200 com array de SolicitacaoResposta, sem
paginação, filtros ou envelope. A sessão ativa é validada pelo backend com
Bearer. O contrato foi conferido em interface/roteadores/solicitacoes.py,
interface/esquemas/solicitacao_resposta.py e dominio/entidades/solicitacao.py
no backend de referência. Os tipos de consulta são independentes da criação
(D4) e dos modelos demonstrativos. Não há tipo nem data de criação no contrato.

listarMinhasSolicitacoes(signal?) usa o cliente HTTP e a autenticação existentes.
Sem identidade válida e ativa, falha antes de consultar ou renovar. Não recebe
ID da URL. Valida o array e suas relações, preserva datas civis e horas com
segundos e frações, e retorna somente id_solicitante igual ao ID da sessão.
O backend pode incluir solicitações de espaços coordenados ou todas para
Administrador. A seleção nesta função define "minhas"; não substitui autorização.
Não há fallback para fixtures, estado global de listagem ou cache permanente.

A resposta conserva status como string, conforme o schema. A função
classificarStatusSolicitacao retorna conhecido com um dos seis status oficiais
ou desconhecido com o valor original. O consumidor deve tratar esse segundo
caso explicitamente. espaco_reservado indica modalidade, não aprovação ou
comprovação de reserva. Relações nulas e coleções vazias são preservadas.

A leitura captura usuário e token e confere a sessão antes/depois das esperas.
Mudança de identidade/token ou logout descarta a resposta. AbortSignal cancela
o consumidor, inclusive durante refresh, sem cancelar a renovação compartilhada.
Somente o GET tem renovação limitada: no máximo um refresh por consulta e uma
repetição de GET após 401. Renovação inicial de token vencido/ausente consome
esse limite. Rede, resposta inválida e outros erros HTTP não são repetidos.
401 persistente encerra apenas a sessão ainda correspondente à consulta.
O comportamento do POST de criação não foi alterado.

Validação desta etapa usa mocks: não executar login, refresh ou escritas reais.
Os mocks de refresh exercitam exclusivamente o mecanismo já existente.
Comandos: npm.cmd test; npm.cmd run typecheck; npm.cmd run build;
git diff --check.

Pendente para D5B: integrar MeusAgendamentos e o cartão aos tipos reais, incluir
carregamento, vazio, erro/nova tentativa, atualização e navegação da confirmação.
A tela deve limpar imediatamente sua lista ao sair/trocar a sessão e abortar
consultas obsoletas. O serviço não pode apagar dados já copiados pelo consumidor.
Nenhuma interface, login, painel gestor, backend ou banco foi alterado na D5A.
