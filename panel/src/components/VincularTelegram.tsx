import { useState } from 'react'
import { ejecutar } from '../data/ejecutar'
import { useAviso } from './Avisos'
import { Dialogo } from './Dialogo'

const BOT = 'moncopulli_registro_bot'

/** Cada usuario genera su propio código: nadie puede vincular su Telegram a la cuenta de otro. */
export function VincularTelegram({ correo, clase = 'btn btn-salir-cabecera' }: { correo: string; clase?: string }) {
  const [codigo, setCodigo] = useState<string | null>(null)
  const [generando, setGenerando] = useState(false)
  const avisar = useAviso()

  async function generar() {
    setGenerando(true)
    try {
      setCodigo(await ejecutar<string>('fn_generar_codigo_telegram'))
    } catch (e) {
      avisar(e instanceof Error ? e.message : 'No se pudo generar el código.')
    } finally {
      setGenerando(false)
    }
  }

  return (
    <>
      <button type="button" className={clase} disabled={generando} onClick={() => void generar()}>
        {generando ? 'Generando…' : 'Vincular Telegram'}
      </button>
      {codigo && (
        <Dialogo titulo="Vincular tu Telegram" onCerrar={() => setCodigo(null)}>
          <p className="codigo-telegram" aria-label={`Código ${codigo.split('').join(' ')}`}>{codigo}</p>
          <p>En Telegram abre @{BOT} y envía:</p>
          <p><code>/vincular {correo} {codigo}</code></p>
          <p className="muted">Vale 10 minutos y admite 3 intentos. Si vence, genera otro.</p>
        </Dialogo>
      )}
    </>
  )
}
