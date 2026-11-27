export type TemaLaboratorio = 'verde' | 'azul' | 'roxo' | 'laranja'

export interface Laboratorio {
  id: number
  nome: string
  resumo: string
  bloco: string
  sala: string
  capacidade: number | null
  disponivel: boolean
  equipamentos: string[]
  tiposDeUso: string[]
  tema: TemaLaboratorio
}
