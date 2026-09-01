// src/pages/TermsCondition.jsx
import { useTheme } from "../context/ThemeContext";
import { useNavigate } from "react-router-dom";

const badgeMapLight = {
  blue: "bg-blue-500/10 text-blue-600",
  amber: "bg-amber-500/10 text-amber-600",
  red: "bg-red-500/10 text-red-600",
  zinc: "bg-zinc-500/10 text-zinc-600",
  purple: "bg-purple-500/10 text-purple-600",
  orange: "bg-orange-500/10 text-orange-600",
  teal: "bg-teal-500/10 text-teal-600",
  indigo: "bg-indigo-500/10 text-indigo-600",
};

const badgeMapDark = {
  blue: "bg-blue-500/10 text-blue-400 border border-blue-500/20",
  amber: "bg-amber-500/10 text-amber-400 border border-amber-500/20",
  red: "bg-red-500/10 text-red-400 border border-red-500/20",
  zinc: "bg-zinc-500/10 text-zinc-400 border border-zinc-500/20",
  purple: "bg-purple-500/10 text-purple-400 border border-purple-500/20",
  orange: "bg-orange-500/10 text-orange-400 border border-orange-500/20",
  teal: "bg-teal-500/10 text-teal-400 border border-teal-500/20",
  indigo: "bg-indigo-500/10 text-indigo-400 border border-indigo-500/20",
};

const TermsCondition = () => {
  const { theme } = useTheme();
  const navigate = useNavigate();
  const isWhiteTheme = theme === "white";

  const badgeMap = isWhiteTheme ? badgeMapLight : badgeMapDark;

  const Badge = ({ color, children }) => (
    <span
      className={`text-[10px] font-semibold px-2.5 py-0.5 rounded-full uppercase tracking-wider whitespace-nowrap border ${
        badgeMap[color]
      }`}
    >
      {children}
    </span>
  );

  // ─── Theme‑aware styles ──────────────────────────────────────────
  const pageBg = isWhiteTheme ? "bg-gray-50" : "bg-zinc-950";
  const pageText = isWhiteTheme ? "text-gray-800" : "text-zinc-300";
  const headerBg = isWhiteTheme ? "bg-white" : "bg-zinc-900";
  const borderColor = isWhiteTheme ? "border-gray-200" : "border-zinc-800";
  const mutedText = isWhiteTheme ? "text-gray-400" : "text-zinc-500";
  const textSecondary = isWhiteTheme ? "text-gray-700" : "text-zinc-400";
  const textMuted = isWhiteTheme ? "text-gray-500" : "text-zinc-500";
  const cardBg = isWhiteTheme ? "bg-white" : "bg-zinc-900";
  const dividerLine = isWhiteTheme ? "border-gray-100" : "border-zinc-800";
  const headingText = isWhiteTheme ? "text-gray-900" : "text-white";

  return (
    <div
      className={`min-h-screen w-full flex flex-col font-sans transition-colors duration-200 ${pageBg} ${pageText}`}
    >
      {/* ─── HEADER ─── */}
      <header
        className={`h-12 flex items-center px-6 border-b shrink-0 ${headerBg} ${borderColor}`}
      >
        <button
          onClick={() => navigate("/home")}
          className={`
            flex items-center gap-2 text-xs font-medium transition-all duration-200
            ${isWhiteTheme ? "text-gray-500 hover:text-gray-900" : "text-zinc-400 hover:text-white"}
            focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded px-2 py-1
            ${isWhiteTheme ? "focus:ring-offset-white" : "focus:ring-offset-zinc-900"}
          `}
          aria-label="Go back to Home"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          <span>Back</span>
        </button>
        <h1 className="flex-1 text-center text-xs font-bold tracking-wider select-none">
          Terms of Service
        </h1>
        <div className="w-20" />
      </header>

      {/* ─── SCROLLABLE CONTENT ─── */}
      <div className="flex-1 overflow-y-auto px-6 py-12 md:py-16">
        <div className="max-w-3xl mx-auto space-y-10">
          {/* Title Section */}
          <div>
            <h1 className={`text-3xl font-extrabold tracking-tight mb-2 ${headingText}`}>
              Terms of Service
            </h1>
            <p className={`text-xs ${mutedText}`}>
              Last updated: July 10, 2026
            </p>
            <div className="h-1 w-16 bg-blue-500 rounded mt-4" />
          </div>

          <p className={`text-sm leading-relaxed font-medium ${textSecondary}`}>
            Please read these Terms of Service carefully before using the Mock API Manager
            ("the Service", "MockAPI"). By accessing or using the Service, you legally agree
            to be bound by these provisions in full.
          </p>

          <hr className={dividerLine} />

          {/* Section 1 */}
          <section className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className={`text-lg font-bold tracking-tight ${headingText}`}>
                1. Agreement & Acceptance
              </h2>
              <Badge color="blue">TL;DR: Using this = agreeing</Badge>
            </div>
            <p className={`text-sm leading-relaxed ${textSecondary}`}>
              By accessing, deploying, or interacting with the Service, you create a legally
              binding agreement between yourself and the creators of this application. If you
              represent an entity, you warrant that you have authority to bind that entity. If
              you do not accept every clause outlined here, you are strictly prohibited from
              using the platform.
            </p>
          </section>

          {/* Section 2 */}
          <section className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className={`text-lg font-bold tracking-tight ${headingText}`}>
                2. Scope of Service & Non-Production Use
              </h2>
              <Badge color="amber">TL;DR: Testing only, not for real apps</Badge>
            </div>
            <div
              className={`text-sm leading-relaxed p-4 rounded-xl border ${
                isWhiteTheme
                  ? "bg-amber-50 border-amber-200 text-gray-700"
                  : "bg-amber-500/10 border-amber-500/20 text-amber-400"
              }`}
            >
              <p className={`font-bold ${isWhiteTheme ? "text-amber-600" : "text-amber-400"}`}>
                ⚠️ Sandbox Only – Not for Production
              </p>
              <p className={`mt-2 ${isWhiteTheme ? "text-gray-700" : "text-zinc-300"}`}>
                The Service functions solely as a sandbox workspace for application prototyping,
                mock testing endpoints, and educational workflows. All server payloads and routes
                are simulated. The architecture is explicitly{" "}
                <strong>not designed, hardened, or intended for critical production
                applications</strong>{" "}
                or high-availability backend environments. Do not use this for real user data or
                live customer-facing systems.
              </p>
            </div>
          </section>

          {/* Section 3 */}
          <section className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className={`text-lg font-bold tracking-tight ${headingText}`}>
                3. Data Constraints & Absolute Prohibitions
              </h2>
              <Badge color="red">TL;DR: No real sensitive data, ever</Badge>
            </div>
            <div
              className={`text-sm leading-relaxed p-4 rounded-xl border ${
                isWhiteTheme
                  ? "bg-red-50 border-red-200 text-gray-700"
                  : "bg-red-500/10 border-red-500/20 text-red-400"
              }`}
            >
              <p className={`font-bold ${isWhiteTheme ? "text-red-600" : "text-red-400"}`}>
                🛑 Absolutely No Real Sensitive Data
              </p>
              <p className={`mt-2 ${isWhiteTheme ? "text-gray-700" : "text-zinc-300"}`}>
                You are entirely responsible and liable for any payloads generated or stored via
                your account. You are subject to the following structural restrictions:
              </p>
              <ul className={`list-disc pl-5 mt-2 space-y-1 ${isWhiteTheme ? "text-gray-700" : "text-zinc-300"}`}>
                <li>
                  <strong>No PII or Financial Data:</strong> Never supply real passwords,
                  credit/debit card numbers, Social Security records, or any personally
                  identifiable information. Always use randomized placeholder mocks (e.g., the
                  built-in Faker.js generators).
                </li>
                <li>
                  <strong>No Systems Abuse:</strong> You are barred from using automated load
                  tools, DDoS attacks, scraping, stress-testing beyond reasonable limits, or
                  deliberately attempting to crash or overload the system.
                </li>
                <li>
                  <strong>Consequences:</strong> Violation of these rules may result in immediate
                  suspension or termination of your account, permanent deletion of your project
                  data and API keys, and — in severe cases — legal action.
                </li>
              </ul>
            </div>
          </section>

          {/* Section 4 */}
          <section className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className={`text-lg font-bold tracking-tight ${headingText}`}>
                4. Disclaimer of Warranties
              </h2>
              <Badge color="zinc">TL;DR: Zero promises things won't break</Badge>
            </div>
            <div
              className={`text-sm leading-relaxed uppercase font-mono tracking-tight p-4 rounded-xl border ${
                isWhiteTheme
                  ? "bg-zinc-50 border-zinc-200 text-zinc-700"
                  : "bg-zinc-800/50 border-zinc-700 text-zinc-400"
              }`}
            >
              The platform is delivered "AS IS" and "AS AVAILABLE" without warranties of any
              nature — whether express, implied, statutory, or otherwise. We disclaim any
              guarantees regarding server uptime, data persistence, completeness of logs, or that
              mock endpoints will behave consistently with production standards.
            </div>
          </section>

          {/* Section 5 */}
          <section className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className={`text-lg font-bold tracking-tight ${headingText}`}>
                5. Absolute Limitation of Liability
              </h2>
              <Badge color="red">TL;DR: If you lose data, you can't sue us</Badge>
            </div>
            <div
              className={`text-sm leading-relaxed p-4 rounded-xl border ${
                isWhiteTheme
                  ? "bg-red-50 border-red-200 text-gray-700"
                  : "bg-red-500/10 border-red-500/20 text-red-400"
              }`}
            >
              <p className={`font-bold ${isWhiteTheme ? "text-red-600" : "text-red-400"}`}>🚨 You Assume All Risk</p>
              <p className={`mt-2 ${isWhiteTheme ? "text-gray-700" : "text-zinc-300"}`}>
                To the absolute maximum extent permitted under applicable law, the developers,
                maintainers, and operators shall never be held liable for any damages
                whatsoever — including direct financial loss, corruption of codebases, server
                interruptions, lost business opportunities, or security breaches resulting from
                your configurations or reliance on mock environments.
              </p>
            </div>
          </section>

          {/* Section 6 */}
          <section className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className={`text-lg font-bold tracking-tight ${headingText}`}>
                6. Intellectual Property & Account Termination
              </h2>
              <Badge color="zinc">TL;DR: Bad actors get banned</Badge>
            </div>
            <p className={`text-sm leading-relaxed ${textSecondary}`}>
              We own all proprietary interface architecture, styling assets, and structural
              tooling. We reserve the unrestricted right to terminate or freeze access, remove
              project histories, and invalidate keys instantly and without warning if malicious
              intent or a terms violation is discovered.
            </p>
          </section>

          {/* Section 7 */}
          <section className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className={`text-lg font-bold tracking-tight ${headingText}`}>
                7. Authentication Priority & Request Validation
              </h2>
              <Badge color="purple">TL;DR: Query/body checked before auth</Badge>
            </div>
            <div className={`space-y-3 text-sm leading-relaxed ${textSecondary}`}>
              <p>
                The mock engine enforces a deterministic validation order for every incoming
                request. This order is critical to understand — it is <strong>not</strong>{" "}
                "auth first".
              </p>
              <div
                className={`border-l-4 pl-4 py-2 text-xs font-mono tracking-tight ${
                  isWhiteTheme
                    ? "border-purple-400 bg-purple-50/50 text-gray-700"
                    : "border-purple-600 bg-purple-950/20 text-zinc-300"
                }`}
              >
                <p>
                  <strong className="text-purple-600 dark:text-purple-400">Actual processing order:</strong>
                </p>
                <ol className="list-decimal ml-4 mt-1 space-y-1">
                  <li>Rate limit check</li>
                  <li>Simulated latency delay</li>
                  <li>Required query params</li>
                  <li>Required request body fields</li>
                  <li>Authentication (Bearer / API Key)</li>
                  <li>Custom headers</li>
                  <li>Cookies</li>
                </ol>
                <p className="mt-2 text-amber-600 dark:text-amber-400">
                  ⚠️ <strong>Effect:</strong> A request with a missing query parameter is rejected
                  with a <code>400</code> before your <code>Authorization</code> header is ever
                  checked — even if that header is invalid or missing. Unauthenticated requests
                  still consume your <code>rateLimit</code> quota and incur the full{" "}
                  <code>latency</code> delay.
                </p>
                <p className="mt-2 text-purple-600 dark:text-purple-400">
                  🔐 <strong>When <code>isAuthEnabled: true</code>:</strong> The primary
                  credential (Bearer JWT or API Key) is checked exclusively via the{" "}
                  <code>Authorization</code> header or the <code>X-API-Key</code> header /{" "}
                  <code>api_key</code> query param. A generic <code>Authorization</code> entry
                  inside custom headers is <strong>always ignored</strong> — it can never
                  substitute for the primary check.
                </p>
                <p className="mt-2 text-blue-600 dark:text-blue-400">
                  🔒 <strong>Custom headers & cookies:</strong> Checked <em>after</em> the primary
                  credential and must match exactly. They are additive constraints, never a
                  substitute for a missing or invalid primary credential.
                </p>
                <p className="mt-2 text-emerald-600 dark:text-emerald-400">
                  ⬇️ <strong>When <code>isAuthEnabled: false</code>:</strong> Authentication is
                  skipped entirely — including custom headers and cookies configured for that
                  endpoint. Disabling auth disables <em>all</em> auth-layer checks.
                </p>
              </div>
            </div>
          </section>

          {/* Section 8 */}
          <section className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className={`text-lg font-bold tracking-tight ${headingText}`}>
                8. Validation Failures & Ignored Input
              </h2>
              <Badge color="orange">TL;DR: Bad definitions get rejected up front</Badge>
            </div>
            <div
              className={`text-sm leading-relaxed p-4 rounded-xl border ${
                isWhiteTheme
                  ? "bg-orange-50 border-orange-200 text-gray-700"
                  : "bg-orange-500/10 border-orange-500/20 text-orange-400"
              }`}
            >
              <p className={`font-bold ${isWhiteTheme ? "text-orange-600" : "text-orange-400"}`}>
                ⚠️ Bad Definitions Get Rejected Up Front
              </p>
              <ul className={`list-disc pl-5 mt-2 space-y-1 ${isWhiteTheme ? "text-gray-700" : "text-zinc-300"}`}>
                <li>
                  <strong>Rejected outright (definition never saved):</strong> a non-integer{" "}
                  <code>statusCode</code> outside 100–599, negative <code>latency</code> or{" "}
                  <code>rateLimit</code>, a header/cookie/query entry whose <code>key</code> isn't
                  a string, or an unrecognized <code>authScheme</code> while{" "}
                  <code>isAuthEnabled</code> is true. Your save request receives a{" "}
                  <code>400</code> and nothing is written.
                </li>
                <li>
                  <strong>Silently skipped at request time:</strong> if a stored header or cookie
                  rule lacks a valid string key, that single rule is skipped — every other rule
                  still applies normally.
                </li>
                <li>
                  <strong>Query params:</strong> required by default. Add{" "}
                  <code>"required": false</code> explicitly to make one optional.
                </li>
                <li>
                  <strong>Request body:</strong> never checked for <code>GET</code>,{" "}
                  <code>HEAD</code>, or <code>DELETE</code> requests, regardless of what you
                  configure.
                </li>
                <li>
                  <strong>Unresolvable Faker placeholders:</strong> if{" "}
                  <code>{"{{faker.someUnknownPath}}"}</code> doesn't resolve, it is returned to
                  you literally — the request does not fail.
                </li>
                <li>
                  <strong>Rate limiting is per-container, not global:</strong> each project's mock
                  instance tracks its own limits in memory and resets on container restart.
                </li>
              </ul>
            </div>
          </section>

          {/* Section 9 */}
          <section className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className={`text-lg font-bold tracking-tight ${headingText}`}>
                9. Cookie Policy & Data Privacy
              </h2>
              <Badge color="teal">TL;DR: Essential cookies only, no tracking</Badge>
            </div>
            <p className={`text-sm leading-relaxed ${textSecondary}`}>
              The Service uses cookies solely to enable core functionality and improve user
              experience. We do not sell, share, or use cookies for cross-site advertising. Our
              use of cookies is limited to:
            </p>
            <ul className={`list-disc pl-5 text-sm space-y-1 ${textSecondary}`}>
              <li>
                <strong>Session Management:</strong> Cookies maintain your authenticated session
                (e.g., <code>sessionToken</code>) and simulate API authentication flows.
              </li>
              <li>
                <strong>User Preferences:</strong> Cookies store your UI preferences (e.g.,{" "}
                <code>userPref</code> for dark/light mode).
              </li>
              <li>
                <strong>Security & Integrity:</strong> <code>HttpOnly</code> and{" "}
                <code>SameSite</code> attributes are automatically applied to protect against XSS
                and CSRF.
              </li>
              <li>
                <strong>Dual-purpose mock cookies:</strong> within an API definition, the same{" "}
                <code>cookies</code> array is used both to validate incoming request cookies{" "}
                <em>and</em> to set outbound response cookies on a match. Configure it once — it
                governs both directions.
              </li>
            </ul>
            <div
              className={`p-4 rounded-xl border text-sm ${
                isWhiteTheme
                  ? "bg-amber-50 border-amber-200 text-gray-700"
                  : "bg-amber-500/10 border-amber-500/20 text-amber-300"
              }`}
            >
              <p className="font-bold">🔒 Your Privacy Rights:</p>
              <p className={`mt-1 ${isWhiteTheme ? "text-gray-700" : "text-zinc-300"}`}>
                Since the Service is a <strong>local development tool</strong>, we do not transmit
                any cookie data to external servers. All cookies are scoped to your local machine
                or test domain. You have the right to clear all cookies at any time via your
                browser settings. This complies with the "strictly necessary" exemption under
                GDPR/ePrivacy for EU users.
              </p>
            </div>
          </section>

          {/* Section 10 */}
          <section className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className={`text-lg font-bold tracking-tight ${headingText}`}>
                10. Features & Dynamic Mocking
              </h2>
              <Badge color="indigo">TL;DR: Define APIs, toggle AI responses, get fake data</Badge>
            </div>
            <div className={`space-y-3 text-sm leading-relaxed ${textSecondary}`}>
              <p>
                <strong>How to define an API:</strong> Provide a URL path (e.g.,{" "}
                <code>/users/:id</code>), select an HTTP method, and define your request/response
                schemas. Enforce authentication (Bearer/API Key), custom headers, and cookies
                directly through the UI.
              </p>
              <div
                className={`border-l-4 pl-4 py-2 text-xs font-mono tracking-tight ${
                  isWhiteTheme
                    ? "border-indigo-400 bg-indigo-50/50 text-gray-700"
                    : "border-indigo-600 bg-indigo-950/20 text-zinc-300"
                }`}
              >
                <p>
                  <strong className="text-indigo-600 dark:text-indigo-400">🤖 Dynamic Responses:</strong> Enable{" "}
                  <code>"airesponse": true</code> to use Faker.js placeholders:
                </p>
                <ul className="list-disc ml-4 mt-2 space-y-1">
                  <li><code>{"{{faker.person.fullName}}"}</code> → "Dr. John Doe"</li>
                  <li><code>{"{{faker.internet.email}}"}</code> → "john@example.net"</li>
                  <li><code>{"{{faker.string.uuid}}"}</code> → "a7d3f8e2-..."</li>
                  <li><code>{"{{faker.date.recent}}"}</code> → "2026-06-20T15:32:00Z"</li>
                </ul>
                <p className="mt-2 text-emerald-600 dark:text-emerald-400">
                  ✅ The server recursively scans every nested field — arrays, objects, and
                  strings — to replace placeholders on every request. When{" "}
                  <code>airesponse</code> is <code>false</code>, no substitution happens and
                  placeholder text is returned as-is.
                </p>
              </div>
              <p>
                <strong>Authentication Flow:</strong> Strictly follows the priority and processing
                order described in <strong>Section 7</strong>. Combine Bearer tokens with custom
                headers and cookies to simulate complex real-world authorization.
              </p>
              <p className={`text-xs ${textMuted}`}>
                💡 <strong>Pro Tip:</strong> Combine dynamic responses with rate limiting (
                <code>rateLimit</code>) and latency (<code>latency</code>) to mimic production API
                behaviour more realistically.
              </p>
            </div>
          </section>

          {/* Section 11 */}
          <section className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className={`text-lg font-bold tracking-tight ${headingText}`}>
                11. User Responsibilities & Consequences
              </h2>
              <Badge color="blue">TL;DR: Misuse it, lose access</Badge>
            </div>
            <div
              className={`text-sm leading-relaxed p-4 rounded-xl border ${
                isWhiteTheme
                  ? "bg-blue-50 border-blue-200 text-gray-700"
                  : "bg-blue-500/10 border-blue-500/20 text-blue-400"
              }`}
            >
              <p className={`font-bold ${isWhiteTheme ? "text-blue-600" : "text-blue-400"}`}>
                📋 You Are Responsible For:
              </p>
              <ul className={`list-disc pl-5 mt-2 space-y-1 ${isWhiteTheme ? "text-gray-700" : "text-zinc-300"}`}>
                <li>
                  <strong>API Definitions:</strong> the correctness and security of your mock
                  definitions. Misconfigured auth or validation rules may cause unexpected
                  behaviour.
                </li>
                <li>
                  <strong>Rate Limits & Resources:</strong> excessive API calls may exhaust your
                  rate limit or trigger container restarts, leading to temporary unavailability.
                  Plan your tests accordingly.
                </li>
                <li>
                  <strong>Data Persistence:</strong> all mock data and container states are
                  ephemeral — they reset on container restarts or redeployments. Do not rely on
                  them for long-term storage.
                </li>
                <li>
                  <strong>Compliance:</strong> you must comply with all applicable laws and
                  regulations when using the Service. Use only for lawful testing and
                  development.
                </li>
              </ul>
              <p className={`mt-3 font-bold ${isWhiteTheme ? "text-red-600" : "text-red-400"}`}>
                ⚠️ Consequences of Violation:
              </p>
              <ul className={`list-disc pl-5 mt-1 space-y-1 ${isWhiteTheme ? "text-red-700" : "text-red-400"}`}>
                <li>Immediate suspension or termination of your account.</li>
                <li>Permanent deletion of your project data and API keys.</li>
                <li>Legal action in cases of severe abuse or illegal activity.</li>
              </ul>
            </div>
          </section>

          {/* Section 12 */}
          <section className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className={`text-lg font-bold tracking-tight ${headingText}`}>
                12. Modifications & Inquiries
              </h2>
              <Badge color="blue">TL;DR: Check here for updates</Badge>
            </div>
            <p className={`text-sm leading-relaxed ${textSecondary}`}>
              These terms are fluid and subject to revision. Continued use of the platform
              following any adjustment reflects binding acceptance of the updated terms. For
              legal, compliance, or feature inquiries, contact us at:
            </p>
            <div className="flex flex-col space-y-1 text-sm">
              <a
                href="mailto:adityaboxi2005@gmail.com"
                className="text-blue-600 dark:text-blue-400 hover:underline hover:text-blue-500 font-medium transition-colors"
              >
                adityaboxi2005@gmail.com
              </a>
              <a
                href="mailto:krishnaboxi1983@gmail.com"
                className="text-blue-600 dark:text-blue-400 hover:underline hover:text-blue-500 font-medium transition-colors"
              >
                krishnaboxi1983@gmail.com
              </a>
            </div>
          </section>

          {/* Footer */}
          <hr className={dividerLine} />
          <p className={`text-[10px] text-center ${mutedText}`}>
            By using the Service, you acknowledge that you have read, understood, and agreed to
            these Terms of Service.
          </p>
        </div>
      </div>
    </div>
  );
};

export default TermsCondition;