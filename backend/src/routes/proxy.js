const express = require('express');
const axios = require('axios');

const router = express.Router();

router.get('/', async (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).json({ error: 'url required' });

  try {
    const response = await axios.get(url, {
      responseType: 'stream',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Mobile Safari/537.36',
        'Referer': 'https://www.instagram.com/',
      },
      timeout: 60000,
    });

    res.set('Content-Type', response.headers['content-type'] || 'application/octet-stream');
    if (response.headers['content-length']) {
      res.set('Content-Length', response.headers['content-length']);
    }
    response.data.pipe(res);
  } catch (err) {
    console.error('[proxy error]', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
