import { useTheme } from "../context/ThemeContext";
import { useNavigate } from "react-router-dom";

const TermsCondition = () => {
  const { theme } = useTheme();
  const navigate = useNavigate();
  const isWhiteTheme = theme === "white";

  return (
    <div
      className={`h-screen w-full flex flex-col overflow-hidden font-sans ${
        isWhiteTheme ? "bg-white text-gray-800" : "bg-[#1e1e24] text-gray-300"
      }`}
    >
      <div
        className={`h-12 shrink-0 flex items-center px-6 border-b z-10 ${
          isWhiteTheme
            ? "bg-white border-gray-200"
            : "bg-[#2b2d31] border-zinc-700/50"
        }`}
      >
        <button
          onClick={() => navigate("/home")}
          className={`text-xs font-medium flex items-center gap-2 tracking-wide uppercase transition-colors ${
            isWhiteTheme
              ? "text-gray-500 hover:text-gray-900"
              : "text-gray-400 hover:text-white"
          }`}
        >
          ← Back to Home
        </button>
      </div>

      {/* -------- SCROLLABLE CONTENT -------- */}
      <div className="flex-1 overflow-y-auto px-6 py-12 md:py-16">
        <div className="max-w-2xl mx-auto space-y-10">
          {/* -------- TITLE & DATE -------- */}
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight mb-2">
              Terms of Service
            </h1>
            <p
              className={`text-xs ${
                isWhiteTheme ? "text-gray-400" : "text-zinc-500"
              }`}
            >
              Last updated: July 03, 2026
            </p>
            <div className="h-1 w-12 bg-blue-500 rounded mt-4"></div>
          </div>

          <p className="text-sm leading-relaxed font-medium">
            Please read these Terms of Service carefully before using the Mock
            API Manager ("the Service"). By accessing or using the Service, you
            legally agree to be bound by these provisions.
          </p>

          <hr
            className={isWhiteTheme ? "border-gray-100" : "border-zinc-800"}
          />

          {/* -------- SECTION 1: AGREEMENT -------- */}
          <section className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg font-bold tracking-tight">
                1. Agreement & Acceptance
              </h2>
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-blue-500/10 text-blue-500 uppercase tracking-wider">
                TL;DR: Using this = agreeing
              </span>
            </div>
            <p className="text-sm opacity-85 leading-relaxed">
              By accessing, deploying, or interacting with the Service, you
              create a legally binding agreement between yourself and the
              creators of this application. If you represent an entity, you
              warrant that you have authority to bind that entity. If you do not
              accept all clauses outlined here, you are strictly prohibited from
              using the platform.
            </p>
          </section>

          {/* -------- SECTION 2: SCOPE -------- */}
          <section className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg font-bold tracking-tight">
                2. Scope of Service & Non-Production Use
              </h2>
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-amber-500/10 text-amber-500 uppercase tracking-wider">
                TL;DR: Testing only, not for real apps
              </span>
            </div>
            <p className="text-sm opacity-85 leading-relaxed">
              The Service functions solely as a sandbox workspace for
              application prototyping, mock testing endpoints, and educational
              workflows. All server payloads and routes are simulated. The
              architecture is explicitly{" "}
              <strong>
                not designed, hardened, or intended for critical production
                applications
              </strong>{" "}
              or high-availability backend environments.
            </p>
          </section>

          {/* -------- SECTION 3: DATA CONSTRAINTS -------- */}
          <section className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg font-bold tracking-tight">
                3. Data Constraints & Absolute Prohibitions
              </h2>
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-red-500/10 text-red-500 uppercase tracking-wider">
                TL;DR: ABSOLUTELY NO REAL SENSITIVE DATA
              </span>
            </div>
            <p className="text-sm opacity-85 leading-relaxed">
              You are entirely liable for any payloads generated or stored via
              your API keys. You are subject to the following structural
              restrictions:
            </p>
            <ul className="list-disc pl-5 text-sm space-y-2 opacity-85">
              <li>
                <strong>No PII or Financial Data:</strong> You must not supply
                real passwords, actual credit/debit numbers, Social Security
                records, or Personally Identifiable Information (PII). Always
                employ randomized placeholder mocks.
              </li>
              <li>
                <strong>No Systems Abuse:</strong> You are barred from using
                automated load tools to scrape, DDOS, stress-test
                infrastructure, or deliberately attempt to exceed system
                constraints.
              </li>
            </ul>
          </section>

          {/* -------- SECTION 4: DISCLAIMER -------- */}
          <section className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg font-bold tracking-tight">
                4. Disclaimer of Warranties
              </h2>
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-zinc-500/20 text-zinc-400 uppercase tracking-wider">
                TL;DR: Zero promises things won't break
              </span>
            </div>
            <p className="text-sm opacity-85 leading-relaxed uppercase font-mono tracking-tight text-xs bg-zinc-500/5 p-3 rounded border border-zinc-500/10">
              The platform is delivered "AS IS" and "AS AVAILABLE" without
              warranties of any nature—whether express, implied, statutory, or
              otherwise. We disclaim any guarantees regarding server uptime,
              data persistence, completeness of logs, or that mock endpoints
              will accurately behave relative to production standards.
            </p>
          </section>

          {/* -------- SECTION 5: LIABILITY -------- */}
          <section className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg font-bold tracking-tight">
                5. Absolute Limitation of Liability
              </h2>
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-red-500/10 text-red-500 uppercase tracking-wider">
                TL;DR: If you lose data, you can't sue us
              </span>
            </div>
            <p className="text-sm opacity-85 leading-relaxed">
              To the absolute maximum extent permitted under applicable law, the
              developers, maintainers, and operators shall never be held liable
              for any damages whatsoever. This includes direct financial loss,
              corruption of codebases, server interruptions, lost business
              opportunities, or security breaches resulting from your
              configurations or reliance on mock environments.
            </p>
          </section>

          {/* -------- SECTION 6: IP & TERMINATION -------- */}
          <section className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg font-bold tracking-tight">
                6. IP & Account Termination
              </h2>
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-zinc-500/20 text-zinc-400 uppercase tracking-wider">
                TL;DR: Bad actors get banned
              </span>
            </div>
            <p className="text-sm opacity-85 leading-relaxed">
              We own all source proprietary interface architecture, styling
              assets, and structural tooling properties. We reserve the
              unrestricted right to terminate or freeze access controls, remove
              project histories, and invalidate keys instantly without warning
              if malicious intent or terms violations are discovered.
            </p>
          </section>

          {/* -------- SECTION 7: AUTHENTICATION PRIORITY -------- */}
          <section className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg font-bold tracking-tight">
                7. Authentication Priority & Request Validation
              </h2>
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-purple-500/10 text-purple-500 uppercase tracking-wider">
                TL;DR: Query/body checked before auth, not after
              </span>
            </div>
            <div className="space-y-3 text-sm opacity-85 leading-relaxed">
              <p>
                The mock engine enforces a deterministic validation order for
                every incoming request. Understanding this order matters,
                because it is <strong>not</strong> "auth first" — query and
                body checks happen before authentication is ever evaluated.
              </p>
              <div
                className={`border-l-4 pl-4 py-2 text-xs font-mono tracking-tight ${
                  isWhiteTheme
                    ? "border-purple-400 bg-purple-50/50 text-gray-700"
                    : "border-purple-600 bg-purple-950/20 text-gray-300"
                }`}
              >
                <p>
                  <strong className="text-purple-500">Actual processing order:</strong>{" "}
                  (1) rate limit check → (2) simulated latency delay → (3)
                  required query params → (4) required request body fields →
                  (5) authentication (Bearer / API Key) → (6) custom headers →
                  (7) cookies.
                </p>
                <p className="mt-2">
                  <strong className="text-amber-500">⚠️ Practical effect:</strong>{" "}
                  A request with a missing query parameter is rejected with a{" "}
                  <code>400</code> before your <code>Authorization</code> header
                  is ever checked — even if that header is wrong or missing
                  too. Unauthenticated requests still consume your{" "}
                  <code>rateLimit</code> quota and incur the full{" "}
                  <code>latency</code> delay before being rejected for any
                  reason, including bad auth.
                </p>
                <p className="mt-2">
                  <strong className="text-purple-500">🔐 When <code>isAuthEnabled: true</code>:</strong>{" "}
                  Bearer JWT or API Key is the exclusive primary credential,
                  checked via the <code>Authorization</code> header or{" "}
                  <code>X-API-Key</code> header / <code>api_key</code> query
                  param. A generic <code>Authorization</code> entry inside your
                  custom headers array is <strong>always ignored</strong> —
                  it can never substitute for or conflict with the primary
                  check.
                </p>
                <p className="mt-2">
                  <strong className="text-blue-500">🔒 Custom headers & cookies:</strong>{" "}
                  Checked <em>after</em> the primary credential and must match
                  their configured values exactly. They are additive
                  constraints, never a substitute for a missing or invalid
                  primary credential.
                </p>
                <p className="mt-2">
                  <strong className="text-emerald-500">⬇️ When <code>isAuthEnabled: false</code>:</strong>{" "}
                  Authentication is skipped entirely — including custom
                  headers and cookies configured for that endpoint. Disabling
                  auth disables <em>all</em> auth-layer checks, not just the
                  primary credential.
                </p>
              </div>
            </div>
          </section>

          {/* -------- SECTION 8: VALIDATION FAILURES & IGNORED INPUT -------- */}
          <section className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg font-bold tracking-tight">
                8. Validation Failures & Ignored Input
              </h2>
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-orange-500/10 text-orange-500 uppercase tracking-wider">
                TL;DR: Bad definitions get rejected up front
              </span>
            </div>
            <div className="space-y-3 text-sm opacity-85 leading-relaxed">
              <p>
                Because you can input anything through the UI, the engine
                validates the <em>shape</em> of an API definition before it is
                ever stored — not just at request time.
              </p>
              <ul className="list-disc pl-5 space-y-2">
                <li>
                  <strong>Rejected outright (definition never saved):</strong>{" "}
                  a non-integer <code>statusCode</code> outside 100–599, a
                  negative <code>latency</code> or <code>rateLimit</code>, a
                  header/cookie/query entry whose <code>key</code> isn't a
                  string, or an unrecognized <code>authScheme</code> while{" "}
                  <code>isAuthEnabled</code> is true. Your save request
                  receives a <code>400</code> and nothing is written.
                </li>
                <li>
                  <strong>Silently skipped at request time:</strong> if a
                  stored header or cookie rule somehow lacks a valid string
                  key, that single rule is skipped rather than crashing the
                  request — every other rule still applies normally.
                </li>
                <li>
                  <strong>Query params:</strong> required by default. Add{" "}
                  <code>"required": false</code> explicitly on a param to make
                  it optional.
                </li>
                <li>
                  <strong>Request body:</strong> never checked for{" "}
                  <code>GET</code>, <code>HEAD</code>, or <code>DELETE</code>{" "}
                  requests, regardless of what you configure.
                </li>
                <li>
                  <strong>Unresolvable Faker placeholders:</strong> if{" "}
                  <code>{"{{faker.someUnknownPath}}"}</code> doesn't resolve
                  to a real Faker method, it is returned to you literally,
                  unresolved — the request does not fail.
                </li>
                <li>
                  <strong>Rate limiting is per-container, not global:</strong>{" "}
                  each project's mock instance tracks its own limits in
                  memory. Limits reset if the underlying container restarts.
                </li>
              </ul>
            </div>
          </section>

          {/* -------- SECTION 9: COOKIE POLICY -------- */}
          <section className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg font-bold tracking-tight">
                9. Cookie Policy & Data Privacy
              </h2>
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-teal-500/10 text-teal-500 uppercase tracking-wider">
                TL;DR: Essential cookies only, no third-party tracking
              </span>
            </div>
            <p className="text-sm opacity-85 leading-relaxed">
              The Service uses cookies solely to enable core functionality and
              improve user experience. We do not sell, share, or use cookies
              for cross-site advertising. Our use of cookies is limited to:
            </p>
            <ul className="list-disc pl-5 text-sm space-y-2 opacity-85">
              <li>
                <strong>Session Management:</strong> Cookies are used to
                maintain your authenticated session (e.g.,{" "}
                <code>sessionToken</code>) and to simulate API authentication
                flows during testing.
              </li>
              <li>
                <strong>User Preferences:</strong> Cookies store your UI
                preferences (e.g., <code>userPref</code> for dark/light mode)
                to improve your experience.
              </li>
              <li>
                <strong>Security & Integrity:</strong>{" "}
                <code>HttpOnly</code> and <code>SameSite</code> attributes are
                automatically applied to protect against XSS and CSRF attacks.
              </li>
              <li>
                <strong>Dual-purpose mock cookies:</strong> within an API
                definition, the same <code>cookies</code> array you configure
                is used both to validate incoming request cookies{" "}
                <em>and</em> to set outbound response cookies on a successful
                match. Configure it once — it governs both directions.
              </li>
            </ul>
            <div
              className={`p-3 rounded border text-xs ${
                isWhiteTheme
                  ? "bg-amber-50 border-amber-200 text-gray-700"
                  : "bg-amber-950/20 border-amber-800/30 text-gray-300"
              }`}
            >
              <p className="font-bold">🔒 Your Privacy Rights:</p>
              <p className="mt-1">
                Since the Service is a <strong>local development tool</strong>,
                we do not transmit any cookie data to external servers. All
                cookies are scoped to your local machine or test domain. You
                have the right to clear all cookies at any time via your
                browser settings. For EU users, this complies with the
                "strictly necessary" exemption under GDPR/EPR.
              </p>
            </div>
          </section>

          {/* -------- SECTION 10: USAGE & DYNAMIC RESPONSES -------- */}
          <section className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg font-bold tracking-tight">
                10. Usage Guidelines & Dynamic Mocking
              </h2>
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-500 uppercase tracking-wider">
                TL;DR: Define APIs, toggle AI responses, get fake data
              </span>
            </div>
            <div className="space-y-3 text-sm opacity-85 leading-relaxed">
              <p>
                <strong>How to define an API:</strong> Provide a URL path
                (e.g., <code>/users/:id</code>), select an HTTP method, and
                define your request/response schemas. You can enforce
                authentication (Bearer/API Key), custom headers, and cookies
                directly through the UI.
              </p>
              <div
                className={`border-l-4 pl-4 py-2 text-xs font-mono tracking-tight ${
                  isWhiteTheme
                    ? "border-indigo-400 bg-indigo-50/50 text-gray-700"
                    : "border-indigo-600 bg-indigo-950/20 text-gray-300"
                }`}
              >
                <p>
                  <strong className="text-indigo-500">🤖 Dynamic Responses:</strong>{" "}
                  Enable <code>"airesponse": true</code> in your API definition.
                  Use Faker.js placeholders to generate realistic, ever-changing
                  data:
                </p>
                <ul className="list-disc ml-4 mt-2 space-y-1">
                  <li><code>{"{{faker.person.fullName}}"}</code> → "Dr. John Doe"</li>
                  <li><code>{"{{faker.internet.email}}"}</code> → "john@example.net"</li>
                  <li><code>{"{{faker.string.uuid}}"}</code> → "a7d3f8e2-..."</li>
                  <li><code>{"{{faker.date.recent}}"}</code> → "2026-06-20T15:32:00Z"</li>
                </ul>
                <p className="mt-2 text-green-400">
                  ✅ The server recursively scans every nested field in your
                  response body – arrays, objects, and strings – to replace
                  placeholders on every request. When{" "}
                  <code>airesponse</code> is <code>false</code>, no
                  substitution happens and placeholder text is returned as-is.
                </p>
              </div>
              <p>
                <strong>Authentication Flow:</strong> Your API definitions
                strictly follow the priority and processing order described in{" "}
                <strong>Sections 7 and 8</strong>. You can mix Bearer tokens
                with custom headers and cookies to simulate complex real-world
                authorization (e.g., JWT + CSRF token).
              </p>
              <p className="text-xs opacity-70">
                💡 <strong>Pro Tip:</strong> Combine dynamic responses with
                rate limiting (<code>rateLimit</code>) and latency
                (<code>latency</code>) to mimic production API behavior
                perfectly.
              </p>
            </div>
          </section>

          {/* -------- SECTION 11: MODIFICATIONS & INQUIRIES -------- */}
          <section className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg font-bold tracking-tight">
                11. Modifications & Inquiries
              </h2>
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-blue-500/10 text-blue-500 uppercase tracking-wider">
                TL;DR: Check here for updates
              </span>
            </div>
            <p className="text-sm opacity-85 leading-relaxed">
              These terms are fluid and subject to revisions. Continued platform
              operations following any adjustments reflect binding acceptance.
              For legal dynamic verification or compliance inquiries, contact us
              directly at:
              <br 
                href="mailto:adityaboxi2005@gmail.com"
                className="text-blue-500 hover:underline hover:text-blue-400 font-medium"
              />
                adityaboxi2005@gmail.com
              <a>
              <br
              
                href="mailto:krishnaboxi1983@gmail.com"
                className="text-blue-500 hover:underline hover:text-blue-400 font-medium"
              />
                krishnaboxi1983@gmail.com
              </a>
            </p>
          </section>
        </div>
      </div>
    </div>
  );
};

export default TermsCondition;