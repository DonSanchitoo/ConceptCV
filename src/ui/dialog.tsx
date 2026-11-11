import { useEffect, useState } from 'react'
import { create } from 'zustand'

interface DialogReq {
  title: string
  message?: string
  ok?: string
  cancel?: string
  danger?: boolean
  input?: { value: string; placeholder?: string }
  resolve: (v: boolean | string | null) => void
}

const useDialog = create<{ req: DialogReq | null }>(() => ({ req: null }))

export const confirmDialog = (o: Omit<DialogReq, 'resolve' | 'input'>): Promise<boolean> =>
  new Promise((resolve) => useDialog.setState({ req: { ...o, resolve: (v) => resolve(v === true) } }))

export const promptDialog = (o: Omit<DialogReq, 'resolve' | 'input'> & { value?: string; placeholder?: string }): Promise<string | null> =>
  new Promise((resolve) =>
    useDialog.setState({
      req: { ...o, input: { value: o.value ?? '', placeholder: o.placeholder }, resolve: (v) => resolve(typeof v === 'string' ? v : null) },
    }),
  )

export const DialogHost = () => {
  const req = useDialog((s) => s.req)
  const [value, setValue] = useState('')
  useEffect(() => setValue(req?.input?.value ?? ''), [req])
  if (!req) return null
  const close = (v: boolean | string | null) => {
    useDialog.setState({ req: null })
    req.resolve(v)
  }
  const ok = () => close(req.input ? value.trim() || null : true)
  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && close(req.input ? null : false)}>
      <form
        className="dialog"
        onSubmit={(e) => {
          e.preventDefault()
          ok()
        }}
      >
        <h3>{req.title}</h3>
        {req.message && <p>{req.message}</p>}
        {req.input && <input autoFocus className="input" value={value} placeholder={req.input.placeholder} onChange={(e) => setValue(e.target.value)} />}
        <div className="dialog-actions">
          <button type="button" className="btn ghost" onClick={() => close(req.input ? null : false)}>
            {req.cancel ?? 'Annuler'}
          </button>
          <button type="submit" className={`btn ${req.danger ? 'danger' : 'primary'}`} autoFocus={!req.input}>
            {req.ok ?? 'OK'}
          </button>
        </div>
      </form>
    </div>
  )
}
