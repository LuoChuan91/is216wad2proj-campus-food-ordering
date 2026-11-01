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
    .select('*, menu_category(store_id, name), option_groups(*, options(*))')
    .eq('id', itemId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  const { menu_category, ...item } = data;
  return { ...item, store_id: menu_category ? menu_category.store_id : null, category: menu_category ? menu_category.name : null };
};

// A store's category with this name (case-insensitive), or null
exports.findCategory = async (storeId, name) => {
  const { data, error } = await supabase
    .from('menu_category')
    .select('*')
    .eq('store_id', storeId)
    .ilike('name', name.replace(/[\\%_]/g, '\\$&'))
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data;
};

exports.createCategory = async (storeId, name) => {
  const { data, error } = await supabase.from('menu_category').insert({ store_id: storeId, name }).select().single();

  if (error) throw error;
  return data;
};

exports.createItem = async (fields) => {
  const { data, error } = await supabase.from('menu_items').insert(fields).select('id').single();

  if (error) throw error;
  return data;
};

// Every dish still on a menu (not archived), with its store_id, its category name and its
// option groups. Pass storeId to get one store's menu only.
// Returns [{ ...menu item, store_id, category, option_groups: [{ ..., options: [...] }] }]
exports.findAll = async ({ storeId } = {}) => {
  let query = supabase
    .from('menu_items')
    .select('*, menu_category!inner(store_id, name), option_groups(*, options(*))')
    .eq('is_archived', false)
    .order('name');
  if (storeId) query = query.eq('menu_category.store_id', storeId);

  const { data, error } = await query;
  if (error) throw error;
  return data.map(({ menu_category, ...item }) => ({ ...item, store_id: menu_category.store_id, category: menu_category.name }));
};

// What the wait-time engine needs for every dish: how long one batch takes and how many fit in a batch.
// Returns [{ id, store_id, cook_time_sec, max_at_once, available }]
exports.findCookDetails = async () => {
  const { data, error } = await supabase
    .from('menu_items')
    .select('id, cook_time_sec, max_at_once, available, menu_category!inner(store_id)')
    .eq('is_archived', false)
    .order('name');

  if (error) throw error;
  return data.map(({ menu_category, ...item }) => ({ ...item, store_id: menu_category.store_id }));
};

// Change a dish, e.g. { available: false } when it sells out. Returns the saved row, or null.
exports.updateItem = async (itemId, changes) => {
  const { data, error } = await supabase.from('menu_items').update(changes).eq('id', itemId).select().maybeSingle();

  if (error) throw error;
  return data;
};

// The names of the given options, e.g. to show what a student picked on an order.
// order_items.selected_options only stores option ids, so the merchant screen needs this.
// Returns [{ id, name }], one per id that exists.
exports.findOptionNames = async (optionIds) => {
  if (optionIds.length === 0) return [];

  const { data, error } = await supabase.from('options').select('id, name').in('id', optionIds);

  if (error) throw error;
  return data;
};

// Angel: cooking details (cook time, max at once) for the given dishes
exports.itemsCookingDetails = async (item_ids) => {
  // retrieve orders from a store that is created earlier then requested order
  // retrieve all if requested order is null
  const { data, error } = await supabase
    .from("menu_items")
    .select('id,cook_time_sec,max_at_once')
    .in("id", item_ids);

  if (error) throw error;
  return data;
};
