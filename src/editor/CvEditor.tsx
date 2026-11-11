import { useCallback, useState } from 'react'
import { FileText, LayoutList, Palette, ShieldCheck, Target, UserRound } from 'lucide-react'
import type { Application, CvDoc } from '../types'
import { mutate, toast, updateApp, updateDoc, useStore } from '../store'
import { CvDocument } from '../render/CvDocument'
import { analyzeCv } from '../analysis/ats'
import { cvPlainText } from '../analysis/keywords'
import { clone, cloneSections, downloadBlob, fullName, slug, uid, nowIso } from '../lib/util'
import { distribute } from '../lib/factory'
import { getTemplate } from '../templates/cvTemplates'
import { printNode } from '../export/print'
import { cvToDocx } from '../export/docx'
import { confirmDialog } from '../ui/dialog'
import { Menu } from '../ui/kit'
import { EditorShell } from './EditorShell'
import { Preview } from './Preview'
import { ContentPanel, DesignPanel, StructurePanel } from './CvPanels'
import { AtsPanel } from './AtsPanel'
import { TemplateGallery } from './TemplateGallery'
import { TailorPanel } from './TailorPanel'

export const cvFileName = (cv: CvDoc, app: Application) => slug(['CV', fullName(cv.basics), app.company].filter(Boolean).join(' ')) || 'CV'

export const CvEditor = ({ app, cv }: { app: Application; cv: CvDoc }) => {
  const [tab, setTab] = useState('content')
  const [step, setStep] = useState('basics')
  const [pages, setPages] = useState(1)
  const [gallery, setGallery] = useState(false)
  const assistant = useStore((s) => s.db.settings.assistant !== false)
  const patch = useCallback((fn: (c: CvDoc) => void) => updateDoc<CvDoc>(app.id, cv.id, fn), [app.id, cv.id])
  const score = analyzeCv(cv, app.jobText, pages).score
  const file = cvFileName(cv, app)

  const openSection = (id: string) => {
    setTab('content')
    setStep(id)
    setTimeout(() => document.getElementById(`step-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60)
  }

  const saveToProfile = async () => {
    if (!(await confirmDialog({ title: 'Mettre à jour mon profil ?', message: 'Les coordonnées et les rubriques de ce CV remplacent celles du profil. Les prochains CV partiront de cette base.', ok: 'Mettre à jour' }))) return
    mutate((db) => {
      db.profile.basics = clone(cv.basics)
      db.profile.sections = cloneSections(cv.sections).sections
    })
    toast('Profil mis à jour.', 'ok')
  }
  const loadFromProfile = async () => {
    const profile = useStore.getState().db.profile
    if (!profile.sections.length) return toast('Votre profil est encore vide.', 'warn')
    if (!(await confirmDialog({ title: 'Reprendre le contenu du profil ?', message: 'Le contenu de ce CV est remplacé par celui du profil. Le design est conservé.', ok: 'Reprendre' }))) return
    patch((c) => {
      c.basics = clone(profile.basics)
      c.sections = cloneSections(profile.sections).sections
      Object.assign(c, distribute(c.sections))
    })
  }
  const atsCopy = () => {
    const copy: CvDoc = { ...clone(cv), id: uid(), name: `${cv.name} (version ATS)`, templateId: 'atlas', createdAt: nowIso(), updatedAt: nowIso() }
    copy.design = { ...getTemplate('atlas').design, accent: cv.design.accent, pageFormat: cv.design.pageFormat }
    updateApp(app.id, (a) => void a.docs.push(copy))
    toast('Version une colonne créée dans cette candidature.', 'ok')
  }

  const panel =
    tab === 'content' ? (
      <>
        <div className="panel-top">
          <Menu
            align="left"
            trigger={
              <button className="btn small">
                <UserRound /> Profil
              </button>
            }
          >
            {(close) => (
              <>
                <button className="menu-item" onClick={() => { close(); void saveToProfile() }}>
                  <b>Enregistrer ce CV comme profil</b>
                  <span>Sert de base aux prochains CV</span>
                </button>
                <button className="menu-item" onClick={() => { close(); void loadFromProfile() }}>
                  <b>Reprendre le contenu du profil</b>
                  <span>Remplace le contenu de ce CV</span>
                </button>
              </>
            )}
          </Menu>
          <span className="muted small">Cliquez aussi directement dans l’aperçu pour modifier un texte.</span>
        </div>
        <ContentPanel cv={cv} patch={patch} step={step} setStep={setStep} />
      </>
    ) : tab === 'design' ? (
      <DesignPanel cv={cv} patch={patch} onGallery={() => setGallery(true)} />
    ) : tab === 'tailor' && assistant ? (
      <TailorPanel cv={cv} app={app} patch={patch} onJobText={(v) => updateApp(app.id, (a) => void (a.jobText = v))} />
    ) : tab === 'structure' ? (
      <StructurePanel cv={cv} patch={patch} onOpen={openSection} />
    ) : (
      <AtsPanel
        cv={cv}
        jobText={app.jobText}
        onJobText={(v) => updateApp(app.id, (a) => void (a.jobText = v))}
        pages={pages}
        onSelectSection={openSection}
        extra={
          cv.design.layout !== 'single' ? (
            <button className="btn small" onClick={atsCopy}>
              <ShieldCheck /> Créer une version une colonne
            </button>
          ) : undefined
        }
      />
    )

  return (
    <>
      <EditorShell
        appId={app.id}
        name={cv.name}
        onRename={(v) => patch((c) => void (c.name = v))}
        badge={
          <button className={`score-chip ${score >= 80 ? 'good' : score >= 55 ? 'mid' : 'bad'}`} onClick={() => setTab('ats')} title="Score ATS">
            <ShieldCheck /> {score}
          </button>
        }
        tabs={[
          { id: 'content', label: 'Contenu', icon: <FileText /> },
          { id: 'design', label: 'Design', icon: <Palette /> },
          { id: 'structure', label: 'Structure', icon: <LayoutList /> },
          ...(assistant ? [{ id: 'tailor', label: 'Adapter', icon: <Target /> }] : []),
          { id: 'ats', label: 'Analyse', icon: <ShieldCheck /> },
        ]}
        tab={tab}
        setTab={setTab}
        panel={panel}
        preview={
          <Preview pageWidthMm={cv.design.pageFormat === 'Letter' ? 215.9 : 210} footer={<span className="pages">{pages} page{pages > 1 ? 's' : ''}</span>}>
            <CvDocument cv={cv} edit patch={patch} onPages={setPages} onSelectSection={tab === 'content' ? openSection : undefined} />
          </Preview>
        }
        exports={[
          { label: 'PDF', hint: 'Identique à l’aperçu, texte sélectionnable', run: () => printNode(<CvDocument cv={cv} />, file, cv.design.pageFormat) },
          {
            label: 'Word (.docx)',
            hint: 'Une colonne, modifiable, idéal pour les ATS',
            run: async () => {
              downloadBlob(await cvToDocx(cv), `${file}.docx`)
            },
          },
          { label: 'Texte brut (.txt)', hint: 'Pour les formulaires en ligne', run: () => downloadBlob(new Blob([cvPlainText(cv)], { type: 'text/plain;charset=utf-8' }), `${file}.txt`) },
        ]}
      />
      {gallery && (
        <TemplateGallery
          title="Changer de modèle"
          current={cv.templateId}
          source={cv}
          onClose={() => setGallery(false)}
          onPick={(t) => {
            patch((c) => {
              c.templateId = t.id
              c.design = { ...t.design, pageFormat: c.design.pageFormat, showPhoto: t.design.showPhoto && !!c.basics.photo }
            })
            setGallery(false)
          }}
        />
      )}
    </>
  )
}
