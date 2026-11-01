export function orderStatusLabel(o) {
  if (o.status === 'completed') return o.delivery && !o.fallback ? 'Delivered' : 'Collected'
  if (o.status === 'ready' && o.delivery && o.delivery.status === 'picked_up') return 'On the way'
  return { pending: 'Pending', paid: 'In queue', preparing: 'Cooking', ready: 'Ready', cancelled: 'Cancelled' }[o.status] || o.status
}
