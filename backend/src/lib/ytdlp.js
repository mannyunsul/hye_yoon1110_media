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

function extractDisplayUrls(html) {
  // Instagram은 페이지 HTML 안에 JSON 데이터로 display_url을 포함시킴
  // 캐러셀의 각 이미지가 별도 display_url 항목으로 존재
  const seen = new Set();
  const images = [];
  const pattern = /"display_url"\s*:\s*"(https:[^"]+)"/g;
  for (const m of html.matchAll(pattern)) {
    const u = m[1]
      .replace(/\\\//g, '/')
      .replace(/\\u0026/g, '&')
      .replace(/\\u003A/g, ':')
      .replace(/\\u003F/g, '?')
      .replace(/\\u003D/g, '=');
    if (!seen.has(u) && (u.includes('cdninstagram') || u.includes('fbcdn'))) {
      seen.add(u);
      images.push(u);
    }
  }
  return images;
}

async function extractInstagramImages(url, cookies) {
  const headers = {
    'User-Agent': 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)',
    'Accept': 'text/html,application/xhtml+xml',
  };

  const { data: html } = await axios.get(url, { headers, timeout: 15000 });

  console.log('[instagram-image] html length:', html.length);

  // 1순위: 페이지 JSON에서 display_url 추출 (캐러셀 전체 이미지)
  const displayUrls = extractDisplayUrls(html);
  console.log('[instagram-image] display_url count:', displayUrls.length);
  if (displayUrls.length > 0) {
    return displayUrls.map((imgUrl, i) => ({ url: imgUrl, type: 'image', index: i }));
  }

  // 2순위: og:image fallback (단일 이미지)
  const pattern1 = [...html.matchAll(/<meta[^>]+property="og:image[^"]*"[^>]+content="([^"]+)"/g)];
  const pattern2 = [...html.matchAll(/<meta[^>]+content="([^"]+)"[^>]+property="og:image[^"]*"/g)];
  const ogImages = [...pattern1, ...pattern2]
    .map(m => m[1].replace(/&amp;/g, '&'))
    .filter(u => u.startsWith('http'));

  console.log('[instagram-image] og:image count:', ogImages.length);
  if (ogImages.length > 0) {
    return ogImages.map((imgUrl, i) => ({ url: imgUrl, type: 'image', index: i }));
  }

  throw new Error('이미지를 찾을 수 없습니다.');
}

async function extractMedia(url, cookies = null) {
  const args = ['--dump-json'];

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

    // Instagram: 어떤 오류든 이미지 추출로 fallback
    if (url.includes('instagram.com')) {
      console.log('[yt-dlp] Instagram yt-dlp failed, falling back to image extraction');
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
