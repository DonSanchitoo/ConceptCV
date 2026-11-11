import type { CSSProperties, ReactNode } from 'react'
import { DndContext, PointerSensor, TouchSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical } from 'lucide-react'

export const useDndSensors = () =>
  useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }), useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 8 } }))

export const Handle = ({ id }: { id: string }) => {
  const { attributes, listeners, setActivatorNodeRef } = useSortable({ id })
  return (
    <button type="button" className="grip" ref={setActivatorNodeRef} {...attributes} {...listeners} aria-label="Déplacer">
      <GripVertical />
    </button>
  )
}

export const SortableRow = ({ id, children, className }: { id: string; children: ReactNode; className?: string }) => {
  const { setNodeRef, transform, transition, isDragging } = useSortable({ id })
  const style: CSSProperties = { transform: CSS.Translate.toString(transform), transition, zIndex: isDragging ? 5 : undefined }
  return (
    <div ref={setNodeRef} style={style} className={`${className ?? ''} ${isDragging ? 'dragging' : ''}`}>
      {children}
    </div>
  )
}

/** Liste réordonnable par glisser-déposer (souris et tactile). */
export const SortableList = ({ ids, onReorder, children }: { ids: string[]; onReorder: (ids: string[]) => void; children: ReactNode }) => {
  const sensors = useDndSensors()
  const onDragEnd = (e: DragEndEvent) => {
    if (!e.over || e.active.id === e.over.id) return
    const from = ids.indexOf(String(e.active.id))
    const to = ids.indexOf(String(e.over.id))
    if (from >= 0 && to >= 0) onReorder(arrayMove(ids, from, to))
  }
  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        {children}
      </SortableContext>
    </DndContext>
  )
}
