import axios from 'axios';
import * as cheerio from 'cheerio';
import { z } from 'zod';
import Scan from '../models/Scan.js';

function validateUrl(input) {
  try {
    const parsed = new URL(input);
    return ['http:', 'https:'].includes(parsed.protocol);
  } catch {
    return false;
  }
}

const bodySchema = z.object({
  input: z.string().trim().min(1, 'Please enter a headline, article, or URL to verify.').max(12000),
  sourceType: z.enum(['article', 'headline', 'url']).default('article'),
  language: z.enum(['auto', 'en', 'te', 'hi', 'ur', 'ta', 'kn', 'ml', 'mr', 'bn', 'gu', 'pa']).default('auto')
}).superRefine((data, context) => {
  if (data.sourceType === 'article' && data.input.length < 20) {
    context.addIssue({ code: z.ZodIssueCode.too_small, minimum: 20, type: 'string', inclusive: true, message: 'Please provide a longer article or headline with enough information to verify.' });
  }
  if (data.sourceType === 'headline' && data.input.length < 3) {
    context.addIssue({ code: z.ZodIssueCode.too_small, minimum: 3, type: 'string', inclusive: true, message: 'Please enter at least 3 characters for a headline.' });
  }
  if (data.sourceType === 'url' && !validateUrl(data.input)) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: 'Please enter a valid news article URL.' });
  }
});

const ANALYSIS_VERSION = 8;

function detectLanguage(input, requestedLanguage) {
  if (requestedLanguage && requestedLanguage !== 'auto') return requestedLanguage;
  const scriptCounts = {
    te: (input.match(/[\u0c00-\u0c7f]/g) || []).length,
    hi: (input.match(/[\u0900-\u097f]/g) || []).length,
    ur: (input.match(/[\u0600-\u06ff]/g) || []).length,
    ta: (input.match(/[\u0b80-\u0bff]/g) || []).length,
    kn: (input.match(/[\u0c80-\u0cff]/g) || []).length,
    ml: (input.match(/[\u0d00-\u0d7f]/g) || []).length,
    bn: (input.match(/[\u0980-\u09ff]/g) || []).length,
    gu: (input.match(/[\u0a80-\u0aff]/g) || []).length,
    pa: (input.match(/[\u0a00-\u0a7f]/g) || []).length,
    mr: 0
  };
  const latinCount = (input.match(/[A-Za-z]/g) || []).length;
  const scripts = [...Object.values(scriptCounts), latinCount].filter((count) => count > 0).length;
  if (scripts > 1) return 'mixed';
  const detected = Object.entries(scriptCounts).sort(([, first], [, second]) => second - first).find(([, count]) => count > 0);
  if (detected) return detected[0];
  return 'en';
}

function languageInstruction(language) {
  if (language === 'te') return 'Write the claim, explanation, reasoningSummary, summary, keyClaims, supportingEvidence, contradictingEvidence in Telugu (తెలుగు). Keep JSON keys and classification/displayVerdict exact string tokens in English.';
  if (language === 'hi') return 'Write the claim, explanation, reasoningSummary, summary, keyClaims, supportingEvidence, contradictingEvidence in Hindi (हिन्दी). Keep JSON keys and classification/displayVerdict exact string tokens in English.';
  if (language === 'ur') return 'Write the claim, explanation, reasoningSummary, summary, keyClaims, supportingEvidence, contradictingEvidence in Urdu (اردو). Keep JSON keys and classification/displayVerdict exact string tokens in English.';
  if (language === 'ta') return 'Write the claim, explanation, reasoningSummary, summary, keyClaims, supportingEvidence, contradictingEvidence in Tamil (தமிழ்). Keep JSON keys and classification/displayVerdict exact string tokens in English.';
  if (language === 'kn') return 'Write the claim, explanation, reasoningSummary, summary, keyClaims, supportingEvidence, contradictingEvidence in Kannada (ಕನ್ನಡ). Keep JSON keys and classification/displayVerdict exact string tokens in English.';
  if (language === 'ml') return 'Write the claim, explanation, reasoningSummary, summary, keyClaims, supportingEvidence, contradictingEvidence in Malayalam (മലയാളം). Keep JSON keys and classification/displayVerdict exact string tokens in English.';
  if (language === 'mr') return 'Write the claim, explanation, reasoningSummary, summary, keyClaims, supportingEvidence, contradictingEvidence in Marathi (मराठी). Keep JSON keys and classification/displayVerdict exact string tokens in English.';
  if (language === 'bn') return 'Write the claim, explanation, reasoningSummary, summary, keyClaims, supportingEvidence, contradictingEvidence in Bengali (বাংলা). Keep JSON keys and classification/displayVerdict exact string tokens in English.';
  if (language === 'gu') return 'Write the claim, explanation, reasoningSummary, summary, keyClaims, supportingEvidence, contradictingEvidence in Gujarati (ગુજરાતી). Keep JSON keys and classification/displayVerdict exact string tokens in English.';
  if (language === 'pa') return 'Write the claim, explanation, reasoningSummary, summary, keyClaims, supportingEvidence, contradictingEvidence in Punjabi (ਪੰਜਾਬੀ). Keep JSON keys and classification/displayVerdict exact string tokens in English.';
  if (language === 'mixed') return 'The input is multilingual. Write a clear bilingual or multilingual explanation and summary using the languages in the input. Keep JSON keys and classification/displayVerdict tokens in English.';
  return 'Write the claim, explanation, reasoningSummary, summary, keyClaims, supportingEvidence, and contradictingEvidence in English.';
}

const unavailableResult = {
  claimType: 'Fact',
  classification: 'Insufficient',
  verdict: 'Needs review',
  displayVerdict: 'INSUFFICIENT EVIDENCE',
  confidence: 50,
  claim: 'Unable to extract verifiable claim from submitted content.',
  summary: 'The verification system could not complete an automated analysis at this time.',
  explanation: 'Insufficient reliable evidence. FactX cannot confidently determine the claim.',
  reasoningSummary: 'Insufficient reliable evidence. FactX cannot confidently determine the claim.',
  keyClaims: [],
  supportingEvidence: [],
  contradictingEvidence: [],
  conflictingReports: false,
  conflictingDetails: '',
  eventDate: '',
  articleDate: '',
  currentness: 'Unknown',
  dateWarning: '',
  sources: [],
  signals: ['Analysis service unavailable'],
  evidence: [{ point: 'Verification signal', support: 'No model result was retrieved.', limitation: 'Consult official primary records to verify.' }]
};

async function fetchArticle(url) {
  try {
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 FactXBot/1.0'
      },
      timeout: 12000,
      maxContentLength: 4 * 1024 * 1024,
      responseType: 'text'
    });
    const $ = cheerio.load(response.data);
    $('script, style, noscript, nav, footer, header, form, aside, iframe, svg').remove();
    const title = $('meta[property="og:title"]').attr('content') || $('title').text().trim();
    const description = $('meta[name="description"]').attr('content') || $('meta[property="og:description"]').attr('content') || '';
    const publishedDate = $('meta[property="article:published_time"]').attr('content') ||
                          $('meta[name="pubdate"]').attr('content') ||
                          $('time').attr('datetime') ||
                          $('time').text().trim() || '';
    const paragraphs = $('article p, main p, [role="main"] p, p')
      .map((_, element) => $(element).text().replace(/\s+/g, ' ').trim())
      .get()
      .filter((text) => text.length > 30);
    const bodyContent = [...new Set(paragraphs)].join('\n\n');
    const extracted = [
      title && `ARTICLE TITLE: ${title}`,
      publishedDate && `ARTICLE PUBLISHED DATE: ${publishedDate}`,
      description && `SUMMARY / DESCRIPTION: ${description}`,
      bodyContent && `ARTICLE CONTENT:\n${bodyContent}`
    ].filter(Boolean).join('\n\n').slice(0, 10000);

    if (!extracted || extracted.length < 40) throw new Error('No readable article text found on page.');
    return {
      title: title || url,
      publishedDate,
      content: extracted,
      fetched: true,
      url
    };
  } catch (error) {
    console.warn('Article fetch failed:', error.message);
    return {
      title: url,
      publishedDate: '',
      content: `URL: ${url}\n\nPAGE ACCESS STATUS: The complete article webpage could not be fetched directly (paywall, anti-bot protection, or network timeout). Analyze the claim from the URL structure and verify external reliable sources about this topic.`,
      fetched: false,
      url
    };
  }
}

const languageToRssConfig = {
  en: { hl: 'en-US', gl: 'US', ceid: 'US:en' },
  te: { hl: 'te', gl: 'IN', ceid: 'IN:te' },
  hi: { hl: 'hi', gl: 'IN', ceid: 'IN:hi' },
  ur: { hl: 'ur', gl: 'IN', ceid: 'IN:ur' },
  ta: { hl: 'ta', gl: 'IN', ceid: 'IN:ta' },
  kn: { hl: 'kn', gl: 'IN', ceid: 'IN:kn' },
  ml: { hl: 'ml', gl: 'IN', ceid: 'IN:ml' },
  mr: { hl: 'mr', gl: 'IN', ceid: 'IN:mr' },
  bn: { hl: 'bn', gl: 'IN', ceid: 'IN:bn' },
  gu: { hl: 'gu', gl: 'IN', ceid: 'IN:gu' },
  pa: { hl: 'pa', gl: 'IN', ceid: 'IN:pa' },
  mixed: { hl: 'en-IN', gl: 'IN', ceid: 'IN:en' }
};

async function searchSources(query, lang = 'en') {
  const cleanQuery = query
    .replace(/https?:\/\/\S+/g, '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120);

  if (!cleanQuery) return [];

  const config = languageToRssConfig[lang] || languageToRssConfig.en;

  // Try Google News RSS first
  try {
    const encoded = encodeURIComponent(cleanQuery);
    const url = `https://news.google.com/rss/search?q=${encoded}&hl=${config.hl}&gl=${config.gl}&ceid=${config.ceid}`;
    const response = await axios.get(url, {
      timeout: 4000,
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
    });
    const items = [];
    const itemMatches = response.data.match(/<item>[\s\S]*?<\/item>/g) || [];
    for (const itemXml of itemMatches.slice(0, 6)) {
      const titleMatch = itemXml.match(/<title>([\s\S]*?)<\/title>/);
      const linkMatch = itemXml.match(/<link>([\s\S]*?)<\/link>/);
      const pubDateMatch = itemXml.match(/<pubDate>([\s\S]*?)<\/pubDate>/);
      const sourceMatch = itemXml.match(/<source[^>]*>([\s\S]*?)<\/source>/);
      const title = titleMatch ? titleMatch[1].replace(/<!\[CDATA\[(.*?)\]\]>/g, '$1').trim() : '';
      const sourceUrl = linkMatch ? linkMatch[1].trim() : '';
      const published = pubDateMatch ? pubDateMatch[1].trim() : '';
      const name = sourceMatch ? sourceMatch[1].replace(/<!\[CDATA\[(.*?)\]\]>/g, '$1').trim() : 'News source';
      if (title && sourceUrl) {
        items.push({ name, title, url: sourceUrl, published, domain: name });
      }
    }
    if (items.length > 0) return items;
  } catch (error) {
    console.warn('Google News search failed, trying English fallback:', error.message);
  }

  // Fallback to English Google News RSS if non-English query had 0 results
  if (lang !== 'en') {
    try {
      const encoded = encodeURIComponent(cleanQuery);
      const url = `https://news.google.com/rss/search?q=${encoded}&hl=en-US&gl=US&ceid=US:en`;
      const response = await axios.get(url, {
        timeout: 3500,
        headers: { 'User-Agent': 'Mozilla/5.0' }
      });
      const items = [];
      const itemMatches = response.data.match(/<item>[\s\S]*?<\/item>/g) || [];
      for (const itemXml of itemMatches.slice(0, 5)) {
        const titleMatch = itemXml.match(/<title>([\s\S]*?)<\/title>/);
        const linkMatch = itemXml.match(/<link>([\s\S]*?)<\/link>/);
        const pubDateMatch = itemXml.match(/<pubDate>([\s\S]*?)<\/pubDate>/);
        const sourceMatch = itemXml.match(/<source[^>]*>([\s\S]*?)<\/source>/);
        const title = titleMatch ? titleMatch[1].replace(/<!\[CDATA\[(.*?)\]\]>/g, '$1').trim() : '';
        const sourceUrl = linkMatch ? linkMatch[1].trim() : '';
        const published = pubDateMatch ? pubDateMatch[1].trim() : '';
        const name = sourceMatch ? sourceMatch[1].replace(/<!\[CDATA\[(.*?)\]\]>/g, '$1').trim() : 'News source';
        if (title && sourceUrl) {
          items.push({ name, title, url: sourceUrl, published, domain: name });
        }
      }
      if (items.length > 0) return items;
    } catch {
      // ignore
    }
  }

  return [];
}

function parseResult(text, retrievedSources = [], submittedUrl = null) {
  try {
    const cleaned = text.replace(/```json|```/g, '').trim();
    const jsonStart = cleaned.indexOf('{');
    const jsonEnd = cleaned.lastIndexOf('}');
    const parsed = JSON.parse(jsonStart >= 0 && jsonEnd > jsonStart ? cleaned.slice(jsonStart, jsonEnd + 1) : cleaned);

    const rawVerdict = String(parsed.displayVerdict || parsed.verdict || parsed.classification || '').toUpperCase();
    let displayVerdict = 'INSUFFICIENT EVIDENCE';
    let classification = 'Insufficient';
    let verdict = 'Needs review';

    if (rawVerdict.includes('VERIFIED') || rawVerdict.includes('GENUINE') || (rawVerdict.includes('TRUE') && !rawVerdict.includes('PARTIALLY'))) {
      displayVerdict = 'VERIFIED / LIKELY TRUE';
      classification = 'Real';
      verdict = 'Likely genuine';
    } else if (rawVerdict.includes('FALSE') || rawVerdict.includes('FAKE')) {
      displayVerdict = 'FALSE / LIKELY FAKE';
      classification = 'Fake';
      verdict = 'Likely misleading';
    } else if (rawVerdict.includes('MISLEADING') || rawVerdict.includes('PARTIALLY')) {
      displayVerdict = 'MISLEADING / PARTIALLY TRUE';
      classification = 'Misleading';
      verdict = 'Likely misleading';
    } else {
      displayVerdict = 'INSUFFICIENT EVIDENCE';
      classification = 'Insufficient';
      verdict = 'Needs review';
    }

    const validSources = [];
    if (Array.isArray(retrievedSources) && retrievedSources.length > 0) {
      validSources.push(...retrievedSources);
    } else if (submittedUrl) {
      try {
        const parsedUrl = new URL(submittedUrl);
        validSources.push({
          name: parsedUrl.hostname.replace(/^www\./, ''),
          title: 'Submitted Article Link',
          url: submittedUrl,
          published: parsed.articleDate || 'Extracted URL',
          domain: parsedUrl.hostname
        });
      } catch {
        // ignore invalid URL parsing
      }
    }

    const confidence = Number.isFinite(parsed.confidence)
      ? Math.min(Math.max(Math.round(parsed.confidence), 0), 100)
      : (classification === 'Insufficient' ? 50 : 75);

    const evidence = Array.isArray(parsed.evidence) && parsed.evidence.length
      ? parsed.evidence.slice(0, 5)
      : (Array.isArray(parsed.signals) ? parsed.signals.slice(0, 4).map((s) => ({ point: s, support: 'Signal observed in submitted content.', limitation: 'Verify with primary records.' })) : [{ point: 'Factual verification signal', support: 'Analysis based on verified records and language indicators.', limitation: 'Always verify important claims with primary sources.' }]);

    return {
      claimType: parsed.claimType === 'Opinion' ? 'Opinion' : 'Fact',
      classification,
      displayVerdict,
      verdict,
      confidence,
      claim: parsed.claim || '',
      summary: parsed.summary || '',
      explanation: parsed.explanation || parsed.reasoningSummary || 'Review the evidence below and verify claims independently.',
      reasoningSummary: parsed.reasoningSummary || parsed.explanation || 'Based on available evidence and credibility assessment.',
      keyClaims: Array.isArray(parsed.keyClaims) ? parsed.keyClaims.filter(Boolean).slice(0, 5) : [],
      supportingEvidence: Array.isArray(parsed.supportingEvidence) ? parsed.supportingEvidence.filter(Boolean).slice(0, 5) : [],
      contradictingEvidence: Array.isArray(parsed.contradictingEvidence) ? parsed.contradictingEvidence.filter(Boolean).slice(0, 5) : [],
      conflictingReports: Boolean(parsed.conflictingReports),
      conflictingDetails: parsed.conflictingDetails || '',
      eventDate: parsed.eventDate || '',
      articleDate: parsed.articleDate || '',
      currentness: ['Current', 'Outdated', 'Unknown'].includes(parsed.currentness) ? parsed.currentness : 'Unknown',
      dateWarning: parsed.dateWarning || '',
      sources: validSources,
      signals: Array.isArray(parsed.signals) ? parsed.signals.filter(Boolean).slice(0, 5) : ['Fact-checked assessment'],
      evidence: evidence.map((e) => ({
        point: typeof e === 'string' ? e : e.point || 'Evidence signal',
        support: typeof e === 'object' && e.support ? e.support : 'Identified in the analysis.',
        limitation: typeof e === 'object' && e.limitation ? e.limitation : 'Check with official primary records.'
      }))
    };
  } catch (err) {
    console.error('parseResult error:', err.message);
    return unavailableResult;
  }
}

export async function createScan(req, res, next) {
  try {
    const requestInput = {
      input: req.body.input ?? req.body.content,
      sourceType: req.body.sourceType ?? req.body.type,
      language: req.body.language
    };

    let validated;
    try {
      validated = bodySchema.parse(requestInput);
    } catch (zodErr) {
      return res.status(400).json({
        message: zodErr.issues?.[0]?.message || 'Invalid input. Please check your submission.'
      });
    }

    const { input, sourceType, language } = validated;

    const source = sourceType === 'url' ? await fetchArticle(input) : { content: input, fetched: false, title: input.slice(0, 100), url: null };
    const detectedLanguage = detectLanguage(source.content, language);

    const previousScan = await Scan.findOne({
      userId: req.userId || null,
      input,
      sourceType,
      language: detectedLanguage,
      analysisVersion: ANALYSIS_VERSION
    }).sort({ createdAt: -1 });

    if (previousScan) return res.status(200).json({ scan: previousScan });

    const today = new Date().toISOString().slice(0, 10);
    const searchQuery = sourceType === 'url' ? (source.title || input) : input;
    const sources = await searchSources(searchQuery, detectedLanguage);

    const prompt = `You are a world-class AI news verification specialist and misinformation analyst for FactX.
Your task is to thoroughly analyze the submitted ${sourceType} and evaluate its credibility using rigorous fact-checking standards.
Today's date is: ${today}.
Input/Target Language: ${detectedLanguage}.
${languageInstruction(detectedLanguage)}

CLASSIFICATION CRITERIA:
- "VERIFIED / LIKELY TRUE": The claim is factually accurate, supported by verified evidence, reliable news sources, or confirmed official records.
- "FALSE / LIKELY FAKE": The claim is demonstrably false, fabricated, a debunked conspiracy theory, hoax, or contradicts well-established scientific and historical facts.
- "MISLEADING / PARTIALLY TRUE": The claim exaggerates, takes facts out of context, has outdated dates presented as current, mixes truth with falsehoods, or where reputable sources disagree.
- "INSUFFICIENT EVIDENCE": The claim is an unconfirmed rumor, obscure speculation, or lacks reliable corroborating evidence either way.

CRITICAL VERIFICATION RULES:
1. NEVER hallucinate or invent sources, URLs, publication dates, statistics, or quotes.
2. Only use the records provided in "VERIFIED_RETRIEVED_SOURCES" below as sources checked. If none match or none were retrieved, leave "sources" as an empty array [].
3. For Famous Websites: Do NOT automatically trust an article or website just because it is famous. Scrutinize the actual claims and evidence.
4. If reputable sources disagree: Do NOT force a TRUE or FALSE result. Set conflictingReports: true, displayVerdict: "MISLEADING / PARTIALLY TRUE" or "INSUFFICIENT EVIDENCE", and clearly explain the disagreement in conflictingDetails ("Conflicting reports found").
5. Date Handling: Extract event dates and article publication dates. If an old story/event is being circulated as breaking or recent news, set currentness: "Outdated" and provide a clear dateWarning.
6. Evidence Requirement: Always provide specific factual points in supportingEvidence or contradictingEvidence justifying your verdict.
7. For "Why this result?": In reasoningSummary, give a concise, factual explanation justifying the verdict.
8. In summary: Give a 1-2 sentence AI reasoning summary in simple language explaining the verdict.

VERIFIED_RETRIEVED_SOURCES:
${JSON.stringify(sources, null, 2)}

${source.fetched ? 'FETCHED WEBPAGE CONTENT:' : 'SUBMITTED CONTENT:'}
${source.content}

RETURN ONLY VALID JSON OBJECT with these exact keys:
{
  "claimType": "Fact" | "Opinion",
  "classification": "Real" | "Fake" | "Misleading" | "Insufficient",
  "displayVerdict": "VERIFIED / LIKELY TRUE" | "FALSE / LIKELY FAKE" | "MISLEADING / PARTIALLY TRUE" | "INSUFFICIENT EVIDENCE",
  "confidence": integer (0 to 100),
  "claim": "concise main claim extracted",
  "summary": "1-2 sentence simple AI reasoning summary",
  "explanation": "comprehensive explanation of the findings",
  "reasoningSummary": "direct answer to 'Why this result?' citing factual evidence",
  "keyClaims": ["array of key claims detected"],
  "supportingEvidence": ["factual points supporting the claim"],
  "contradictingEvidence": ["factual points contradicting or disproving the claim"],
  "conflictingReports": boolean,
  "conflictingDetails": "explanation of disagreements if conflictingReports is true, else empty string",
  "eventDate": "event date mentioned or empty string",
  "articleDate": "article publication date mentioned or empty string",
  "currentness": "Current" | "Outdated" | "Unknown",
  "dateWarning": "warning message if old article is recycled as recent news, else empty string",
  "signals": ["3 to 5 credibility signals"],
  "evidence": [{"point": "evidence point", "support": "why it supports or refutes", "limitation": "source limitation"}]
}`;

    let result = unavailableResult;
    try {
      const response = await axios.post('https://api.groq.com/openai/v1/chat/completions', {
        model: process.env.GROQ_MODEL || 'openai/gpt-oss-20b',
        messages: [
          { role: 'system', content: 'You are an AI fact-checking engine for FactX. Output strictly valid JSON without preamble.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0,
        response_format: { type: 'json_object' },
        max_tokens: 1800
      }, {
        headers: {
          Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
          'Content-Type': 'application/json'
        },
        timeout: 30000
      });

      const message = response.data.choices?.[0]?.message || {};
      result = parseResult(message.content || message.reasoning || '', sources, sourceType === 'url' ? input : null);
    } catch (error) {
      console.error('Groq verification request failed:', error.response?.data || error.message);
      result = parseResult('', sources, sourceType === 'url' ? input : null);
    }

    const finalSources = Array.isArray(result.sources) ? result.sources : [];

    if (!finalSources.length && result.classification === 'Insufficient') {
      result.reasoningSummary = result.reasoningSummary || 'Insufficient reliable evidence. FactX cannot confidently determine the claim.';
      result.explanation = result.explanation || 'Insufficient reliable evidence. FactX cannot confidently determine the claim.';
    }

    const scan = await Scan.create({
      userId: req.userId || null,
      input,
      sourceType,
      language: detectedLanguage,
      analysisVersion: ANALYSIS_VERSION,
      ...result,
      sources: finalSources,
      verifiedAt: new Date()
    });

    res.status(201).json({
      scan,
      verification: {
        stage: 'complete',
        sourceCount: finalSources.length,
        detectedLanguage
      }
    });
  } catch (err) {
    next(err);
  }
}

export async function history(req, res, next) {
  try {
    const query = req.userId ? { userId: req.userId } : {};
    const scans = await Scan.find(query).sort({ createdAt: -1 }).limit(50);
    res.json({ scans });
  } catch (err) {
    next(err);
  }
}
