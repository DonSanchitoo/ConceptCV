import { useMemo, useState } from 'react'
import { Check, ShieldCheck } from 'lucide-react'
import type { CvDoc, Profile } from '../types'
import { CV_TEMPLATES, type CvTemplate, type TemplateCategory } from '../templates/cvTemplates'
import { CvDocument } from '../render/CvDocument'
import { Modal, cx } from '../ui/kit'
import { FitPage } from '../ui/FitPage'
import { newCv } from '../lib/factory'
import { sampleProfile } from '../templates/sample'

const CATS: ('Tous' | TemplateCategory)[] = ['Tous', 'ATS', 'Classique', 'Moderne', 'Minimal', 'Créatif']

const hasContent = (p: Profile) => p.sections.some((s) => s.items.length > 0 || s.text) && !!p.basics.lastName

/** Les 30 modèles, rendus avec le contenu réel de l'utilisateur (ou un exemple si le profil est vide). */
export const TemplateGallery = ({ title, current, source, onPick, onClose, header }: { title: string; current?: string; header?: React.ReactNode; source: Profile | CvDoc; onPick: (t: CvTemplate) => void; onClose: () => void }) => {
  const [cat, setCat] = useState<(typeof CATS)[number]>('Tous')
  const base = useMemo<CvDoc>(() => {
    if ('kind' in source) return source
    return newCv(hasContent(source) ? source : sampleProfile(), 'atlas', 'fr', '')
  }, [source])
  const list = CV_TEMPLATES.filter((t) => cat === 'Tous' || t.category === cat)
  return (
    <Modal title={title} onClose={onClose} wide>
      {header}
      <div className="chips-row">
        {CATS.map((c) => (
          <button key={c} className={cx('pill', cat === c && 'on')} onClick={() => setCat(c)}>
            {c}
          </button>
        ))}
      </div>
      <div className="tpl-grid">
        {list.map((t) => (
          <button key={t.id} className={cx('tpl', current === t.id && 'on')} onClick={() => onPick(t)}>
            <div className="tpl-thumb">
              <FitPage className="tpl-zoom">
                <CvDocument cv={{ ...base, design: { ...t.design, showPhoto: t.design.showPhoto && !!base.basics.photo } }} paginate={false} />
              </FitPage>
              {current === t.id && <span className="tpl-check"><Check /></span>}
            </div>
            <div className="tpl-meta">
              <b>{t.name}</b>
              {t.design.layout === 'single' && <span className="badge ok" title="Une colonne : lecture ATS la plus fiable"><ShieldCheck /> ATS</span>}
            </div>
            <span className="tpl-tag">{t.tagline}</span>
          </button>
        ))}
      </div>
    </Modal>
  )
}
