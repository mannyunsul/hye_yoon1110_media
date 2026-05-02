const { execFile } = require('child_process');
const { promisify } = require('util');
const fs = require('fs');
const os = require('os');
const path = require('path');
const axios = require('axios');

const execFileAsync = promisify(execFile);

function writeCookieFile(cookieStr) {
  const lines = ['# Netscape HTTP Cookie File'];
  const pairs = cookieStr.split(';').map(c => c.trim()).filter(Boolean);
  for (const pair of pairs) {
    const eqIdx = pair.indexOf('=');
    if (eqIdx === -1) continue;
    const name = pair.substring(0, eqIdx).trim();
    const value = pair.substring(eqIdx + 1).trim();
    // domain, include_subdomains, path, https_only, expiry, name, value
    lines.push(`.instagram.com\tTRUE\t/\tFALSE\t0\t${name}\t${value}`);
  }
  const tmpPath = path.join(os.tmpdir(), `yt_cookies_${Date.now()}.txt`);
  fs.writeFileSync(tmpPath, lines.join('\n') + '\n');
  return tmpPath;
}

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
  // 크롤러 UA로 요청해야 og:image가 포함된 SSR HTML을 받을 수 있음
  // 로그인 쿠키로 요청하면 React SPA(og:image 없음)를 반환
  const headers = {
    'User-Agent': 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)',
    'Accept': 'text/html,application/xhtml+xml',
  };

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
  const args = ['--dump-json'];

  let tmpCookieFile = null;
  if (cookies) {
    console.log('[yt-dlp] cookies received, length:', cookies.length);
    tmpCookieFile = writeCookieFile(cookies);
    args.push('--cookies', tmpCookieFile);
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
    if (stderr.includes('There is no video in this post') || stderr.includes('No video formats found')) {
      console.log('[yt-dlp] image post detected, falling back to og:image extraction');
      return await extractInstagramImages(url, cookies);
    }

    throw new Error(`yt-dlp 실행 실패: ${stderr || err.message}`);
  } finally {
    if (tmpCookieFile) {
      try { fs.unlinkSync(tmpCookieFile); } catch {}
    }
  }

  const rawItems = stdout
    .trim()
    .split('\n')
    .filter(Boolean)
    .map(line => { try { return JSON.parse(line); } catch { return null; } })
    .filter(Boolean);

  console.log('[yt-dlp] raw lines:', rawItems.length);
  if (rawItems.length > 0) {
    console.log('[yt-dlp] first item type:', rawItems[0]._type, 'entries:', Array.isArray(rawItems[0].entries) ? rawItems[0].entries.length : 'n/a');
  }

  // 이미지 캐러셀: yt-dlp가 에러 없이 빈 결과 반환 → og:image fallback
  if (rawItems.length === 0 && url.includes('instagram.com')) {
    console.log('[yt-dlp] empty output for Instagram, falling back to og:image extraction');
    return await extractInstagramImages(url, cookies);
  }

  const items = [];
  for (const item of rawItems) {
    if (item._type === 'playlist' && Array.isArray(item.entries)) {
      items.push(...item.entries.filter(Boolean));
    } else {
      items.push(item);
    }
  }

  if (items.length === 0) {
    if (url.includes('instagram.com')) {
      console.log('[yt-dlp] empty items for Instagram, falling back to og:image extraction');
      return await extractInstagramImages(url, cookies);
    }
    throw new Error('미디어를 찾을 수 없습니다.');
  }

  const media = [];
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const mediaUrl = pickUrl(item);
    if (!mediaUrl) continue;
    const isVideo = item.ext === 'mp4' || (item.vcodec && item.vcodec !== 'none');
    media.push({ url: mediaUrl, type: isVideo ? 'video' : 'image', index: i });
  }

  if (media.length === 0) {
    if (url.includes('instagram.com')) {
      console.log('[yt-dlp] no media urls for Instagram, falling back to og:image extraction');
      return await extractInstagramImages(url, cookies);
    }
    throw new Error('미디어를 찾을 수 없습니다.');
  }

  return media;
}

module.exports = { extractMedia };
