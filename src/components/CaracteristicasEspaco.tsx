interface CaracteristicasEspacoProps {
  bloco: string | null
  capacidade: number | null
  destaque?: boolean
}

export function CaracteristicasEspaco({ bloco, capacidade, destaque = false }: CaracteristicasEspacoProps) {
  return <dl className={`space-facts${destaque ? ' space-facts--featured' : ''}`}>
    <div className="space-facts__item">
      <svg aria-hidden="true" viewBox="0 0 20 20" fill="none"><path d="M16 8.3c0 4.1-6 9-6 9s-6-4.9-6-9a6 6 0 1 1 12 0Z" stroke="currentColor" strokeWidth="1.6" /><circle cx="10" cy="8" r="2" stroke="currentColor" strokeWidth="1.6" /></svg>
      <div><dt>Localização · Bloco</dt><dd>{bloco?.trim() || 'Localização não informada.'}</dd></div>
    </div>
    <div className="space-facts__item">
      <svg aria-hidden="true" viewBox="0 0 20 20" fill="none"><circle cx="7" cy="6" r="3" stroke="currentColor" strokeWidth="1.6" /><path d="M1.8 17v-1.2A4.8 4.8 0 0 1 6.6 11h.8a4.8 4.8 0 0 1 4.8 4.8V17M13 3.4a3 3 0 0 1 0 5.8m1.2 2a4.8 4.8 0 0 1 4 4.7V17" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
      <div><dt>Capacidade</dt><dd>{capacidade === null ? 'Capacidade não informada.' : `${capacidade} pessoas`}</dd></div>
    </div>
  </dl>
}