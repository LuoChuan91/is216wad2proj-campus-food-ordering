// Places on campus. The ONLY file that queries venues and delivery_destinations.
const supabase = require('../common/supabase');

exports.findAll = async () => {
  const { data, error } = await supabase.from('venues').select('*').order('name');

  if (error) throw error;
  return data;
};

exports.create = async (venue) => {
  const { data, error } = await supabase.from('venues').insert(venue).select().single();

  if (error) throw error;
  return data;
};

// Drop-off points for peer delivery (e.g. "Library Entrance Desk")
exports.findDestinations = async () => {
  const { data, error } = await supabase.from('delivery_destinations').select('*').order('name');

  if (error) throw error;
  return data;
};

exports.findDestinationById = async (id) => {
  const { data, error } = await supabase.from('delivery_destinations').select('*').eq('id', id).maybeSingle();

  if (error) throw error;
  return data;
};
