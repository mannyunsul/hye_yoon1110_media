const { execFile } = require('child_process');
const { promisify } = require('util');
const axios = require('axios');

const execFileAsync = promisify(execFile);

function pickUrl(item) {
  if (item.url) return item.url;
  if (Array.isArray(item.formats) && item.formats.length > 0) {
    const combined = item.formats.filter(
      f => f.url && f.vcodec && f.vcodec !== 'none' && f.acodec && f.acodec !== 'none'
    );
    if (combined.length > 0) return combined[combined.length - 1].url;
    const last = item.formats[item.formats.length - 1];
    return last.url || null;
  }
  return null;
}

async function extractInstagramImages(url, cookies) {
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'ko-KR,ko;q=0.9,en;q=0.8',
  };
  if (cookies) headers['Cookie'] = cookies;

  const { data: html } = await axios.get(url, { headers, timeout: 15000 });

  console.log('[instagram-image] html length:', html.length);
  const titleMatch = html.match(/<title>([^<]+)<\/title>/);
  console.log('[instagram-image] title:', titleMatch ? titleMatch[1] : 'none');
  console.log('[instagram-image] html sample:', html.substring(0, 500).replace(/\n/g, ' '));

  // property/content 순서 무관하게 매칭
  const pattern1 = [...html.matchAll(/<meta[^>]+property="og:image[^"]*"[^>]+content="([^"]+)"/g)];
  const pattern2 = [...html.matchAll(/<meta[^>]+content="([^"]+)"[^>]+property="og:image[^"]*"/g)];
  const images = [...pattern1, ...pattern2]
    .map(m => m[1].replace(/&amp;/g, '&'))
    .filter(u => u.startsWith('http'));

  console.log('[instagram-image] found', images.length, 'image(s)');

  if (images.length === 0) throw new Error('이미지를 찾을 수 없습니다.');

  return images.map((imgUrl, i) => ({ url: imgUrl, type: 'image', index: i }));
}

async function extractMedia(url, cookies = null) {
  const args = ['--dump-single-json'];

  if (cookies) {
    console.log('[yt-dlp] cookies received, length:', cookies.length);
    args.push('--add-header', `Cookie:${cookies}`);
  } else {
    console.log('[yt-dlp] no cookies provided');
  }

  args.push(url);

  let stdout;
  try {
    const result = await execFileAsync('yt-dlp', args, { timeout: 30000 });
    stdout = result.stdout;
  } catch (err) {
    const stderr = err.stderr || '';
    console.error('[yt-dlp stderr]', stderr);

    // 이미지 전용 포스트 → og:image fallback
    if (stderr.includes('There is no video in this post')) {
      console.log('[yt-dlp] image post detected, falling back to og:image extraction');
      return await extractInstagramImages(url, cookies);
    }

    throw new Error(`yt-dlp 실행 실패: ${stderr || err.message}`);
  }

  const rawItems = stdout
    .trim()
    .split('\n')
    .filter(Boolean)
    .map(line => { try { return JSON.parse(line); } catch { return null; } })
    .filter(Boolean);

  console.log('[yt-dlp] raw lines:', rawItems.length);

  const items = [];
  for (const item of rawItems) {
    if (item._type === 'playlist' && Array.isArray(item.entries)) {
      items.push(...item.entries.filter(Boolean));
    } else {
      items.push(item);
    }
  }

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
