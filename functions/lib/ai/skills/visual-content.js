const PRESETS = {
  article_cover: { width: 1600, height: 900, label: 'Article cover 16:9' },
  social_post: { width: 1080, height: 1080, label: 'Instagram/Facebook post 1:1' },
  social_story: { width: 1080, height: 1920, label: 'Instagram/Facebook story 9:16' },
  social_carousel: { width: 1080, height: 1080, label: 'Carousel slide 1:1' },
  web_banner: { width: 1920, height: 768, label: 'Website banner' },
};

/**
 * Builds visual generation prompt contract.
 * @param {Object} params
 * @param {string} params.kind
 * @param {string} params.brief
 * @param {string} [params.overlayText]
 * @param {Record<string,string>} params.runtimeConfig
 * @returns {{prompt:string,negativePrompt:string,width:number,height:number,kind:string}}
 */
export function buildVisualContentPrompt({ kind, brief, overlayText = '', runtimeConfig }) {
  const preset = PRESETS[kind] || PRESETS.social_post;
  const promptProfile = runtimeConfig.ai_studio_prompt_profile || 'default';
  const tone = runtimeConfig.ai_copywriter_tone || 'quiet_luxury';

  const prompt = [
    `Bicom Pisek brand visual, style profile: ${promptProfile}, tone: ${tone}.`,
    `Output type: ${preset.label}.`,
    'Visual direction: quiet luxury, elegant, natural light, warm but professional wellness atmosphere.',
    'No medical claims, no hospital/clinical setting, no pseudoscience motifs.',
    `Creative brief: ${brief}`,
    overlayText ? `Intended overlay text context (do not render text into image): ${overlayText}` : '',
  ].filter(Boolean).join(' ');

  const negativePrompt = [
    'text artifacts',
    'watermark',
    'logo',
    'blurry faces',
    'distorted hands',
    'medical diagnosis claims',
    'before-after treatment claims',
  ].join(', ');

  return {
    kind,
    prompt,
    negativePrompt,
    width: preset.width,
    height: preset.height,
  };
}

