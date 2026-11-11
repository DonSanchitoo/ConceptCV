import { useState } from 'react'
import type { Lang } from '../types'
import { LETTER_MODELS, type LetterModel } from '../templates/letterModels'
import { Modal, Segmented, cx } from '../ui/kit'

/** Banque de 30 modèles de lettres, classés par situation. */
export const LetterModelPicker = ({ lang: initial, current, onPick, onClose }: { lang: Lang; current?: string; onPick: (m: LetterModel) => void; onClose: () => void }) => {
  const [lang, setLang] = useState<Lang>(initial)
  const list = LETTER_MODELS.filter((m) => m.lang === lang)
  const groups = [...new Set(list.map((m) => m.group))]
  return (
    <Modal title="Choisir un modèle de lettre" onClose={onClose} wide>
      <Segmented value={lang} onChange={setLang} options={[{ value: 'fr', label: `Français (${LETTER_MODELS.filter((m) => m.lang === 'fr').length})` }, { value: 'en', label: `English (${LETTER_MODELS.filter((m) => m.lang === 'en').length})` }]} />
      {groups.map((g) => (
        <div key={g} className="model-group">
          <h4>{g}</h4>
          <div className="model-grid">
            {list
              .filter((m) => m.group === g)
              .map((m) => (
                <button key={m.id} className={cx('model', current === m.id && 'on')} onClick={() => onPick(m)}>
                  <b>{m.name}</b>
                  <span className="muted small">{m.when}</span>
                  <p>{m.paragraphs[0].text}</p>
                </button>
              ))}
          </div>
        </div>
      ))}
    </Modal>
  )
}
