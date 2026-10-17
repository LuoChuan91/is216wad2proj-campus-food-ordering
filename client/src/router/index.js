import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '../views/HomeView.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      component: HomeView,
    },
    {
      path: '/about',
      name: 'about',
      // route level code-splitting
      // this generates a separate chunk (About.[hash].js) for this route
      // which is lazy-loaded when the route is visited.
      component: () => import('../views/AboutView.vue'),
    },
    // TODO: ... add ur routes
    {
      path: '/store/:storeId',
      name: 'store',
      component: () => import('../views/StoreView.vue'),
    },
    {
      path: '/orders/:orderId/track',
      name: 'order-tracking',
      component: () => import('../views/OrderTrackingView.vue'),
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
