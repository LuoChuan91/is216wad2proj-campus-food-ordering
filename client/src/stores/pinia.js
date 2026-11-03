// The one Pinia instance
import { createPinia, setActivePinia } from 'pinia'

export const pinia = createPinia()
setActivePinia(pinia)

export default pinia
