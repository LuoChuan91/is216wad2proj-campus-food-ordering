// The one Pinia instance for the app.
//
// It is created and made active here (setActivePinia) so that the S/Q/A
// compatibility shim in stores/compat.js can resolve the stores at module-evaluation
// time, before any component mounts and before main.js calls app.use(pinia).
// main.js imports this same instance and registers it on the app, so the stores
// the shim uses and the stores the components use are the same singletons.
import { createPinia, setActivePinia } from 'pinia'

export const pinia = createPinia()
setActivePinia(pinia)

export default pinia
