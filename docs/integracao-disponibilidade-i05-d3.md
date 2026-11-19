# I05-D3 — calendário com disponibilidade real

Contrato conferido no backend local, sem alterações ou chamadas de escrita:

- `app/modulos/agendamento/interface/roteadores/agendamentos.py`: GET
  `/agendamentos/horarios-disponiveis`, autenticado por Bearer; query
  `id_espaco`, `data_inicio`, `data_fim`. Não são consultados recursos nesta etapa.
- `casos_uso/consultar_horarios_disponiveis.py`: até 31 datas inclusivas,
  início não anterior a `date.today()`, intervalos livres de uma hora;
  respeita funcionamento, pausas, desativação e conflitos de reservas.
- `dominio/entidades/reserva_agenda.py`: lista de `PeriodoReserva`, com
  `data_hora_inicio` e `data_hora_fim` locais sem timezone.

A grade tem 42 células, mas consulta somente o mês exibido, a partir da data
local atual. Meses anteriores não geram consulta de horários. Dias adjacentes
ficam desabilitados; fins de semana dependem exclusivamente da API.
A resposta vazia significa ausência de horários, sem presumir a causa.

O catálogo real confirma ID, nome e estado cadastral. O serviço valida datas,
limites, duração e resposta; mantém segundos e microssegundos sem conversão UTC.
A seleção só aceita limites retornados e uma cadeia de slots consecutivos.
Mudar o mês limpa a seleção; consultas obsoletas são abortadas e seus resultados
descartados, inclusive quando o transporte ignora o cancelamento.

A rota `/laboratorios/:id/agendamento/detalhes` reconsulta o dia da seleção.
URL inválida, duplicada, passada ou incompatível com a disponibilidade não
habilita a prévia. O resumo não envia payload e não cria solicitação ou reserva.
Não há formulário de finalidade nesta etapa; envio continua bloqueado para I05-D4.
As duas rotas continuam sob o guard existente. A autenticação não foi alterada:
o serviço usa suas funções existentes e limita a repetição após 401.

Validação automatizada: `npm.cmd test`, `npm.cmd run typecheck`,
`npm.cmd run build` e `git diff --check`.
Os testes automatizados simulam a API. A validação manual autenticada em
homologação foi concluída e confirmada pelo usuário: login de aluno, catálogo,
detalhes reais, calendário, seleção de data/horário e prévia exibindo corretamente
o laboratório, a data e o intervalo. Nenhuma solicitação foi enviada e nenhuma
reserva foi criada nesta etapa; o envio continua bloqueado.

A consulta real autenticada a `/agendamentos/horarios-disponiveis` para o espaço
2, Sala de reuniões (seed), no período de 19 a 22/11/2026, retornou HTTP 200 tanto
na API de homologação quanto pelo proxy do frontend. Foram retornados 10 intervalos
de uma hora na quinta-feira (19/11), nenhum na sexta-feira (20/11) e no sábado
(21/11), e 10 intervalos no domingo (22/11), entre 08h e 18h nos dias disponíveis.

A inspeção somente leitura do cadastro confirmou funcionamento ativo nos dias
0 a 4 (domingo a quinta-feira), das 08h às 18h, sem horários cadastrados para
sexta-feira (5) ou sábado (6). Frontend e backend usam a mesma convenção de dias
da semana; o bloqueio observado corresponde aos dados do backend e não indica
defeito no frontend. Não houve alteração de código ou dados para esse diagnóstico.

A disponibilidade pode mudar após a consulta; a futura criação deve continuar
sujeita à validação do servidor. O fluxo de envio, finalidade e decisão permanece
fora do escopo da I05-D3.
