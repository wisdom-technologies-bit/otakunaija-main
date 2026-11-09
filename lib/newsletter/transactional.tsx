/**
 * Confirmation and test emails.
 *
 * Separate from the daily issue: no preheader trickery, no modules, one button.
 * Same header band and footer so a confirmation and the newsletter look like
 * they come from the same publication.
 */

import { render } from "@react-email/render"
import { Body, Container, Head, Html, Img, Link, Preview, Section, Text } from "@react-email/components"
import { applyToken, newsletterLinks, TOKEN_PLACEHOLDER, type RenderBrand } from "./render/context"
import { COLORS, DARK_MODE_CSS, FONTS } from "./render/theme"

export type ConfirmationEmail = { subject: string; html: string; text: string }

function Wordmark({ brand }: { brand: RenderBrand }) {
  return (
    <Section style={{ backgroundColor: COLORS.band, padding: "22px 0" }}>
      <table role="presentation" width="100%" cellPadding={0} cellSpacing={0} border={0}>
        <tbody>
          <tr>
            {brand.logoUrl ? (
              <td width={56} valign="middle" style={{ width: 56, paddingRight: 12 }}>
                <Img
                  src={brand.logoUrl}
                  alt={`${brand.fromName} logo`}
                  width={44}
                  height={44}
                  style={{ display: "block", borderRadius: 8 }}
                />
              </td>
            ) : null}
            <td valign="middle">
              <Text
                style={{
                  margin: 0,
                  fontFamily: FONTS.heading,
                  fontSize: 20,
                  lineHeight: "24px",
                  fontWeight: 700,
                  color: "#FFFFFF",
                }}
              >
                Otaku
                <span style={{ color: COLORS.accent }}>Naija</span>
              </Text>
            </td>
          </tr>
        </tbody>
      </table>
    </Section>
  )
}

function ConfirmationTemplate({
  brand,
  token,
  heading,
  body,
  buttonLabel,
}: {
  brand: RenderBrand
  token: string
  heading: string
  body: string
  buttonLabel: string
}) {
  const links = newsletterLinks(brand, token)
  return (
    <Html lang="en" dir="ltr">
      <Head>
        <meta name="color-scheme" content="light dark" />
        <meta name="supported-color-schemes" content="light dark" />
        <style dangerouslySetInnerHTML={{ __html: DARK_MODE_CSS }} />
      </Head>
      <Preview>{body}</Preview>
      <Body className="nl-page" style={{ margin: 0, padding: 0, backgroundColor: COLORS.paper }}>
        <table role="presentation" width="100%" cellPadding={0} cellSpacing={0} border={0}>
          <tbody>
            <tr>
              <td align="center" style={{ padding: "0 0 24px" }}>
                <Container style={{ width: "600px", maxWidth: "600px", backgroundColor: COLORS.surface }}>
                  <Wordmark brand={brand} />
                  <Section style={{ padding: "28px" }}>
                    <Text
                      className="nl-ink"
                      style={{
                        margin: 0,
                        fontFamily: FONTS.heading,
                        fontSize: 24,
                        lineHeight: "30px",
                        fontWeight: 700,
                        color: COLORS.ink,
                      }}
                    >
                      {heading}
                    </Text>
                    <Text
                      className="nl-body"
                      style={{
                        margin: "12px 0 0",
                        fontFamily: FONTS.body,
                        fontSize: 16,
                        lineHeight: "25px",
                        color: COLORS.body,
                      }}
                    >
                      {body}
                    </Text>
                    <Section style={{ padding: "22px 0 0" }}>
                      <table role="presentation" border={0} cellPadding={0} cellSpacing={0}>
                        <tbody>
                          <tr>
                            <td
                              align="center"
                              style={{ borderRadius: 6, backgroundColor: COLORS.accent }}
                            >
                              <Link
                                href={links.confirm}
                                style={{
                                  display: "inline-block",
                                  padding: "14px 24px",
                                  color: "#FFFFFF",
                                  fontFamily: FONTS.body,
                                  fontSize: 15,
                                  fontWeight: 700,
                                  textDecoration: "none",
                                }}
                              >
                                {buttonLabel}
                              </Link>
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </Section>
                    <Text
                      className="nl-muted"
                      style={{
                        margin: "20px 0 0",
                        fontFamily: FONTS.body,
                        fontSize: 12,
                        lineHeight: "18px",
                        color: COLORS.muted,
                      }}
                    >
                      Or paste this link into your browser: {links.confirm}
                    </Text>
                    <Text
                      className="nl-muted"
                      style={{
                        margin: "16px 0 0",
                        fontFamily: FONTS.body,
                        fontSize: 12,
                        lineHeight: "18px",
                        color: COLORS.muted,
                      }}
                    >
                      You are getting this because someone entered this address on otakunaija.name.ng. If that was
                      not you, ignore this email and nothing else will happen.
                    </Text>
                    <Text
                      className="nl-muted"
                      style={{
                        margin: "18px 0 0",
                        fontFamily: FONTS.body,
                        fontSize: 11,
                        lineHeight: "17px",
                        color: COLORS.muted,
                      }}
                    >
                      {brand.postalAddress}
                    </Text>
                  </Section>
                </Container>
              </td>
            </tr>
          </tbody>
        </table>
      </Body>
    </Html>
  )
}

export async function renderConfirmationEmail(brand: RenderBrand): Promise<ConfirmationEmail> {
  const html = await render(
    <ConfirmationTemplate
      brand={brand}
      token={TOKEN_PLACEHOLDER}
      heading="One tap and you are in"
      body="Confirm your email and the daily OtakuNaija briefing arrives every morning: the news that matters, new episodes, and what airs next."
      buttonLabel="Confirm my email"
    />,
    { pretty: false },
  )

  const links = newsletterLinks(brand, TOKEN_PLACEHOLDER)
  const text = [
    "OTAKUNAIJA — DAILY BRIEFING",
    "",
    "Confirm your email and the daily briefing arrives every morning: the news that matters, new episodes, and what airs next.",
    "",
    `Confirm: ${links.confirm}`,
    "",
    "If you did not ask for this, ignore this email and nothing else will happen.",
    brand.postalAddress,
  ].join("\n")

  return {
    subject: "Confirm your OtakuNaija briefing",
    html: applyToken(html, TOKEN_PLACEHOLDER),
    text,
  }
}

/** The body of a test send: the real issue HTML, labelled as a test. */
export function testSubject(subject: string): string {
  return `[TEST] ${subject}`.slice(0, 120)
}
