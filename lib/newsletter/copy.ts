/**
 * Subject, preheader and editor's note.
 *
 * The model only ever sees OUR content: post titles and excerpts we published,
 * series names, episode numbers, airing times. It never sees an ANN article, so
 * it cannot paraphrase one.
 *
 * Everything that decides whether an answer is usable lives here as a pure
 * function, because a bad subject reaches thousands of inboxes and there is no
 * undo. `validateCopy` is the gate; `fallbackCopy` is what happens when the gate
 * stays shut after one retry.
 */

import { callGroq, type ChatMessage, type GroqDeps } from "./groq"
import { mix32, type LayoutId } from "./layout"
import type { IssueContent, NewsletterCopy } from "./types"

export const MAX_SUBJECT_CHARS = 60
export const MAX_PREHEADER_CHARS = 90
export const MAX_NOTE_CHARS = 420
/** How many past subjects a new one is compared against. */
export const SUBJECT_HISTORY = 14
/** A question subject is allowed at most this often. */
export const QUESTION_COOLDOWN_DAYS = 7

export const BANNED_PHRASES = [
  "buckle up",
  "dive in",
  "dive into",
  "let's dive",
  "delve",
  "game-changer",
  "game changer",
  "unleash",
  "get ready",
  "without further ado",
  "in this issue",
  "you won't believe",
  "must-see",
  "must see",
  "hold on to your",
  "brace yourself",
  "you read that right",
  "stay tuned",
] as const

const ALLOWED_ACRONYMS = new Set([
  "WAT",
  "UTC",
  "TV",
  "OVA",
  "ONA",
  "ANN",
  "OTT",
  "PV",
  "BD",
  "OP",
  "ED",
  "EP",
  "EPS",
  "CGI",
  "OST",
  "NEWS",
  "FAQ",
])

/** Capitalised words a subject may use without them appearing in the content. */
const ALLOWED_CAPITALISED = new Set([
  "The",
  "A",
  "An",
  "And",
  "But",
  "Plus",
  "New",
  "Next",
  "This",
  "That",
  "Today",
  "Tomorrow",
  "Tonight",
  "Week",
  "Weekend",
  "Morning",
  "Latest",
  "Watch",
  "Read",
  "News",
  "Episode",
  "Episodes",
  "Ep",
  "Season",
  "Part",
  "Finale",
  "Premiere",
  "Anime",
  "OtakuNaija",
  "Naija",
  "Nigeria",
  "Nigerian",
  "Africa",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
  "WAT",
  "UTC",
])

const COMMON_WORDS = new Set([
  "the","a","an","and","or","but","of","to","in","on","at","for","with","from","by","as","is","are","was",
  "were","be","been","being","it","its","this","that","these","those","we","our","you","your","they","their",
  "he","she","his","her","them","us","me","my","i","not","no","yes","all","any","some","more","most","less",
  "new","next","last","first","second","third","top","best","big","small","bigger","biggest","worth","watch",
  "reading","read","see","seen","out","now","today","tomorrow","tonight","week","weekend","morning","daily",
  "episode","episodes","ep","series","season","show","shows","story","stories","news","anime","film","movie",
  "movies","watchlist","list","guide","what","when","where","who","why","how","here","there","still","just",
  "back","again","after","before","into","over","under","about","up","down","one","two","three","four","five",
  "six","seven","eight","nine","ten","also","very","really","much","many","few","lot","plus","only","even",
  "gets","get","got","make","makes","made","take","takes","took","give","gives","gave","come","comes","came",
  "adds","added","returns","return","arrives","arrive","lands","landed","drops","dropped","debuts","debut",
  "airing","airs","aired","streaming","streams","released","release","available","worth","picks","pick",
  "s","t","re","ve","ll","d","m",
])

// ---------------------------------------------------------------------------
// Text helpers
// ---------------------------------------------------------------------------

const EMOJI = /\p{Extended_Pictographic}/u

export function hasEmoji(text: string): boolean {
  return EMOJI.test(text)
}

export function countEmoji(text: string): number {
  return (text.match(new RegExp(EMOJI.source, "gu")) ?? []).length
}

/** Lowercase, punctuation-free, whitespace-collapsed form used for repeat checks. */
export function normaliseSubject(subject: string): string {
  return subject
    .toLowerCase()
    .normalize("NFKC")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
}

export function findBannedPhrase(text: string): string | null {
  const haystack = ` ${text.toLowerCase().replace(/\s+/g, " ")} `
  for (const phrase of BANNED_PHRASES) {
    if (haystack.includes(` ${phrase} `)) return phrase
  }
  return null
}

function contentVocabulary(content: IssueContent): Set<string> {
  const words = new Set<string>()
  const add = (text: string | null | undefined) => {
    if (!text) return
    for (const token of text.toLowerCase().split(/[^\p{L}\p{N}]+/u)) {
      if (token) words.add(token)
    }
  }

  add(content.topStory?.title)
  add(content.topStory?.category)
  for (const post of [...content.posts, ...content.weekInReview]) {
    add(post.title)
    add(post.category)
  }
  for (const group of content.seriesGroups) {
    add(group.title)
    for (const episode of group.episodes) add(episode.title)
  }
  for (const item of content.airing) add(item.title)
  for (const item of content.upcoming) add(item.title)
  for (const item of content.trending) add(item.title)
  return words
}

/** Every grounded multi-word phrase, lowercased, for containment checks. */
function groundedPhrases(content: IssueContent): string[] {
  const phrases: string[] = []
  const add = (text: string | null | undefined) => {
    if (!text) return
    const normalised = normaliseSubject(text)
    if (normalised) phrases.push(normalised)
  }

  add(content.topStory?.title)
  for (const post of [...content.posts, ...content.weekInReview]) add(post.title)
  for (const group of content.seriesGroups) add(group.title)
  for (const item of content.airing) add(item.title)
  for (const item of content.upcoming) add(item.title)
  for (const item of content.trending) add(item.title)
  return phrases
}

function uppercaseTokens(content: IssueContent): Set<string> {
  const allowed = new Set<string>()
  const scan = (text: string | null | undefined) => {
    if (!text) return
    for (const token of text.split(/\s+/)) {
      const clean = token.replace(/[^\p{L}\p{N}]/gu, "")
      if (clean.length >= 4 && clean === clean.toUpperCase() && /[A-Z]/.test(clean)) {
        allowed.add(clean)
      }
    }
  }
  scan(content.topStory?.title)
  for (const post of [...content.posts, ...content.weekInReview]) scan(post.title)
  for (const group of content.seriesGroups) scan(group.title)
  for (const item of content.airing) scan(item.title)
  for (const item of content.upcoming) scan(item.title)
  return allowed
}

/** First SHOUTED word (4+ letters, not an acronym we expect). */
export function findShouting(text: string, content: IssueContent): string | null {
  const allowed = uppercaseTokens(content)
  for (const match of text.matchAll(/\b[A-Z]{4,}\b/g)) {
    const token = match[0]
    if (ALLOWED_ACRONYMS.has(token)) continue
    if (allowed.has(token)) continue
    return token
  }
  return null
}

/**
 * Two-or-more-word Capitalised Sequences that are neither part of a real title
 * nor made of words we can trace back to the content. This is the
 * hallucination guard: a model that invents "Naruto Shippuden Final Arc" gets
 * caught here, while trimming a long real title does not.
 */
export function findUngroundedPhrase(text: string, content: IssueContent): string | null {
  const phrases = groundedPhrases(content)
  const vocabulary = contentVocabulary(content)

  const tokens = text.split(/\s+/).filter(Boolean)
  let run: string[] = []

  const flush = (): string | null => {
    if (run.length < 2) {
      run = []
      return null
    }
    const phrase = run.join(" ")
    run = []
    const normalised = normaliseSubject(phrase)
    if (!normalised) return null
    if (phrases.some((candidate) => candidate.includes(normalised))) return null
    if (phrases.some((candidate) => normalised.includes(candidate))) return null

    const words = normalised.split(" ")
    const everyWordKnown = words.every(
      (word) => vocabulary.has(word) || COMMON_WORDS.has(word) || ALLOWED_CAPITALISED.has(word.toLowerCase()),
    )
    return everyWordKnown ? null : phrase
  }

  for (const token of tokens) {
    const clean = token.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "")
    if (!clean) {
      const found = flush()
      if (found) return found
      continue
    }
    const startsUpper = /^\p{Lu}/u.test(clean)
    const isNumber = /^\d+$/.test(clean)
    if (startsUpper && !isNumber) {
      run.push(clean)
      continue
    }
    const found = flush()
    if (found) return found
  }

  return flush()
}

// ---------------------------------------------------------------------------
// Subject formats
// ---------------------------------------------------------------------------

export type SubjectFormat = "statement" | "count" | "question" | "name-led"

export const SUBJECT_FORMAT_LABEL: Record<SubjectFormat, string> = {
  statement: "a short statement",
  count: "a number-led count, with the real number",
  question: "a question",
  "name-led": "a subject that leads with a series or story name",
}

export function baseFormatFor(layout: LayoutId): SubjectFormat {
  switch (layout) {
    case "roundup":
    case "episode-drop":
      return "count"
    case "week-ahead":
    case "weekend-watch":
      return "name-led"
    default:
      return "statement"
  }
}

/** True when any of the recent subjects is a question inside the cooldown. */
export function questionUsedRecently(recentSubjects: string[]): boolean {
  return recentSubjects.slice(0, QUESTION_COOLDOWN_DAYS).some((subject) => subject.includes("?"))
}

export function pickSubjectFormat(
  layout: LayoutId,
  seed: number,
  recentSubjects: string[],
): SubjectFormat {
  const base = baseFormatFor(layout)
  const wantsQuestion = mix32(seed, 71) % 4 === 0
  if (wantsQuestion && !questionUsedRecently(recentSubjects)) return "question"
  return base
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

export type CopyCandidate = {
  subject?: unknown
  preheader?: unknown
  editorsNote?: unknown
  blurbs?: unknown
}

export type ValidationContext = {
  content: IssueContent
  recentSubjects: string[]
  format: SubjectFormat
}

export type ValidationResult = { ok: true } | { ok: false; reasons: string[] }

export function validateCopy(candidate: CopyCandidate, ctx: ValidationContext): ValidationResult {
  const reasons: string[] = []
  const subject = typeof candidate.subject === "string" ? candidate.subject.trim() : ""
  const preheader = typeof candidate.preheader === "string" ? candidate.preheader.trim() : ""
  const note = typeof candidate.editorsNote === "string" ? candidate.editorsNote.trim() : ""

  if (!subject) reasons.push("subject_missing")
  if (subject.length > MAX_SUBJECT_CHARS) reasons.push(`subject_too_long:${subject.length}`)
  if (!preheader) reasons.push("preheader_missing")
  if (preheader.length > MAX_PREHEADER_CHARS) reasons.push(`preheader_too_long:${preheader.length}`)
  if (!note) reasons.push("note_missing")
  if (note.length > MAX_NOTE_CHARS) reasons.push(`note_too_long:${note.length}`)

  if (subject) {
    if (hasEmoji(subject)) reasons.push("subject_has_emoji")
    if (countEmoji(note) > 1) reasons.push("note_has_too_many_emoji")

    const normalised = normaliseSubject(subject)
    const repeated = ctx.recentSubjects
      .slice(0, SUBJECT_HISTORY)
      .some((previous) => normaliseSubject(previous) === normalised)
    if (repeated) reasons.push("subject_repeats_recent")

    if (ctx.format !== "question" && subject.includes("?")) reasons.push("subject_question_not_allowed")
    if (ctx.format === "question" && !subject.includes("?")) reasons.push("subject_question_expected")

    for (const [label, text] of [
      ["subject", subject],
      ["preheader", preheader],
      ["note", note],
    ] as const) {
      const banned = findBannedPhrase(text)
      if (banned) reasons.push(`${label}_banned_phrase:${banned}`)
    }

    const shout = findShouting(`${subject} ${preheader} ${note}`, ctx.content)
    if (shout) reasons.push(`shouting:${shout}`)

    const ungrounded = findUngroundedPhrase(`${subject} ${preheader} ${note}`, ctx.content)
    if (ungrounded) reasons.push(`ungrounded_reference:${ungrounded}`)
  }

  return reasons.length ? { ok: false, reasons } : { ok: true }
}

// ---------------------------------------------------------------------------
// Deterministic fallbacks
// ---------------------------------------------------------------------------

function clipWords(text: string, max: number): string {
  const trimmed = text.replace(/\s+/g, " ").trim()
  if (trimmed.length <= max) return trimmed
  const cut = trimmed.slice(0, max)
  const space = cut.lastIndexOf(" ")
  return (space > max * 0.55 ? cut.slice(0, space) : cut).replace(/[\s,;:.-]+$/, "")
}

/** The human-scale "plus N more" count used by count subjects. */
export function moreStoriesCount(content: IssueContent): number {
  const total =
    (content.topStory ? 1 : 0) +
    content.posts.length +
    content.seriesGroups.length +
    content.airing.length +
    content.upcoming.length
  return Math.max(0, total - 1)
}

function topName(content: IssueContent): string | null {
  const group = content.seriesGroups[0]
  if (group) return group.title
  if (content.topStory) return content.topStory.title
  if (content.airing[0]) return content.airing[0].title
  return null
}

export function fallbackSubject(content: IssueContent, format: SubjectFormat): string {
  const group = content.seriesGroups[0]
  const more = moreStoriesCount(content)
  const name = topName(content)

  const candidates: string[] = []

  if (format === "count") {
    const episodes = content.counts.episodes
    if (episodes > 0 && content.counts.series > 0) {
      candidates.push(`${episodes} new episodes from ${content.counts.series} series`)
    }
    if (more > 0) candidates.push(`${more + 1} stories worth your morning`)
  }

  if (format === "name-led" && name) {
    if (group && group.episodes.length) {
      const latest = group.episodes[0]
      const ep = latest.number !== null ? ` Episode ${latest.number}` : ""
      candidates.push(`${group.title}${ep} and ${more} more`)
    } else {
      candidates.push(`${name} leads today`)
    }
  }

  if (format === "question") {
    if (group && group.episodes.length) {
      candidates.push(`Ready for ${group.title} Episode ${group.episodes[0].number ?? ""}`.trim() + "?")
    } else if (name) {
      candidates.push(`What is ${name} hiding?`)
    }
  }

  // statement, plus the last-resort shape from the spec
  if (group && group.episodes.length) {
    const latest = group.episodes[0]
    const ep = latest.number !== null ? `Ep ${latest.number}` : "has a new episode"
    candidates.push(`${group.title} ${ep} is out, plus ${more} more stories`)
  }
  if (name) candidates.push(`${name} and ${more} more stories`)
  candidates.push("Your daily anime briefing")

  for (const candidate of candidates) {
    const cleaned = clipWords(candidate, MAX_SUBJECT_CHARS)
    if (cleaned) return cleaned
  }
  return "Your daily anime briefing"
}

export function fallbackPreheader(content: IssueContent): string {
  const parts: string[] = []
  if (content.counts.episodes > 0) parts.push(`${content.counts.episodes} new episodes`)
  if (content.counts.posts > 0) parts.push(`${content.counts.posts} stories`)
  if (content.counts.airing > 0) parts.push(`${content.counts.airing} airing soon`)
  const lead = parts.length ? parts.join(", ") : "News and episodes"
  const tail = content.topStory?.excerpt ? ` ${content.topStory.excerpt}` : ""
  return clipWords(`${lead}.${tail}`, MAX_PREHEADER_CHARS)
}

export function fallbackEditorsNote(content: IssueContent): string {
  const bits: string[] = []
  if (content.counts.episodes > 0) {
    bits.push(
      `${content.counts.episodes} new episode${content.counts.episodes === 1 ? "" : "s"} landed from ${content.counts.series} series.`,
    )
  }
  if (content.topStory) bits.push(`${content.topStory.title} is the story most people opened this morning.`)
  if (content.counts.airing > 0) bits.push(`${content.counts.airing} shows air in the next two days.`)
  if (!bits.length) bits.push("A short one today, but everything here is worth a look.")
  return clipWords(bits.slice(0, 2).join(" "), MAX_NOTE_CHARS)
}

export function fallbackCopy(content: IssueContent, format: SubjectFormat): NewsletterCopy {
  return {
    subject: fallbackSubject(content, format),
    preheader: fallbackPreheader(content),
    editorsNote: fallbackEditorsNote(content),
    blurbs: {},
    generatedBy: "fallback",
    attempts: 0,
  }
}

// ---------------------------------------------------------------------------
// Prompt
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT = `You write the morning email for OtakuNaija, an anime news and streaming site for Nigerian fans.

Voice: plain, warm, specific, like a knowledgeable friend texting you before work. Concrete nouns. Short sentences.

Hard rules:
- Use ONLY the facts in the CONTENT block. Never invent a title, series, episode number, date, person or event. Every series name and story title you mention must appear verbatim in CONTENT.
- No hype words or phrases: buckle up, dive in, delve, game-changer, unleash, get ready, in this issue, must-see, you won't believe.
- No ALL CAPS words. At most one emoji in the whole email, and none in the subject.
- Subject: aim for 45-55 characters, never more than 60. No emoji, no exclamation marks.
- Preheader: one sentence, at most 90 characters. It should add information, not repeat the subject.
- Editor's note: 2 or 3 sentences, at most 420 characters. Say what is actually in the email.
- Never mention that the email was generated, summarised, curated by AI, or assembled from data.

Respond with a single JSON object and nothing else:
{"subject": string, "preheader": string, "editorsNote": string, "blurbs": {"<post id>": string}}
"blurbs" may be empty. When present, each key must be a post id from CONTENT and each value one plain sentence (max 110 characters) saying why that story matters.`

function describeContent(content: IssueContent): string {
  const lines: string[] = []

  if (content.topStory) {
    lines.push(`LEAD STORY [id ${content.topStory.id}]: ${content.topStory.title}`)
    if (content.topStory.excerpt) lines.push(`  excerpt: ${content.topStory.excerpt}`)
    lines.push(`  category: ${content.topStory.category}`)
  }
  for (const post of content.posts) {
    lines.push(`STORY [id ${post.id}]: ${post.title} (${post.category})`)
    if (post.excerpt) lines.push(`  excerpt: ${post.excerpt}`)
  }
  for (const group of content.seriesGroups) {
    const eps = group.episodes.map((episode) => episode.number ?? "?").join(", ")
    lines.push(`NEW EPISODES: ${group.title} — episode ${eps}`)
  }
  for (const item of content.airing) {
    lines.push(`AIRING ${item.dayLabel}: ${item.title} episode ${item.episode} at ${item.watTime}`)
  }
  for (const item of content.upcoming) {
    lines.push(`UPCOMING: ${item.title} (${item.format}) starts ${item.startLabel}`)
  }
  for (const item of content.trending) {
    lines.push(`TRENDING ON SITE: ${item.title}`)
  }
  for (const post of content.weekInReview) {
    lines.push(`WEEK IN REVIEW: ${post.title} (${post.views} views)`)
  }

  return lines.join("\n")
}

export function buildMessages(ctx: ValidationContext & { issueDate: string }): ChatMessage[] {
  const format = SUBJECT_FORMAT_LABEL[ctx.format]
  return [
    { role: "system", content: SYSTEM_PROMPT },
    {
      role: "user",
      content: [
        `ISSUE DATE: ${ctx.issueDate}`,
        `SUBJECT SHAPE FOR TODAY: ${format}`,
        `RECENT SUBJECTS (do not repeat, do not paraphrase): ${ctx.recentSubjects.slice(0, SUBJECT_HISTORY).join(" | ") || "none"}`,
        "",
        "CONTENT:",
        describeContent(ctx.content),
        "",
        "Write the JSON object now.",
      ].join("\n"),
    },
  ]
}

// ---------------------------------------------------------------------------
// Generation
// ---------------------------------------------------------------------------

export type GenerateCopyInput = {
  content: IssueContent
  layout: LayoutId
  issueDate: string
  seed: number
  recentSubjects: string[]
}

export type GenerateCopyResult = {
  copy: NewsletterCopy
  format: SubjectFormat
  reasons: string[]
  usedModel: boolean
}

function parseJson(raw: string): CopyCandidate | null {
  const trimmed = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/```$/, "").trim()
  const start = trimmed.indexOf("{")
  const end = trimmed.lastIndexOf("}")
  if (start === -1 || end <= start) return null
  try {
    const parsed = JSON.parse(trimmed.slice(start, end + 1))
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as CopyCandidate) : null
  } catch {
    return null
  }
}

function normaliseBlurbs(raw: unknown, content: IssueContent): Record<string, string> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {}
  const ids = new Set<string>()
  if (content.topStory) ids.add(String(content.topStory.id))
  for (const post of content.posts) ids.add(String(post.id))
  for (const post of content.weekInReview) ids.add(String(post.id))

  const blurbs: Record<string, string> = {}
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!ids.has(String(key))) continue
    if (typeof value !== "string") continue
    const text = value.replace(/\s+/g, " ").trim()
    if (text) blurbs[String(key)] = text.slice(0, 110)
  }
  return blurbs
}

/**
 * One model attempt plus one stricter retry, then the rule-based fallback. The
 * function never throws: a broken Groq day should still produce a sendable
 * issue with a sane subject.
 */
export async function generateCopy(
  input: GenerateCopyInput,
  deps: GroqDeps = {},
): Promise<GenerateCopyResult> {
  const format = pickSubjectFormat(input.layout, input.seed, input.recentSubjects)
  const ctx: ValidationContext = {
    content: input.content,
    recentSubjects: input.recentSubjects,
    format,
  }

  const reasons: string[] = []
  let rejection: string | null = null

  for (let attempt = 1; attempt <= 2; attempt += 1) {
    const messages = buildMessages({ ...ctx, issueDate: input.issueDate })
    if (rejection) {
      messages.push({
        role: "user",
        content: `Your previous answer was rejected (${rejection}). Return a different, shorter answer that follows every rule.`,
      })
    }

    const call = await callGroq(messages, deps)
    if (!call.ok) {
      reasons.push(call.reason)
      break
    }

    const candidate = parseJson(call.content)
    if (!candidate) {
      rejection = "invalid_json"
      reasons.push("invalid_json")
      continue
    }

    const validation = validateCopy(candidate, ctx)
    if (!validation.ok) {
      rejection = validation.reasons[0]
      reasons.push(...validation.reasons)
      continue
    }

    return {
      copy: {
        subject: String(candidate.subject).trim(),
        preheader: String(candidate.preheader).trim(),
        editorsNote: String(candidate.editorsNote).trim(),
        blurbs: normaliseBlurbs(candidate.blurbs, input.content),
        generatedBy: "groq",
        attempts: attempt,
      },
      format,
      reasons,
      usedModel: true,
    }
  }

  return {
    copy: { ...fallbackCopy(input.content, format), attempts: 2 },
    format,
    reasons,
    usedModel: false,
  }
}

/** Applies the model's per-post blurbs to the selection before rendering. */
export function applyBlurbs(content: IssueContent, blurbs: Record<string, string>): IssueContent {
  const withBlurb = (post: IssueContent["posts"][number]) => ({
    ...post,
    whyItMatters: blurbs[String(post.id)] ?? post.whyItMatters ?? null,
  })

  return {
    ...content,
    topStory: content.topStory ? withBlurb(content.topStory) : null,
    posts: content.posts.map(withBlurb),
    weekInReview: content.weekInReview.map(withBlurb),
  }
}
