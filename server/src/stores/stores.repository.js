// The ONLY file in this feature that talks to the database.
// TODO: replace the in-memory array with Supabase queries once the project is set up,
// e.g. supabase.from('stores').select('*').eq('id', id).single()

const stores = [
  { id: '1', venue_id: '1', name: 'Pasta Express', is_open: true, discount_pct: 10, max_parallel_cook: 3 },
  { id: '2', venue_id: '1', name: 'Chicken Rice', is_open: true, discount_pct: 0, max_parallel_cook: 2 },
];

exports.findAll = async ({ venueId } = {}) => {
  return venueId ? stores.filter((s) => s.venue_id === venueId) : stores;
};

exports.findById = async (id) => {
  return stores.find((s) => s.id === id) || null;
};

exports.update = async (id, changes) => {
  const store = stores.find((s) => s.id === id);
  Object.assign(store, changes);
  return store;
};
