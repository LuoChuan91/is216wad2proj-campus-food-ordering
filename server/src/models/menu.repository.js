// Menu data. The ONLY file that queries menu_items, menu_category, option_groups and options.
const supabase = require('../common/supabase');

// One menu item with its option groups, and each group's options, nested.
// menu_items has no store_id of its own: a dish belongs to a menu_category, and the
// category belongs to a store. We fetch the category's store_id and put it on the dish,
// so the rest of the app can just use item.store_id.
//
// Returns { id, name, price, available, is_archived, ..., store_id,
//           option_groups: [{ id, name, type, required, min_select, max_select,
//                             options: [{ id, name, price_delta, available }] }] }
// or null when no dish has this id.
exports.findItemWithOptions = async (itemId) => {
  const { data, error } = await supabase
    .from('menu_items')
    .select('*, menu_category(store_id), option_groups(*, options(*))')
    .eq('id', itemId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  const { menu_category, ...item } = data;
  return { ...item, store_id: menu_category ? menu_category.store_id : null };
};
