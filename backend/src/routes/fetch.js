const express = require('express');
const router = express.Router();
router.post('/', (req, res) => res.json({ stub: true }));
module.exports = router;
