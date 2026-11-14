// CARA PAKAI: salin file ini jadi  api/keys.local.js  lalu isi di antara tanda kutip.
// keys.local.js sudah masuk .gitignore, jadi TIDAK ikut ter-upload ke GitHub.
export default {
  // Claude (https://console.anthropic.com)
  ANTHROPIC_API_KEY: '',
  CLAUDE_MODEL: 'claude-sonnet-5-5',

  // Gateway WhatsApp OTP (contoh Fonnte, WA Blast, dll). Kontrak: POST {target, message}
  WA_API_URL: '',
  WA_API_TOKEN: '',

  // Provider text-to-image. Kontrak: POST {prompt} -> {image_base64}
  IMAGE_API_URL: '',
  IMAGE_API_TOKEN: '',

  // Provider video / face swap. Kontrak: POST {jobId, type, assetId, meta}
  VIDEO_API_URL: '',
  VIDEO_API_TOKEN: '',
};
