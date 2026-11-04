// Every call to our Express server, in one place. Vite forwards /api/... to localhost:3000.
import axios from 'axios'

const http = axios.create({ baseURL: '/api', timeout: 10000 })

let actorId = null
export const setActor = (id) => { actorId = id || null }
http.interceptors.request.use((req) => {
  if (actorId) req.headers['X-User-Id'] = actorId
  return req
})

// Turn the server's { error: "..." } into a normal Error with that message
http.interceptors.response.use(
  (res) => res.data,
  (err) => {
    const message = err.response && err.response.data && err.response.data.error
    const e = new Error(message || (err.response ? `Server error (${err.response.status})` : "Couldn't reach the server"))
    e.status = err.response ? err.response.status : 0
    return Promise.reject(e)
  },
)

export const api = {
  // things that rarely change
  profiles: (role) => http.get('/profiles', { params: { role } }),
  profile: (id) => http.get(`/profiles/${id}`),
  venues: () => http.get('/venues'),
  destinations: () => http.get('/destinations'),
  stores: () => http.get('/stores'),
  menu: () => http.get('/menu'),

  // live data
  studentOrders: (studentId) => http.get('/orders', { params: { student_id: studentId } }),
  previousOrders: (studentId) => http.get('/orders/previous', { params: { student_id: studentId } }),
  storeOrders: (storeId) => http.get('/orders', { params: { store_id: storeId } }),
  storeAnalytics: (storeId, from, to) => http.get(`/stores/${storeId}/analytics`, { params: { from, to } }),
  openJobs: () => http.get('/deliveries', { params: { status: 'open' } }),
  expiredJobs: () => http.get('/deliveries', { params: { status: 'expired' } }),
  myJobs: (courierId) => http.get('/deliveries', { params: { courier_id: courierId } }),
  riderLocation: (jobId) => http.get(`/deliveries/${jobId}/location`),
  deliveryChat: (jobId) => http.get(`/deliveries/${jobId}/chat`),

  // wait-time estimate engine (used by useWaitTime / waitTimeApi)
  ordersAhead: (storeId, orderId) =>
    http.get('/orders/orderAhead', { params: orderId ? { store_id: storeId, order_id: orderId } : { store_id: storeId } }),
  itemCookingDetails: (ids) => http.post('/menu/itemCookingDetails', { ids }),

  // changes
  placeOrder: (body) => http.post('/orders', body),
  setOrderStatus: (orderId, status) => http.patch(`/orders/${orderId}`, { status }),
  setItemAvailable: (itemId, available) => http.patch(`/menu/${itemId}`, { available }),
  updateStore: (storeId, changes) => http.patch(`/stores/${storeId}`, changes),
  updateMenuItem: (itemId, changes) => http.patch(`/menu/${itemId}`, changes),
  addMenuItem: (item) => http.post('/menu', item),
  removeMenuItem: (itemId) => http.delete(`/menu/${itemId}`),
  delivery: (jobId, action, courierId) => http.patch(`/deliveries/${jobId}`, { action, courier_id: courierId }),
  switchToPickup: (jobId, studentId) => http.patch(`/deliveries/${jobId}`, { action: 'switch_to_pickup', student_id: studentId }),
  shareLocation: (jobId, courierId, fix) => http.put(`/deliveries/${jobId}/location`, { courier_id: courierId, ...fix }),
  setProfileStatus: (id, status) => http.patch(`/profiles/${id}`, { status }),
  markPasswordSet: (id) => http.patch(`/profiles/${id}/password-set`),
  addVenue: (venue) => http.post('/venues', venue),
}
