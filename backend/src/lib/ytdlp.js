const { execFile } = require('child_process');
const { promisify } = require('util');

const execFileAsync = promisify(execFile);

/**
 * yt-dlp로 URL에서 미디어 정보를 추출한다.
 * @param {string} url - SNS 게시물 URL
 * @returns {Promise<Array<{url: string, type: string, index: number}>>}
 */
async function extractMedia(url) {
  const args = [
    '--dump-json',
    '--flat-playlist',
    '--no-playlist',
    url,
  ];

  let stdout;
  try {
    ({ stdout } = await execFileAsync('yt-dlp', args, { timeout: 30000 }));
  } catch (err) {
    throw new Error(`yt-dlp 실행 실패: ${err.message}`);
  }

  const items = stdout
    .trim()
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      try { return JSON.parse(line); }
      catch { return null; }
    })
    .filter(Boolean);

  if (items.length === 0) throw new Error('미디어를 찾을 수 없습니다.');

  const media = [];

  for (let i = 0; i < items.length; i++) {
    const item = items[i];

    // 영상
    if (item.url && (item.ext === 'mp4' || item.vcodec)) {
      media.push({ url: item.url, type: 'video', index: i });
      continue;
    }

    // 이미지
    if (item.url) {
      media.push({ url: item.url, type: 'image', index: i });
    }
  }

  return media;
}

module.exports = { extractMedia };
