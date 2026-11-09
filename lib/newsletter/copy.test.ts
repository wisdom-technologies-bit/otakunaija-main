import { describe, expect, it } from "vitest"
import {
  buildMessages,
  fallbackCopy,
  fallbackSubject,
  findBannedPhrase,
  findUngroundedPhrase,
  generateCopy,
  MAX_PREHEADER_CHARS,
  MAX_SUBJECT_CHARS,
  normaliseSubject,
  pickSubjectFormat,
  questionUsedRecently,
  validateCopy,
  type SubjectFormat,
} from "./copy"
import { callGroq } from "./groq"
import { FIXTURE_COPY, fixtureContent } from "./fixtures"
import type { IssueContent } from "./types"

const content = fixtureContent({ now: new Date("2026-11-09T06:00:00.000Z") })

function ctx(format: SubjectFormat = "statement", recent: string[] = []) {
  return { content, recentSubjects: recent, format }
}

const good = {
  subject: "Solo Leveling season 3 is confirmed",
  preheader: "Also the Culling Game arc, and 16 new episodes.",
  editorsNote: "Two confirmations landed overnight and neither is a rumour. Sixteen episodes are waiting below.",
}

describe("validateCopy", () => {
  it("accepts a subject built from real content", () => {
    expect(validateCopy(good, ctx())).toEqual({ ok: true })
  })

  it("rejects a subject over the length limit", () => {
    const result = validateCopy({ ...good, subject: "a".repeat(MAX_SUBJECT_CHARS + 1) }, ctx())
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reasons.some((reason) => reason.startsWith("subject_too_long"))).toBe(true)
  })

  it("rejects a preheader over the length limit", () => {
    const result = validateCopy({ ...good, preheader: "a".repeat(MAX_PREHEADER_CHARS + 1) }, ctx())
    expect(result.ok).toBe(false)
  })

  it("rejects banned hype phrases", () => {
    const result = validateCopy({ ...good, subject: "Dive in to today's anime news" }, ctx())
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reasons.join(" ")).toContain("banned_phrase")
  })

  it("rejects a subject that repeats one from the recent history, whatever the casing", () => {
    const result = validateCopy(good, ctx("statement", ["SOLO LEVELING SEASON 3 IS CONFIRMED!"]))
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reasons).toContain("subject_repeats_recent")
  })

  it("rejects a title that is not in the selected content", () => {
    const result = validateCopy({ ...good, subject: "Naruto Shippuden returns in April" }, ctx())
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reasons.join(" ")).toContain("ungrounded_reference")
  })

  it("rejects emoji in the subject but tolerates one in the note", () => {
    expect(validateCopy({ ...good, subject: "Solo Leveling is back 🔥" }, ctx()).ok).toBe(false)
    expect(validateCopy({ ...good, editorsNote: `${good.editorsNote} Worth a look. 🔥` }, ctx()).ok).toBe(true)
    expect(validateCopy({ ...good, editorsNote: `${good.editorsNote} 🔥🔥` }, ctx()).ok).toBe(false)
  })

  it("rejects SHOUTING", () => {
    const result = validateCopy({ ...good, subject: "MASSIVE anime news today" }, ctx())
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reasons.join(" ")).toContain("shouting")
  })

  it("enforces the question-format rule both ways", () => {
    // A question is refused on a day whose format is something else...
    expect(validateCopy({ ...good, subject: "Ready for more anime?" }, ctx("statement")).ok).toBe(false)
    // ...and a question-format day needs an actual question.
    expect(validateCopy({ ...good, subject: "Solo Leveling season 3 is confirmed" }, ctx("question")).ok).toBe(false)
    expect(validateCopy({ ...good, subject: "What aired this morning?" }, ctx("question")).ok).toBe(true)
  })

  it("accepts the fixture copy that the previews render", () => {
    expect(validateCopy(FIXTURE_COPY, ctx("statement")).ok).toBe(true)
  })
})

describe("helpers", () => {
  it("normalises a subject for repeat comparison", () => {
    expect(normaliseSubject("Solo  Leveling — season 3!")).toBe("solo leveling season 3")
  })

  it("finds a banned phrase regardless of case", () => {
    expect(findBannedPhrase("BUCKLE UP everyone")).toBe("buckle up")
    expect(findBannedPhrase("Just the news today")).toBeNull()
  })

  it("leaves a trimmed real title alone", () => {
    expect(findUngroundedPhrase("Solo Leveling is back", content)).toBeNull()
  })

  it("catches an invented title", () => {
    expect(findUngroundedPhrase("Bleach Thousand Year Blood War part four", content)).not.toBeNull()
  })

  it("does not treat ordinary sentence capitals as a title", () => {
    expect(findUngroundedPhrase("The morning starts with news", content)).toBeNull()
  })
})

describe("subject formats", () => {
  it("lets a question through at most once a week", () => {
    expect(questionUsedRecently(["Anything good today?"])).toBe(true)
    expect(questionUsedRecently(["Anything good today?", "No question here"])).toBe(true)
    expect(questionUsedRecently(["No question here"])).toBe(false)
  })

  it("never picks a question when one is inside the cooldown", () => {
    const recent = ["Did you miss this?"]
    for (let seed = 0; seed < 200; seed += 1) {
      expect(pickSubjectFormat("lead-story", seed, recent)).not.toBe("question")
    }
  })

  it("maps layouts to formats", () => {
    expect(pickSubjectFormat("roundup", 1, [])).toBe("count")
    expect(pickSubjectFormat("week-ahead", 1, [])).toBe("name-led")
    expect(pickSubjectFormat("episode-drop", 1, [])).toBe("count")
  })
})

describe("fallback copy", () => {
  it("builds the documented subject shape from the top series", () => {
    const subject = fallbackSubject(content, "name-led")
    expect(subject.length).toBeLessThanOrEqual(MAX_SUBJECT_CHARS)
    expect(subject).toContain("Solo Leveling")
  })

  it("stays inside the length budget for every format", () => {
    for (const format of ["statement", "count", "question", "name-led"] as SubjectFormat[]) {
      const subject = fallbackSubject(content, format)
      expect(subject.length).toBeGreaterThan(0)
      expect(subject.length).toBeLessThanOrEqual(MAX_SUBJECT_CHARS)
    }
  })

  it("produces a usable copy object even with no content at all", () => {
    const empty: IssueContent = { ...content, topStory: null, posts: [], seriesGroups: [], airing: [], upcoming: [] }
    const copy = fallbackCopy(empty, "statement")
    expect(copy.subject.length).toBeGreaterThan(0)
    expect(copy.subject.length).toBeLessThanOrEqual(MAX_SUBJECT_CHARS)
    expect(copy.preheader.length).toBeGreaterThan(0)
    expect(copy.generatedBy).toBe("fallback")
  })
})

describe("buildMessages", () => {
  it("passes only our own content to the model", () => {
    const messages = buildMessages({ ...ctx(), issueDate: "2026-11-09" })
    const user = messages.find((message) => message.role === "user")?.content ?? ""
    expect(user).toContain("Solo Leveling season 3 is confirmed")
    expect(user).toContain("Dandadan")
    // Nothing from the original ANN article body is ever included.
    expect(user.toLowerCase()).not.toContain("animenewsnetwork")
  })
})

describe("callGroq", () => {
  const respond = (status: number, body: unknown, headers: Record<string, string> = {}) =>
    new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", ...headers } })

  it("reports a missing key without calling the network", async () => {
    let called = false
    const result = await callGroq([{ role: "user", content: "hi" }], {
      apiKey: " ",
      fetchImpl: (async () => {
        called = true
        return respond(200, {})
      }) as unknown as typeof fetch,
    })
    expect(result.ok).toBe(false)
    expect(called).toBe(false)
  })

  it("retries a 429 once and then gives up", async () => {
    let calls = 0
    const result = await callGroq([{ role: "user", content: "hi" }], {
      apiKey: "k",
      sleep: async () => {},
      fetchImpl: (async () => {
        calls += 1
        return respond(429, { message: "rate limited" })
      }) as unknown as typeof fetch,
    })
    expect(calls).toBe(2)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toContain("429")
  })

  it("returns the content on success", async () => {
    const result = await callGroq([{ role: "user", content: "hi" }], {
      apiKey: "k",
      fetchImpl: (async () =>
        respond(200, { choices: [{ message: { content: '{"subject":"x"}' } }] })) as unknown as typeof fetch,
    })
    expect(result).toEqual({ ok: true, content: '{"subject":"x"}' })
  })
})

describe("generateCopy", () => {
  const input = { content, layout: "lead-story" as const, issueDate: "2026-11-09", seed: 20_654, recentSubjects: [] }

  it("accepts a valid model answer on the first attempt", async () => {
    // The subject format rotates with the seed; pick one that is not a question
    // so the fixture subject is a valid answer for that day.
    let seed = 0
    while (pickSubjectFormat("lead-story", seed, []) === "question") seed += 1
    const result = await generateCopy({ ...input, seed }, {
      apiKey: "k",
      fetchImpl: (async () =>
        new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(good) } }] }), {
          status: 200,
          headers: { "content-type": "application/json" },
        })) as unknown as typeof fetch,
    })
    expect(result.usedModel).toBe(true)
    expect(result.copy.subject).toBe(good.subject)
    expect(result.copy.generatedBy).toBe("groq")
  })

  it("retries once on invalid JSON and falls back if it happens twice", async () => {
    let calls = 0
    const result = await generateCopy(input, {
      apiKey: "k",
      sleep: async () => {},
      fetchImpl: (async () => {
        calls += 1
        return new Response(JSON.stringify({ choices: [{ message: { content: "not json at all" } }] }), {
          status: 200,
          headers: { "content-type": "application/json" },
        })
      }) as unknown as typeof fetch,
    })
    expect(calls).toBe(2)
    expect(result.usedModel).toBe(false)
    expect(result.copy.generatedBy).toBe("fallback")
    expect(result.reasons).toContain("invalid_json")
    expect(result.copy.subject.length).toBeLessThanOrEqual(MAX_SUBJECT_CHARS)
  })

  it("falls back without calling twice when the model returns 429", async () => {
    let calls = 0
    const result = await generateCopy(input, {
      apiKey: "k",
      sleep: async () => {},
      fetchImpl: (async () => {
        calls += 1
        return new Response("{}", { status: 429 })
      }) as unknown as typeof fetch,
    })
    // callGroq already retried; generateCopy does not retry a transport failure again.
    expect(calls).toBe(2)
    expect(result.usedModel).toBe(false)
    expect(result.reasons.some((reason) => reason.includes("429"))).toBe(true)
  })
})
