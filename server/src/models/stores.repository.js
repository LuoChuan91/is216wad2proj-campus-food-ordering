const supabase = require('../common/supabase');

exports.findAll = async ({ venueId } = {}) => {
  let query = supabase.from('stores').select('*').order('name');
  if (venueId) query = query.eq('venue_id', venueId);

  const { data, error } = await query;
  if (error) throw error;
  return data;
};

exports.findById = async (id) => {
  const { data, error } = await supabase.from('stores').select('*').eq('id', id).maybeSingle();

  if (error) throw error;
  return data;
};

exports.update = async (id, changes) => {
  const { data, error} = await supabase.from('stores').update(changes).eq('id',id).select().maybeSingle();

  if (error) throw error;
  return data;
};
