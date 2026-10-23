const express = require('express');
const errorHandler = require('./common/errorHandler');

const app = express();

app.use(express.json());

app.get('/api/health', (req, res) => {
  res.json({ ok: true });
});

// One line per feature folder
app.use('/api/stores', require('./routes/stores.routes'));
app.use('/api/menu', require('./routes/menu.routes'));
app.use('/api/orders', require('./routes/orders.routes'));
app.use('/api/deliveries', require('./routes/deliveries.routes'));
app.use('/api/profiles', require('./routes/profiles.routes'));
app.use('/api/venues', require('./routes/venues.routes'));
app.use('/api/destinations', require('./routes/destinations.routes'));

app.use(errorHandler);

module.exports = app;
