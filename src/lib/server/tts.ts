import 'server-only';

// Optional neural server-side voice (Azure AI Speech). It has natural Uzbek voices, which browsers
// usually lack. The client falls back to browser speech synthesis when this is not configured.
const VOICES: Record<string, { male: string; female: string; tag: string }> = {
  uz: { male: 'uz-UZ-SardorNeural', female: 'uz-UZ-MadinaNeural', tag: 'uz-UZ' },
  ru: { male: 'ru-RU-DmitryNeural', female: 'ru-RU-SvetlanaNeural', tag: 'ru-RU' },
  en: { male: 'en-US-AndrewNeural', female: 'en-US-AvaNeural', tag: 'en-US' },
};

export const ttsEnabled = () => !!(process.env.AZURE_SPEECH_KEY && process.env.AZURE_SPEECH_REGION);

const xml = (s: string) => s.replace(/[<>&'"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' })[c]!);

export async function synthesize(text: string, lang: string, gender: 'male' | 'female', rate = 1): Promise<ArrayBuffer> {
  const v = VOICES[lang] ?? VOICES.uz;
  const ssml = `<speak version="1.0" xml:lang="${v.tag}"><voice name="${v[gender]}"><prosody rate="${Math.round((rate - 1) * 100)}%">${xml(text)}</prosody></voice></speak>`;
  const r = await fetch(`https://${process.env.AZURE_SPEECH_REGION}.tts.speech.microsoft.com/cognitiveservices/v1`, {
    method: 'POST',
    headers: {
      'Ocp-Apim-Subscription-Key': process.env.AZURE_SPEECH_KEY!,
      'Content-Type': 'application/ssml+xml',
      'X-Microsoft-OutputFormat': 'audio-24khz-48kbitrate-mono-mp3',
      'User-Agent': 'ai-teacher',
    },
    body: ssml,
    signal: AbortSignal.timeout(15_000),
  });
  if (!r.ok) throw new Error(`TTS ${r.status}`);
  return r.arrayBuffer();
}
