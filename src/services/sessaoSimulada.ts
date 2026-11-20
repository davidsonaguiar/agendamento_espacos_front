import type { RespostaLogin, UsuarioAutenticado } from '../types/autenticacao'

const usuariosTeste: Array<{ identificacao: string; senha: string; usuario: UsuarioAutenticado }> = [
  {
    identificacao: 'professor@teste.local',
    senha: 'Professor123!',
    usuario: {
      id: 9001,
      nome_completo: 'Professor de Teste',
      cpf: '90000000001',
      vinculo_institucional: 'PROF-TESTE',
      email: 'professor@teste.local',
      perfil: 'Membro',
      ativo: true,
    },
  },
  {
    identificacao: 'gestor@teste.local',
    senha: 'Gestor123!',
    usuario: {
      id: 9002,
      nome_completo: 'Gestor de Teste',
      cpf: '90000000002',
      vinculo_institucional: 'GESTOR-TESTE',
      email: 'gestor@teste.local',
      perfil: 'Administrador',
      ativo: true,
    },
  },
]

export const simuladorLocalAtivo =
  typeof import.meta.env !== 'undefined' &&
  import.meta.env.DEV &&
  import.meta.env.VITE_LOCAL_SIMULATOR === 'true'

export function autenticarNoSimuladorLocal(identificacao: string, senha: string): RespostaLogin | null {
  const conta = usuariosTeste.find(usuario =>
    usuario.identificacao === identificacao.trim().toLocaleLowerCase('pt-BR') &&
    usuario.senha === senha,
  )
  if (!conta) return null

  const payload = btoa(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 8 * 60 * 60 }))
  return {
    access_token: `simulador.${payload}.local`,
    token_type: 'bearer',
    usuario: conta.usuario,
  }
}
