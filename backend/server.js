const express = require('express');
const app = express();
const PORT = 5000;

app.get('/api/status', (req, res) => {
  res.json({ status: 'Backend server is running' });
});

app.listen(PORT, () => {
  console.log(`Backend server listening on port ${PORT}`);
});
