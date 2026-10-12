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

app.use(errorHandler);

module.exports = app;
