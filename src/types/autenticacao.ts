export type PerfilUsuario = 'Administrador' | 'Coordenador' | 'Servidor' | 'Monitor' | 'Aluno'

export interface UsuarioAutenticado {
  id: number
  nome_completo: string
  cpf: string
  vinculo_institucional: string
  email: string
  perfil: PerfilUsuario
  ativo: boolean
}

export interface RespostaLogin {
  access_token: string
  token_type: string
  usuario: UsuarioAutenticado
}
