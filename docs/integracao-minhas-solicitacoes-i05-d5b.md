# I05-D5B — Meus Agendamentos com consulta real

A tela consulta listarMinhasSolicitacoes ao montar e no botão Atualizar, sem
fixtures, cache permanente ou data de criação inferida. Mantém os seis filtros;
status desconhecidos aparecem explicitamente em Todos. Lista vazia e filtro
sem resultados têm mensagens diferentes. Erros permitem Tentar novamente.
A consulta é separada da confirmação de criação, que oferece link para a lista.
O link do resultado incerto orienta consultar o histórico antes de nova tentativa.
Nenhuma navegação para o histórico repete a criação.

Os cartões usam o contrato da D5A: ID, espaço real ou fallback por ID, finalidade,
status e horários locais. Justificativa da decisão aparece para Aprovado/Rejeitado
quando informada. Horários múltiplos são ordenados sem mutar os dados recebidos;
solicitações são ordenadas pelo primeiro intervalo cronológico, depois ID e dados
de desempate. Horários sem segundos/fracionários significativos usam HH:mm;
valores com precisão significativa são preservados. Duração usa inteiros em
microssegundos, sem UTC ou arredondamento de ponto flutuante.
espaco_reservado não é interpretado como aprovação ou reserva confirmada.

useMinhasSolicitacoes guarda estado apenas na montagem corrente. Invalida os
dados no render quando a chave de usuário/token muda ou ao atualizar, aborta a
consulta anterior e rejeita respostas obsoletas. A seleção por solicitante é
aplicada novamente antes de apresentar qualquer cartão.

A autenticação existente não publica eventos de sessão. useSessaoConsulta usa
useSyncExternalStore e observa setItem/removeItem/clear nativos de sessionStorage
para invalidar a tela no mesmo evento, sem polling ou alteração do módulo de
autenticação. O observador apenas notifica; não escreve dados, altera valores ou
executa login/refresh. Há suporte a storage/focus/visibilitychange e restauração
dos métodos/listeners quando o último consumidor desmonta. Isso também cobre
logout programático no mesmo documento. As proteções de rota permanecem intactas.

A D5A e o comportamento de criação da D4 foram preservados. Login, painel gestor,
backend e banco não foram alterados. Os testes usam mocks; nenhum POST real foi
executado. Validação manual autenticada da listagem em homologação continua
pendente, especialmente consulta da #3 com seu autor, atualização, expiração e
navegação da confirmação. Não criar outra solicitação apenas para validar a lista.

A suíte unitária/de componentes passou com 291 testes. TypeScript, build e
verificação de whitespace passaram. A execução adicional dos 19 cenários E2E
anteriores passou em 14 e falhou em cinco verificações de login móvel, detalhes,
rotas de calendário ainda esperadas como bloqueadas e contagem de renovação no
catálogo. Essas falhas não foram corrigidas alterando login/calendário nesta
etapa. O Chromium esperado pelo Playwright não está instalado; para executar
os cenários foi usado o Chromium já existente via variável de processo suportada
pela configuração. Nenhuma dependência ou configuração persistente foi alterada.
