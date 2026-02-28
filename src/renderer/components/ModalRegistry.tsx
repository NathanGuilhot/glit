import NiceModal from '@ebay/nice-modal-react'
import { type ReactNode } from 'react'

export function ModalRegistry({ children }: { children: ReactNode }) {
  return <NiceModal.Provider>{children}</NiceModal.Provider>
}
