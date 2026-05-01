const { execFile } = require('child_process');
const { promisify } = require('util');

const execFileAsync = promisify(execFile);

function pickUrl(item) {
  if (item.url) return item.url;
  if (Array.isArray(item.formats) && item.formats.length > 0) {
    // 비디오+오디오 합쳐진 포맷 우선
    const combined = item.formats.filter(
      f => f.url && f.vcodec && f.vcodec !== 'none' && f.acodec && f.acodec !== 'none'
    );
    if (combined.length > 0) return combined[combined.length - 1].url;
    const last = item.formats[item.formats.length - 1];
    return last.url || null;
  }
  return null;
}

async function extractMedia(url, cookies = null) {
  const args = [
    '--dump-json',
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

  const rawItems = stdout
    .trim()
    .split('\n')
    .filter(Boolean)
    .map(line => { try { return JSON.parse(line); } catch { return null; } })
    .filter(Boolean);

  console.log('[yt-dlp] raw lines:', rawItems.length);
  if (rawItems.length > 0) {
    const first = rawItems[0];
    console.log('[yt-dlp] first item _type:', first._type, '| has url:', !!first.url, '| has formats:', Array.isArray(first.formats));
  }

  // playlist 컨테이너면 entries로 펼치기
  const items = [];
  for (const item of rawItems) {
    if (item._type === 'playlist' && Array.isArray(item.entries)) {
      items.push(...item.entries.filter(Boolean));
    } else {
      items.push(item);
    }
  }

  console.log('[yt-dlp] items after flatten:', items.length);

  if (items.length === 0) throw new Error('미디어를 찾을 수 없습니다.');

  const media = [];
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const mediaUrl = pickUrl(item);
    if (!mediaUrl) {
      console.log('[yt-dlp] item', i, 'has no url, keys:', Object.keys(item).join(','));
      continue;
    }
    const isVideo = item.ext === 'mp4' || (item.vcodec && item.vcodec !== 'none');
    media.push({ url: mediaUrl, type: isVideo ? 'video' : 'image', index: i });
  }

  if (media.length === 0) throw new Error('미디어를 찾을 수 없습니다.');

  return media;
}

module.exports = { extractMedia };
