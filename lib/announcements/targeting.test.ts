import { describe, expect, it } from "vitest"
import { classifyPath, isValidTargetKey, matchesTargets, normalizePathname } from "./targeting"

describe("classifyPath", () => {
  it("classifies the main routes", () => {
    expect(classifyPath("/")).toEqual({ kind: "home" })
    expect(classifyPath("/episodes")).toEqual({ kind: "episodes" })
    expect(classifyPath("/blog")).toEqual({ kind: "blog" })
    expect(classifyPath("/blog/my-post")).toEqual({ kind: "blog-post", slug: "my-post" })
    expect(classifyPath("/episodes/one-piece")).toEqual({ kind: "series", seriesSlug: "one-piece" })
    expect(classifyPath("/episodes/one-piece/ep-1")).toEqual({
      kind: "episode",
      seriesSlug: "one-piece",
      episodeSlug: "ep-1",
    })
  })

  it("does not treat reserved /episodes segments as series", () => {
    expect(classifyPath("/episodes/browse").kind).toBe("other")
    expect(classifyPath("/episodes/upcoming").kind).toBe("other")
    expect(classifyPath("/episodes/movies/some-movie").kind).toBe("other")
  })

  it("excludes admin and api", () => {
    expect(classifyPath("/admin/posts").kind).toBe("excluded")
    expect(classifyPath("/api/anything").kind).toBe("excluded")
  })

  it("normalizes trailing slashes, query strings and case", () => {
    expect(normalizePathname("/Blog/Foo/?utm=1#x")).toBe("/blog/foo")
    expect(classifyPath("/blog/foo/")).toEqual({ kind: "blog-post", slug: "foo" })
  })
})

describe("matchesTargets", () => {
  it("matches exact page kinds", () => {
    expect(matchesTargets("/", ["home"])).toBe(true)
    expect(matchesTargets("/blog", ["home"])).toBe(false)
    expect(matchesTargets("/episodes", ["episodes"])).toBe(true)
    expect(matchesTargets("/blog", ["blog"])).toBe(true)
  })

  it("matches one or all blog posts", () => {
    expect(matchesTargets("/blog/a", ["blog-post:a"])).toBe(true)
    expect(matchesTargets("/blog/b", ["blog-post:a"])).toBe(false)
    expect(matchesTargets("/blog/b", ["blog-post:*"])).toBe(true)
    expect(matchesTargets("/blog", ["blog-post:*"])).toBe(false)
  })

  it("matches series and episodes", () => {
    expect(matchesTargets("/episodes/naruto", ["series:naruto"])).toBe(true)
    expect(matchesTargets("/episodes/naruto", ["series:*"])).toBe(true)
    expect(matchesTargets("/episodes/naruto/ep-1", ["series:naruto"])).toBe(false)
    expect(matchesTargets("/episodes/naruto/ep-1", ["episode:*"])).toBe(true)
    expect(matchesTargets("/episodes/naruto/ep-1", ["episode-of:naruto"])).toBe(true)
    expect(matchesTargets("/episodes/naruto/ep-1", ["episode-of:bleach"])).toBe(false)
    expect(matchesTargets("/episodes/naruto/ep-1", ["episode:naruto/ep-1"])).toBe(true)
    expect(matchesTargets("/episodes/naruto/ep-2", ["episode:naruto/ep-1"])).toBe(false)
  })

  it("matches other pages exactly or by prefix", () => {
    expect(matchesTargets("/about", ["page:/about"])).toBe(true)
    expect(matchesTargets("/about/team", ["page:/about"])).toBe(false)
    expect(matchesTargets("/polls/best-anime", ["page:/polls/*"])).toBe(true)
    expect(matchesTargets("/polls", ["page:/polls/*"])).toBe(true)
    expect(matchesTargets("/pollsx", ["page:/polls/*"])).toBe(false)
  })

  it("'all' covers public pages but never admin or api", () => {
    expect(matchesTargets("/anything", ["all"])).toBe(true)
    expect(matchesTargets("/admin", ["all"])).toBe(false)
    expect(matchesTargets("/api/x", ["all"])).toBe(false)
  })

  it("no targets means no match", () => {
    expect(matchesTargets("/", [])).toBe(false)
    expect(matchesTargets("/", null)).toBe(false)
  })
})

describe("isValidTargetKey", () => {
  it("accepts well-formed keys", () => {
    for (const k of [
      "all",
      "home",
      "episodes",
      "blog",
      "blog-post:*",
      "blog-post:some-slug",
      "series:one-piece",
      "episode:*",
      "episode:one-piece/ep-1",
      "episode-of:one-piece",
      "page:/about",
      "page:/polls/*",
    ])
      expect(isValidTargetKey(k), k).toBe(true)
  })

  it("rejects malformed or dangerous keys", () => {
    for (const k of [
      "",
      "nope",
      "blog-post:",
      "blog-post:a b",
      "episode:one-piece",
      "episode:a/b/c",
      "page:about",
      "page:/admin",
      "page:/admin/posts",
      "page:/a?b=1",
      "series:<script>",
    ])
      expect(isValidTargetKey(k), k).toBe(false)
  })
})
