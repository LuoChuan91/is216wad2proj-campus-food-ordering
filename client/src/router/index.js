import { createRouter, createWebHistory } from 'vue-router'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    // TODO: ... add ur routes
    {
      path: '/orders/:orderId/track',
      name: 'order-tracking',
      component: () => import('../views/OrderTrackingView.vue'),
    },
    {
      path: '/notifications',
      name: 'notifications',
      component: () => import('../views/NotificationsView.vue'),
    },
    {
    path: '/:pathMatch(.*)*',
    name: 'not-found',
    component: () => import('../views/NotFoundView.vue')
    }
  ],
})

// Navigation Guard (Example: Checking for Authentication) 
// TODO: change to out actual one???
router.beforeEach((to, from, next) => {
  const isAuthenticated = !!localStorage.getItem('user_token') 

  if (to.meta.requiresAuth && !isAuthenticated) {
    // Redirect unauthenticated users to the home page
    next({ name: 'home' })
  } else {
    // Always allow the navigation to proceed if checks pass
    next()
  }
})

export default router
