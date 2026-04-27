const express = require('express');
const { extractMedia } = require('../lib/ytdlp');
const { detectPlatform } = require('../lib/platform');

const router = express.Router();

router.post('/', async (req, res) => {
  const { url, cookies } = req.body;

  if (!url || typeof url !== 'string' || !url.startsWith('http')) {
    return res.status(400).json({
      success: false,
      message: '올바른 URL을 입력해주세요.',
    });
  }

  const platform = detectPlatform(url);

  try {
    const media = await extractMedia(url, cookies || null);

    return res.json({
      success: true,
      platform,
      sourceUrl: url,
      media,
    });
  } catch (err) {
    console.error('[fetch error]', err.message);

    if (err.message.includes('yt-dlp 실행 실패')) {
      return res.status(500).json({
        success: false,
        message: '미디어 추출 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.',
      });
    }

    if (err.message.includes('찾을 수 없습니다')) {
      return res.status(404).json({
        success: false,
        message: '미디어를 찾을 수 없습니다. URL을 확인해주세요.',
      });
    }

    return res.status(500).json({
      success: false,
      message: `오류: ${err.message}`,
    });
  }
});

module.exports = router;
