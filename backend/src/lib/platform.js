const PLATFORM_RULES = [
  { pattern: /instagram\.com/, name: 'instagram' },
  { pattern: /x\.com|twitter\.com/, name: 'x' },
  { pattern: /tiktok\.com/, name: 'tiktok' },
  { pattern: /youtube\.com|youtu\.be/, name: 'youtube' },
  { pattern: /facebook\.com|fb\.com/, name: 'facebook' },
];

function detectPlatform(url) {
  for (const rule of PLATFORM_RULES) {
    if (rule.pattern.test(url)) return rule.name;
  }
  return 'other';
}

module.exports = { detectPlatform };
