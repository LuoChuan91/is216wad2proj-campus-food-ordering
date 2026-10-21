// Business settings shared by the services. Change them here, not in the code.
module.exports = {
  DELIVERY_FEE: 1.5,          // dollars, paid by the student and kept by the student courier
  DELIVERY_WINDOW_MIN: 10,    // no courier within this many minutes -> the order switches to pickup, fee waived
  KITCHEN_SLOTS: 2,           // dishes a kitchen cooks at the same time (stores has no column for this yet)
};
