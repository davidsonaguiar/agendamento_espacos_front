export type BookingStatus = 'Pendente' | 'Conflito de horário' | 'Aprovado' | 'Rejeitado';

export interface BookingRequest {
  id: string;
  userName: string;
  userRole: 'Professora' | 'Aluno' | 'Servidora';
  userInitials: string;
  date: string; // Formato DD/MM/AAAA
  timeSlot: string;
  purpose: string;
  participants: number;
  status: BookingStatus;
  labName: string;
}

export interface Responsible {
  id: string;
  name: string;
  email: string;
}

export interface LabItem {
  id: string;
  name: string;
  location: string;
  capacity: string;
  hours: string;
  rules: string;
  responsibles: Responsible[];
}

export const initialRequests: BookingRequest[] = [
  {
    id: '1',
    userName: 'Ana Beatriz Silva',
    userRole: 'Professora',
    userInitials: 'AB',
    date: '09/10/2026',
    timeSlot: '10:00–12:00',
    purpose: 'Aula prática',
    participants: 28,
    status: 'Pendente',
    labName: 'Laboratório de Informática 1'
  },
  {
    id: '2',
    userName: 'João Victor Lima',
    userRole: 'Aluno',
    userInitials: 'JV',
    date: '09/10/2026',
    timeSlot: '11:00–13:00',
    purpose: 'Projeto de Pesquisa',
    participants: 6,
    status: 'Conflito de horário',
    labName: 'Laboratório de Informática 1'
  },
  {
    id: '3',
    userName: 'Mariana Costa',
    userRole: 'Servidora',
    userInitials: 'MC',
    date: '10/10/2026',
    timeSlot: '14:00–16:00',
    purpose: 'Treinamento',
    participants: 18,
    status: 'Pendente',
    labName: 'Laboratório de Informática 1'
  },
  {
    id: '4',
    userName: 'Lucas Ferreira',
    userRole: 'Aluno',
    userInitials: 'LF',
    date: '13/10/2026',
    timeSlot: '08:00–10:00',
    purpose: 'Extensão',
    participants: 12,
    status: 'Pendente',
    labName: 'Laboratório de Informática 1'
  },
  {
    id: '5',
    userName: 'Carlos Eduardo',
    userRole: 'Professora',
    userInitials: 'CE',
    date: '02/10/2026',
    timeSlot: '08:00–10:00',
    purpose: 'Aula prática',
    participants: 30,
    status: 'Aprovado',
    labName: 'Laboratório de Informática 1'
  },
  {
    id: '6',
    userName: 'Fernanda Rocha',
    userRole: 'Aluno',
    userInitials: 'FR',
    date: '01/10/2026',
    timeSlot: '14:00–16:00',
    purpose: 'Projeto de Pesquisa',
    participants: 4,
    status: 'Rejeitado',
    labName: 'COLAB'
  }
];

export const initialLabs: LabItem[] = [
  {
    id: '1',
    name: 'Laboratório de Informática 1',
    location: 'Bloco A · Sala 102',
    capacity: '30 pessoas',
    hours: 'Seg-Sex, 08h às 18h',
    rules: '• Não consumir alimentos próximo aos equipamentos.\n• Manter o ambiente organizado após a utilização.\n• Respeitar a capacidade máxima e o horário reservado.',
    responsibles: [
      { id: 'r1', name: 'Carlos Henrique Souza', email: 'carlos.souza@ifs.edu.br' },
      { id: 'r2', name: 'Marina Alves Pereira', email: 'marina.pereira@ifs.edu.br' }
    ]
  },
  {
    id: '2',
    name: 'COLAB',
    location: 'Bloco C · Sala 201',
    capacity: '20 pessoas',
    hours: 'Seg-Sex, 08h às 20h',
    rules: '• Manter bancadas limpas e equipamentos organizados.',
    responsibles: [
      { id: 'r3', name: 'Roberto Lima', email: 'roberto.lima@ifs.edu.br' }
    ]
  },
  {
    id: '3',
    name: 'Lab. Eletrônica',
    location: 'Bloco B · Sala 08',
    capacity: '25 pessoas',
    hours: 'Seg-Sex, 08h às 17h',
    rules: '• Uso obrigatório de calçado fechado e EPIs.',
    responsibles: []
  },
  {
    id: '4',
    name: 'Lab. Redes',
    location: 'Bloco A · Sala 105',
    capacity: '15 pessoas',
    hours: 'Seg-Sex, 09h às 18h',
    rules: '• Acesso exclusivo para atividades de Redes e Infraestrutura.',
    responsibles: []
  }
];