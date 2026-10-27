// Business settings shared by the services. Change them here, not in the code.
module.exports = {
  DELIVERY_FEE: 1.5,          // dollars, paid by the student and kept by the student courier
  DELIVERY_WINDOW_MIN: 10,    // no courier within this many minutes -> the order switches to pickup, fee waived
  KITCHEN_SLOTS: 2,           // default workstations for a store that hasn't set stores.workstations
  WAIT_STRATEGIES: ['serial', 'scheduled'], // what a merchant may pick for stores.wait_strategy
};
