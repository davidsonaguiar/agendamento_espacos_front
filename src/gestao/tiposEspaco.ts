export interface EspacoApi {
  id: number
  nome: string
  descricao: string | null
  capacidade: number | null
  bloco: string | null
  disponibilidade: boolean
}

export interface CriarEspacoInput {
  nome: string
  descricao: string | null
  capacidade: number | null
  bloco: string | null
  disponibilidade: boolean
}
