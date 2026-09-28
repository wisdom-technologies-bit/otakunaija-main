import { timingSafeEqual } from 'node:crypto'

export function hasValidPlayApiKey(request: Request): boolean {
  const expected = process.env.PLAY_API_KEY
  const provided = request.headers.get('x-play-api-key')

  if (!expected || provided === null) return false

  const expectedBuffer = Buffer.from(expected, 'utf8')
  const providedBuffer = Buffer.from(provided, 'utf8')
  const comparisonLength = Math.max(expectedBuffer.length, providedBuffer.length)
  const paddedExpected = Buffer.alloc(comparisonLength)
  const paddedProvided = Buffer.alloc(comparisonLength)

  expectedBuffer.copy(paddedExpected)
  providedBuffer.copy(paddedProvided)

  return timingSafeEqual(paddedExpected, paddedProvided) && expectedBuffer.length === providedBuffer.length
}

export function unauthorizedResponse() {
  return Response.json({ error: 'UNAUTHORIZED' }, { status: 401 })
}
