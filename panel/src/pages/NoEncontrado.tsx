import { Link } from 'react-router-dom'

export function NoEncontrado() {
  return (
    <section>
      <h1>Página no encontrada</h1>
      <p>La dirección que buscas no existe.</p>
      <Link to="/" className="btn btn-primario">
        Volver al inicio
      </Link>
    </section>
  )
}
