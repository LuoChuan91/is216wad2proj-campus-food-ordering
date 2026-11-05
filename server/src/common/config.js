// Business settings shared by the services. Change them here, not in the code.
module.exports = {
  DELIVERY_FEE: 0.8,          // dollars, paid by the student and kept by the student courier
  DELIVERY_WINDOW_MIN: 10,    // no courier within this many minutes -> the order switches to pickup, fee waived
  KITCHEN_SLOTS: 2,           // default workstations for a store that hasn't set stores.workstations
  WAIT_STRATEGIES: ['serial', 'scheduled'], // what a merchant may pick for stores.wait_strategy
  DEFAULT_WAIT_STRATEGY: 'scheduled', // used when a store row is missing wait_strategy
  CHAT_OPEN_AFTER_DELIVERY_MIN: 15,
};
