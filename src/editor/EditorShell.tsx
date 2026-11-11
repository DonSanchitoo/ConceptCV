import { useState, type ReactNode } from 'react'
import { ArrowLeft, Download, Eye, PencilLine, Redo2, Undo2 } from 'lucide-react'
import { useStore } from '../store'
import { Menu, cx } from '../ui/kit'
import { go } from '../lib/router'

export interface ExportAction {
  label: string
  hint: string
  run: () => void | Promise<void>
}

interface Props {
  appId: string
  name: string
  onRename: (v: string) => void
  badge?: ReactNode
  tabs: { id: string; label: string; icon: ReactNode }[]
  tab: string
  setTab: (t: string) => void
  panel: ReactNode
  preview: ReactNode
  exports: ExportAction[]
}

/** Cadre commun aux éditeurs de CV et de lettre : panneau à gauche, aperçu à droite, bascule sur mobile. */
export const EditorShell = ({ appId, name, onRename, badge, tabs, tab, setTab, panel, preview, exports }: Props) => {
  const [view, setView] = useState<'edit' | 'preview'>('edit')
  const canUndo = useStore((s) => s.past.length > 0)
  const canRedo = useStore((s) => s.future.length > 0)
  const { undo, redo } = useStore.getState()
  return (
    <div className={cx('editor', `view-${view}`)}>
      <header className="editor-bar">
        <button className="icon-btn" onClick={() => go(`/app/${appId}`)} aria-label="Retour">
          <ArrowLeft />
        </button>
        <input className="doc-name" value={name} onChange={(e) => onRename(e.target.value)} aria-label="Nom du document" />
        {badge}
        <div className="spacer" />
        <button className="icon-btn" disabled={!canUndo} onClick={undo} title="Annuler (Ctrl+Z)">
          <Undo2 />
        </button>
        <button className="icon-btn" disabled={!canRedo} onClick={redo} title="Rétablir (Ctrl+Maj+Z)">
          <Redo2 />
        </button>
        <Menu
          trigger={
            <button className="btn primary">
              <Download /> <span className="hide-s">Exporter</span>
            </button>
          }
        >
          {(close) =>
            exports.map((x) => (
              <button
                key={x.label}
                className="menu-item"
                onClick={() => {
                  close()
                  void x.run()
                }}
              >
                <b>{x.label}</b>
                <span>{x.hint}</span>
              </button>
            ))
          }
        </Menu>
      </header>
      <div className="editor-main">
        <aside className="editor-panel">
          <nav className="tabs">
            {tabs.map((t) => (
              <button key={t.id} className={cx(tab === t.id && 'on')} onClick={() => setTab(t.id)}>
                {t.icon}
                <span>{t.label}</span>
              </button>
            ))}
          </nav>
          <div className="panel-scroll">{panel}</div>
        </aside>
        <section className="editor-preview">{preview}</section>
      </div>
      <div className="view-switch">
        <button className={cx(view === 'edit' && 'on')} onClick={() => setView('edit')}>
          <PencilLine /> Éditer
        </button>
        <button className={cx(view === 'preview' && 'on')} onClick={() => setView('preview')}>
          <Eye /> Aperçu
        </button>
      </div>
    </div>
  )
}
