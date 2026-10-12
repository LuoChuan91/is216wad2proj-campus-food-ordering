const supabase = require('../common/supabase');

exports.findAll = async ({ venueId } = {}) => {
  let query = supabase.from('stores').select('*').order('name');
  if (venueId) query = query.eq('venue_id', venueId);

  const { data, error } = await query;
  if (error) throw error;
  return data;
};