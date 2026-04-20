require('dotenv').config();
const express = require('express');
const cors = require('cors');

const fetchRoute = require('./src/routes/fetch');
const proxyRoute = require('./src/routes/proxy');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.use('/api/fetch', fetchRoute);
app.use('/api/proxy', proxyRoute);
app.get('/api/health', (_, res) => res.json({ status: 'ok' }));

app.listen(PORT, () => {
  console.log(`Backend running → http://localhost:${PORT}`);
});
