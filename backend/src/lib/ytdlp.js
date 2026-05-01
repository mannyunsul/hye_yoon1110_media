const { execFile } = require('child_process');
const { promisify } = require('util');
const fs = require('fs');
const os = require('os');
const path = require('path');

const execFileAsync = promisify(execFile);

function buildCookieFile(cookieString, domain) {
  const lines = ['# Netscape HTTP Cookie File'];
  cookieString.split(';').forEach(part => {
    const eqIdx = part.indexOf('=');
    if (eqIdx === -1) return;
    const name = part.slice(0, eqIdx).trim();
    const value = part.slice(eqIdx + 1).trim();
    if (!name) return;
    lines.push(`${domain}\tTRUE\t/\tFALSE\t2147483647\t${name}\t${value}`);
  });
  return lines.join('\n');
}

async function extractMedia(url, cookies = null) {
  const args = [
    '--dump-json',
    '--flat-playlist',
    '--no-playlist',
  ];

  let cookieFilePath = null;

  if (cookies) {
    const domain = url.includes('instagram.com') ? '.instagram.com' : '.x.com';
    const content = buildCookieFile(cookies, domain);
    cookieFilePath = path.join(os.tmpdir(), `yt_cookies_${Date.now()}.txt`);
    fs.writeFileSync(cookieFilePath, content, 'utf8');
    args.push('--cookies', cookieFilePath);
  }

  args.push(url);

  let stdout;
  try {
    ({ stdout } = await execFileAsync('yt-dlp', args, { timeout: 30000 }));
  } catch (err) {
    const stderr = err.stderr || '';
    console.error('[yt-dlp stderr]', stderr);
    throw new Error(`yt-dlp 실행 실패: ${stderr || err.message}`);
  } finally {
    if (cookieFilePath && fs.existsSync(cookieFilePath)) {
      fs.unlinkSync(cookieFilePath);
    }
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
    if (item.url && (item.ext === 'mp4' || item.vcodec)) {
      media.push({ url: item.url, type: 'video', index: i });
      continue;
    }
    if (item.url) {
      media.push({ url: item.url, type: 'image', index: i });
    }
  }

  return media;
}

module.exports = { extractMedia };
