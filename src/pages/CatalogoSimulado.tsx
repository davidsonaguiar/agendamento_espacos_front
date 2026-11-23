import { useMemo, useState } from 'react'
import { CartaoLaboratorio } from '../components/CartaoLaboratorio'
import { Cabecalho } from '../components/Cabecalho'
import { laboratoriosFicticios } from '../data/laboratorios'

function normalizar(texto: string) {
  return texto.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLocaleLowerCase('pt-BR')
}

export function CatalogoSimulado() {
  const [busca, setBusca] = useState('')
  const [blocoSelecionado, setBlocoSelecionado] = useState('')
  const [capacidadeSelecionada, setCapacidadeSelecionada] = useState('')
  const [equipamentoSelecionado, setEquipamentoSelecionado] = useState('')
  const [tipoSelecionado, setTipoSelecionado] = useState('')

  const blocos = [...new Set(laboratoriosFicticios.map((lab) => lab.bloco))].sort()
  const capacidades = [...new Set(laboratoriosFicticios
    .map((lab) => lab.capacidade)
    .filter((capacidade): capacidade is number => capacidade !== null))].sort((a, b) => a - b)
  const equipamentos = [...new Set(laboratoriosFicticios.flatMap((lab) => lab.equipamentos))].sort()
  const tiposDeUso = [...new Set(laboratoriosFicticios.flatMap((lab) => lab.tiposDeUso))].sort()

  const laboratoriosFiltrados = useMemo(() => {
    const termo = normalizar(busca.trim())
    return laboratoriosFicticios.filter((lab) => {
      const nomeCorresponde = normalizar(lab.nome).includes(termo)
      const blocoCorresponde = !blocoSelecionado || lab.bloco === blocoSelecionado
      const capacidadeCorresponde = !capacidadeSelecionada || String(lab.capacidade) === capacidadeSelecionada
      const equipamentoCorresponde = !equipamentoSelecionado || lab.equipamentos.includes(equipamentoSelecionado)
      const tipoCorresponde = !tipoSelecionado || lab.tiposDeUso.includes(tipoSelecionado)
      return nomeCorresponde && blocoCorresponde && capacidadeCorresponde && equipamentoCorresponde && tipoCorresponde
    })
  }, [busca, blocoSelecionado, capacidadeSelecionada, equipamentoSelecionado, tipoSelecionado])

  const quantidadeDisponivel = laboratoriosFicticios.filter((lab) => lab.disponivel).length
  const percentualDisponivel = laboratoriosFicticios.length
    ? Math.round(quantidadeDisponivel / laboratoriosFicticios.length * 100)
    : 0

  return (
    <>
      <Cabecalho />
      <main className="page-shell">
        <section className="page-intro" aria-labelledby="catalog-title">
          <h1 id="catalog-title">Encontre o laboratório ideal</h1>
          <p>Pesquise, filtre e escolha o espaço adequado para sua atividade acadêmica.</p>
        </section>

        <section className="catalog-summary" aria-label="Resumo dos laboratórios">
          <div>
            <h2>{laboratoriosFicticios.length} laboratórios cadastrados</h2>
            <p>{quantidadeDisponivel} espaços disponíveis para novas solicitações.</p>
          </div>
          <span className="catalog-summary__badge">
            <span className="catalog-summary__dot" aria-hidden="true" />
            {percentualDisponivel}% disponíveis
          </span>
        </section>

        <section className="catalog-controls" aria-label="Pesquisa e filtros">
          <label className="search-field">
            <svg aria-hidden="true" viewBox="0 0 24 24" fill="none">
              <circle cx="10.8" cy="10.8" r="7.3" stroke="currentColor" strokeWidth="1.8" />
              <path d="m16.2 16.2 5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
            <input
              type="search"
              aria-label="Buscar laboratório por nome"
              placeholder="Buscar laboratório por nome"
              value={busca}
              onChange={(event) => setBusca(event.target.value)}
            />
          </label>
          <label className="filter-field">
            <span className="visually-hidden">Filtrar por bloco ou prédio</span>
            <select value={blocoSelecionado} onChange={(event) => setBlocoSelecionado(event.target.value === '__todos__' ? '' : event.target.value)}>
              <option value="" disabled hidden>Bloco / Prédio</option>
              <option value="__todos__">Todos os blocos</option>
              {blocos.map((bloco) => <option key={bloco} value={bloco}>{bloco}</option>)}
            </select>
          </label>
          <label className="filter-field">
            <span className="visually-hidden">Filtrar por capacidade</span>
            <select value={capacidadeSelecionada} onChange={(event) => setCapacidadeSelecionada(event.target.value === '__todos__' ? '' : event.target.value)}>
              <option value="" disabled hidden>Capacidade</option>
              <option value="__todos__">Todas as capacidades</option>
              {capacidades.map((capacidade) => <option key={capacidade} value={capacidade}>{capacidade} pessoas</option>)}
            </select>
          </label>
          <label className="filter-field">
            <span className="visually-hidden">Filtrar por equipamento</span>
            <select value={equipamentoSelecionado} onChange={(event) => setEquipamentoSelecionado(event.target.value === '__todos__' ? '' : event.target.value)}>
              <option value="" disabled hidden>Equipamentos</option>
              <option value="__todos__">Todos os equipamentos</option>
              {equipamentos.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>
          <label className="filter-field">
            <span className="visually-hidden">Filtrar por tipo de uso</span>
            <select value={tipoSelecionado} onChange={(event) => setTipoSelecionado(event.target.value === '__todos__' ? '' : event.target.value)}>
              <option value="" disabled hidden>Tipo de uso</option>
              <option value="__todos__">Todos os tipos</option>
              {tiposDeUso.map((tipo) => <option key={tipo} value={tipo}>{tipo}</option>)}
            </select>
          </label>
        </section>

        {laboratoriosFiltrados.length ? (
          <section className="lab-grid" aria-label="Laboratórios">
            {laboratoriosFiltrados.map((lab) => <CartaoLaboratorio key={lab.id} laboratorio={lab} />)}
          </section>
        ) : (
          <p className="empty-state" role="status">Nenhum laboratório encontrado.</p>
        )}
      </main>
    </>
  )
}
