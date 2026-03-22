import { generateAIResponse } from "../../clients/aiClient.js";
import { buildSystemPrompt } from "../../prompts/brandMemory.js";

export async function finalizationAgent({ keyword, article, outline, evaluation }) {
  const system = buildSystemPrompt();

  const overallScore = evaluation?.scoreV1?.overallScore ?? '';
  const intent       = '';

  const prompt = `You are an SEO metadata writer. Generate publish-ready metadata for this article.

KEYWORD: "${keyword}"

ARTICLE (first 1500 chars for context):
${article.slice(0, 1500)}

OUTPUT RULES:
- Return ONLY valid JSON, no markdown, no explanation
- metaTitle: 50-60 chars, includes keyword naturally, not spammy
- metaDescription: 140-160 chars, summarizes value, includes keyword once
- slugSuggestion: lowercase, ASCII only, hyphenated, no Turkish special chars, 3-6 words max

Turkish char map for slug: a=a, b=b, c=c, d=d, e=e, f=f, g=g, h=h, i=i, j=j, k=k, l=l, m=m, n=n, o=o, p=p, r=r, s=s, t=t, u=u, v=v, y=y, z=z
Replace: ç->c, ğ->g, ı->i, ö->o, ş->s, ü->u

Example output:
{
  "metaTitle": "SEO Nedir? Arama Motoru Optimizasyonu Rehberi",
  "metaDescription": "SEO nedir sorusunun yanıtını bu rehberde bulabilirsiniz. Arama motoru optimizasyonunun temellerini, tekniklerini ve ipuçlarını öğrenin.",
  "slugSuggestion": "seo-nedir-arama-motoru-optimizasyonu"
}

Now generate for keyword "${keyword}":`;

  const t0  = Date.now();
  const res = await generateAIResponse({ system, prompt, maxTokens: 300 });

  let parsed;
  try {
    const cleaned = res.text.trim()
      .replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```$/i, '').trim();
    parsed = JSON.parse(cleaned);
  } catch {
    // Fallback: derive from keyword
    const slug = keyword.toLowerCase()
      .replace(/ç/g,'c').replace(/ğ/g,'g').replace(/ı/g,'i')
      .replace(/ö/g,'o').replace(/ş/g,'s').replace(/ü/g,'u')
      .replace(/[^a-z0-9\s-]/g,'').trim().replace(/\s+/g,'-');
    parsed = {
      metaTitle:       keyword.charAt(0).toUpperCase() + keyword.slice(1) + ' Hakkında Kapsamlı Rehber',
      metaDescription: keyword.charAt(0).toUpperCase() + keyword.slice(1) + ' konusunda ihtiyacınız olan tüm bilgileri bu rehberde bulabilirsiniz.',
      slugSuggestion:  slug,
    };
  }

  // Enforce constraints
  if (typeof parsed.metaTitle !== 'string')       parsed.metaTitle       = keyword;
  if (typeof parsed.metaDescription !== 'string') parsed.metaDescription = keyword;
  if (typeof parsed.slugSuggestion !== 'string')  parsed.slugSuggestion  = keyword.replace(/\s+/g,'-');

  // Hard-trim if LLM overshoots
  if (parsed.metaTitle.length > 65)       parsed.metaTitle       = parsed.metaTitle.slice(0, 62) + '...';
  if (parsed.metaDescription.length > 165) parsed.metaDescription = parsed.metaDescription.slice(0, 162) + '...';

  // Clean slug
  parsed.slugSuggestion = parsed.slugSuggestion
    .toLowerCase()
    .replace(/ç/g,'c').replace(/ğ/g,'g').replace(/ı/g,'i')
    .replace(/ö/g,'o').replace(/ş/g,'s').replace(/ü/g,'u')
    .replace(/[^a-z0-9-]/g,'').replace(/-+/g,'-').replace(/^-|-$/g,'');

  return {
    metaTitle:       parsed.metaTitle,
    metaDescription: parsed.metaDescription,
    slugSuggestion:  parsed.slugSuggestion,
    inputTokens:  res.inputTokens,
    outputTokens: res.outputTokens,
    durationMs:   res.durationMs ?? (Date.now() - t0),
    model:        res.model,
  };
}
