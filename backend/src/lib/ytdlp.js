const { execFile } = require('child_process');
const { promisify } = require('util');

const execFileAsync = promisify(execFile);

function pickUrl(item) {
  if (item.url) return item.url;
  if (Array.isArray(item.formats) && item.formats.length > 0) {
    const best = item.formats[item.formats.length - 1];
    return best.url || null;
  }
  return null;
}

async function extractMedia(url, cookies = null) {
  const args = [
    '--dump-json',
    '--yes-playlist',
  ];

  if (cookies) {
    console.log('[yt-dlp] cookies received, length:', cookies.length);
    args.push('--add-header', `Cookie:${cookies}`);
  } else {
    console.log('[yt-dlp] no cookies provided');
  }

  args.push(url);

  let stdout;
  try {
    ({ stdout } = await execFileAsync('yt-dlp', args, { timeout: 30000 }));
  } catch (err) {
    const stderr = err.stderr || '';
    console.error('[yt-dlp stderr]', stderr);
    throw new Error(`yt-dlp 실행 실패: ${stderr || err.message}`);
  }

  const items = stdout
    .trim()
    .split('\n')
    .filter(Boolean)
    .map(line => { try { return JSON.parse(line); } catch { return null; } })
    .filter(Boolean);

  if (items.length === 0) throw new Error('미디어를 찾을 수 없습니다.');

  const media = [];
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const mediaUrl = pickUrl(item);
    if (!mediaUrl) continue;

    const isVideo = item.ext === 'mp4' || (item.vcodec && item.vcodec !== 'none');
    media.push({ url: mediaUrl, type: isVideo ? 'video' : 'image', index: i });
  }

  if (media.length === 0) throw new Error('미디어를 찾을 수 없습니다.');

  return media;
}

module.exports = { extractMedia };
