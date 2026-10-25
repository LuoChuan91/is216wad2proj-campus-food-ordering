// Account data. The ONLY file that queries profiles.
const supabase = require('../common/supabase');

const COLUMNS = 'id, role, name, email, status';

// Everyone, or only one role ('student', 'merchant' or 'admin'), sorted by name
exports.findAll = async ({ role } = {}) => {
  let query = supabase.from('profiles').select(COLUMNS).order('name');
  if (role) query = query.eq('role', role);

  const { data, error } = await query;
  if (error) throw error;
  return data;
};

exports.findById = async (id) => {
  const { data, error } = await supabase.from('profiles').select(COLUMNS).eq('id', id).maybeSingle();

  if (error) throw error;
  return data;
};

exports.update = async (id, changes) => {
  const { data, error } = await supabase.from('profiles').update(changes).eq('id', id).select(COLUMNS).maybeSingle();

  if (error) throw error;
  return data;
};
