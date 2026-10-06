const express = require('express');
const errorHandler = require('./common/errorHandler');

const app = express();

app.use(express.json());

app.get('/api/health', (req, res) => {
  res.json({ ok: true });
});

// One line per feature folder
app.use('/api/stores', require('./stores/stores.routes'));

app.use(errorHandler);

module.exports = app;
