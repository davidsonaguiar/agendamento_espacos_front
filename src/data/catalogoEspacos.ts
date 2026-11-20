import type { EspacoCatalogo, EspacoResposta } from '../types/espaco'

export function adaptarEspaco(espaco: EspacoResposta): EspacoCatalogo {
  return {
    id: espaco.id, nome: espaco.nome, descricao: espaco.descricao,
    capacidade: espaco.capacidade, bloco: espaco.bloco,
    disponivel: espaco.disponibilidade,
    recursos: (espaco.recursos ?? []).map(recurso => ({ ...recurso })),
  }
}

export function normalizarBusca(texto: string): string {
  return texto.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLocaleLowerCase('pt-BR').trim()
}

export interface FiltrosCatalogo {
  busca: string
  bloco: string
  capacidade: string
  recurso: string
}

export function filtrarEspacos(espacos: readonly EspacoCatalogo[], filtros: FiltrosCatalogo): EspacoCatalogo[] {
  const termo = normalizarBusca(filtros.busca)
  return espacos.filter(espaco => {
    // Recurso indisponível continua descobrível, mas sempre identificado como tal na interface.
    const corresponde = normalizarBusca(espaco.nome).includes(termo)
      || espaco.recursos.some(recurso => normalizarBusca(recurso.nome).includes(termo))
    return corresponde && (!filtros.bloco || espaco.bloco === filtros.bloco)
      && (!filtros.capacidade || String(espaco.capacidade) === filtros.capacidade)
      && (!filtros.recurso || espaco.recursos.some(recurso => recurso.nome === filtros.recurso))
  })
}
