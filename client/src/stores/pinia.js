// The one Pinia instance for the app.
//
// It is created and made active here (setActivePinia) so the stores resolve at
// module-evaluation time, before any component mounts and before main.js calls
// app.use(pinia). main.js imports this same instance and registers it on the app,
// so every store is the same singleton.
import { createPinia, setActivePinia } from 'pinia'

export const pinia = createPinia()
setActivePinia(pinia)

export default pinia
