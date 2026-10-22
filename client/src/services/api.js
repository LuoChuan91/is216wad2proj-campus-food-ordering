// Every call to our Express server, in one place. Vite forwards /api/... to localhost:3000.
import axios from 'axios'

const http = axios.create({ baseURL: '/api', timeout: 10000 })

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
  waitTimes: () => http.get('/wait-times'),
  estimate: (storeId, items) => http.post('/wait-times/estimate', { store_id: storeId, items }),
  studentOrders: (studentId) => http.get('/orders', { params: { student_id: studentId } }),
  storeOrders: (storeId) => http.get('/orders', { params: { store_id: storeId } }),
  openJobs: () => http.get('/deliveries', { params: { status: 'open' } }),
  expiredJobs: () => http.get('/deliveries', { params: { status: 'expired' } }),
  myJobs: (courierId) => http.get('/deliveries', { params: { courier_id: courierId } }),

  // changes
  placeOrder: (body) => http.post('/orders', body),
  setOrderStatus: (orderId, status) => http.patch(`/orders/${orderId}`, { status }),
  setItemAvailable: (itemId, available) => http.patch(`/menu/${itemId}`, { available }),
  updateStore: (storeId, changes) => http.patch(`/stores/${storeId}`, changes),
  delivery: (jobId, action, courierId) => http.patch(`/deliveries/${jobId}`, { action, courier_id: courierId }),
  setProfileStatus: (id, status) => http.patch(`/profiles/${id}`, { status }),
  addVenue: (venue) => http.post('/venues', venue),
}
