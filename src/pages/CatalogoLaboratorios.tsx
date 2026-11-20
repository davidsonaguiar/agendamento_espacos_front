import { useState } from 'react'
import { Cabecalho } from '../components/Cabecalho'
import { CartaoEspaco } from '../components/CartaoEspaco'
import { useCatalogoEspacos } from '../hooks/useCatalogoEspacos'
import { filtrarEspacos } from '../data/catalogoEspacos'

export function CatalogoLaboratorios() {
  const { estado, tentarNovamente } = useCatalogoEspacos()
  const [busca, setBusca] = useState('')
  const [bloco, setBloco] = useState('')
  const [capacidade, setCapacidade] = useState('')
  const [recurso, setRecurso] = useState('')
  const espacos = estado.tipo === 'pronto' ? estado.espacos : []
  const blocos = [...new Set(espacos.flatMap(e => e.bloco?.trim() ? [e.bloco] : []))].sort()
  const capacidades = [...new Set(espacos.flatMap(e => e.capacidade === null ? [] : [e.capacidade]))].sort((a, b) => a - b)
  const recursos = [...new Set(espacos.flatMap(e => e.recursos.map(r => r.nome)))].sort()
  const filtrados = filtrarEspacos(espacos, { busca, bloco, capacidade, recurso })
  return <>
    <Cabecalho />
    <main className="page-shell">
      <section className="page-intro" aria-labelledby="catalog-title">
        <h1 id="catalog-title">Encontre o laboratório ideal</h1>
        <p>Pesquise pelo nome do laboratório ou de um recurso associado.</p>
      </section>
      {estado.tipo === 'carregando' ? <p className="empty-state" role="status">Carregando catálogo...</p>
        : estado.tipo === 'erro' ? <section className="empty-state" role="alert">
          <p>{estado.mensagem}</p>
          <button type="button" className="button button--primary" onClick={tentarNovamente}>Tentar novamente</button>
        </section> : <>
          <section className="catalog-summary" aria-label="Resumo do catálogo">
            <div><h2>{espacos.length} espaços no catálogo acessível à sua conta</h2>
              <p>A situação cadastral não representa disponibilidade de horários.</p></div>
          </section>
          <p className="catalog-data-note">Recursos indisponíveis também aparecem na busca, identificados nos resultados. A solicitação permanece vinculada ao laboratório.</p>
          <section className="catalog-controls catalog-controls--api" aria-label="Pesquisa e filtros">
            <label className="search-field"><span className="visually-hidden">Buscar laboratório ou recurso</span>
              <input type="search" placeholder="Laboratório ou recurso" value={busca} onChange={e => setBusca(e.target.value)} />
            </label>
            <label className="filter-field"><span className="visually-hidden">Filtrar por bloco</span>
              <select value={bloco} onChange={e => setBloco(e.target.value)}><option value="">Todos os blocos</option>
                {blocos.map(b => <option key={b} value={b}>{b}</option>)}
              </select>
            </label>
            <label className="filter-field"><span className="visually-hidden">Filtrar por capacidade</span>
              <select value={capacidade} onChange={e => setCapacidade(e.target.value)}><option value="">Todas as capacidades</option>
                {capacidades.map(c => <option key={c} value={c}>{c} pessoas</option>)}
              </select>
            </label>
            <label className="filter-field"><span className="visually-hidden">Filtrar por recurso associado</span>
              <select value={recurso} onChange={e => setRecurso(e.target.value)}><option value="">Todos os recursos</option>
                {recursos.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </label>
          </section>
          <p className="catalog-data-note">O filtro por tipo de uso não está disponível: essa informação não foi fornecida.</p>
          <p role="status">{filtrados.length} espaços encontrados.</p>
          {!espacos.length ? <p className="empty-state">Nenhum espaço retornado pela API para sua conta.</p>
            : !filtrados.length ? <div className="empty-state"><p>Nenhum laboratório corresponde à busca e aos filtros.</p>
              <button type="button" className="button" onClick={() => { setBusca(''); setBloco(''); setCapacidade(''); setRecurso('') }}>Limpar filtros</button>
            </div> : <section className="lab-grid" aria-label="Laboratórios">
              {filtrados.map(espaco => <CartaoEspaco key={espaco.id} espaco={espaco} />)}
            </section>}
        </>}
    </main>
  </>
}
