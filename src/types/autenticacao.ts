/** Perfis globais do backend dev. Coordenador e Monitor são papéis locais por espaço. */
export type PerfilUsuario = 'Administrador' | 'Membro'

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
  token_type: 'bearer'
  usuario: UsuarioAutenticado
}

export interface DadosCadastroMembro {
  nome_completo: string
  cpf: string
  vinculo_institucional: string
  email: string
  senha: string
}
