
const supabase = require('../common/supabase');

exports.findItemWithOptions = async (itemId) => {
  const { data, error } = await supabase
    .from('menu_items')
    .select('*, option_groups(*, options(*))')
    .eq('id', itemId)
    .maybeSingle();

  if (error) throw error;
  return data; 
};
