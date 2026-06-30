import clsx from 'clsx';
import Link from '@docusaurus/Link';
import Layout from '@theme/Layout';
import Heading from '@theme/Heading';
import GitHubRepoBadge from '@site/src/components/GitHubRepoBadge';
import {IDE_AGENTS_GITHUB_URL} from '@site/src/lib/githubRepo';
import styles from './index.module.css';

const NPM_INSTALL = 'npm i -g ide-agents';
const NPM_HREF = 'https://www.npmjs.com/package/ide-agents';

const features = [
  {
    id: 'repositories',
    title: 'Clone and catalog in seconds',
    body: 'Paste a git URL or pick a starter catalog. ide-agents clones into ~/.ide-agents/repos and scans skills/*/SKILL.md and agents/*.md automatically.',
    image: '/img/ui/repositories.png',
    imageAlt: 'ide-agents Repositories screen with suggested catalogs and installed repos',
  },
  {
    id: 'skills',
    title: 'Install skills with symlinks',
    body: 'Toggle Global or Project per skill — no copy-paste into tool-specific skills folders. Updates flow from git pull + Apply; non-symlink targets are never overwritten.',
    image: '/img/ui/skills.png',
    imageAlt: 'Skills page with global and project install toggles',
    reverse: true,
  },
  {
    id: 'agents',
    title: 'Same flow for subagents',
    body: 'Agents from git install to each enabled tool\'s agents folder, globally or per project. Dependent skills can be enforced so orchestrators always ship with their scripts.',
    image: '/img/ui/agents.png',
    imageAlt: 'Agents page listing subagents from connected repositories',
  },
  {
    id: 'settings',
    title: 'OpenCode, Cursor, Claude Code, and Codex',
    body: 'Enable only the tools you use, set config paths, and apply installs to every enabled IDE adapter in one click.',
    image: '/img/ui/settings.png',
    imageAlt: 'Settings page with IDE toggles and config paths',
    reverse: true,
  },
];

const steps = [
  {n: '1', title: 'Install & run', code: 'npm i -g ide-agents\nide-agents'},
  {n: '2', title: 'Add a repo', text: 'Open Repositories → clone your skills catalog (or use the built-in template).'},
  {n: '3', title: 'Toggle & apply', text: 'Enable Global / Project on Skills and Agents — symlinks update immediately.'},
] as const;

function CopyInstall() {
  return (
    <div className={styles.installBlock}>
      <code className={styles.installCode}>{NPM_INSTALL}</code>
      <span className={styles.installThen}>then</span>
      <code className={styles.installCode}>ide-agents</code>
    </div>
  );
}

function Screenshot({src, alt}: {src: string; alt: string}) {
  return (
    <div className={styles.shotFrame}>
      <img src={src} alt={alt} className={styles.shotImg} loading="lazy" />
    </div>
  );
}

export default function Home() {
  return (
    <Layout
      title="ide-agents — IDE skills from git"
      description="Local admin for OpenCode, Cursor, Claude Code, and Codex: clone skill repos, symlink installs, one UI.">
      <header className={styles.hero}>
        <div className="container">
          <p className={styles.eyebrow}>Local-first · macOS & Linux · MIT</p>
          <Heading as="h1" className={styles.heroTitle}>
            Stop copy-pasting skills into{' '}
            <span className={styles.heroAccent}>~/.cursor</span>
          </Heading>
          <p className={styles.heroLead}>
            <strong>ide-agents</strong> is a small CLI + browser UI that clones git
            catalogs, scans SKILL.md and agents, and installs via{' '}
            <strong>symlinks</strong> into OpenCode, Cursor, Claude Code, and Codex —
            global or per project.
          </p>
          <div className={styles.heroCtas}>
            <a
              className="button button--primary button--lg"
              href={NPM_HREF}
              target="_blank"
              rel="noopener noreferrer">
              Install from npm
            </a>
            <Link className="button button--secondary button--lg" to="/docs/intro">
              Read the docs
            </Link>
            <GitHubRepoBadge className={styles.heroBadge} />
          </div>
          <CopyInstall />
          <p className={styles.disclaimer}>
            Not affiliated with Cursor. Requires Node.js 20+ and git.
          </p>
        </div>
        <div className={clsx('container', styles.heroShotWrap)}>
          <Screenshot
            src="/img/ui/repositories.png"
            alt="ide-agents Repositories — add and manage git skill catalogs"
          />
        </div>
      </header>

      <main>
        <section className={styles.strip}>
          <div className="container">
            <ul className={styles.stripList}>
              <li>
                <strong>One source of truth</strong> — skills live in git, not in chat
                exports
              </li>
              <li>
                <strong>Safe apply</strong> — won&apos;t replace real files that aren&apos;t
                symlinks
              </li>
              <li>
                <strong>Private catalogs OK</strong> — any git URL you can clone
              </li>
            </ul>
          </div>
        </section>

        {features.map((f) => (
          <section
            key={f.id}
            className={clsx(
              styles.feature,
              'reverse' in f && f.reverse && styles.featureReverse,
            )}>
            <div className="container">
              <div className={styles.featureGrid}>
                <div className={styles.featureCopy}>
                  <Heading as="h2" className={styles.featureTitle}>
                    {f.title}
                  </Heading>
                  <p className={styles.featureBody}>{f.body}</p>
                </div>
                <Screenshot src={f.image} alt={f.imageAlt} />
              </div>
            </div>
          </section>
        ))}

        <section className={styles.steps}>
          <div className="container">
            <Heading as="h2" className={styles.sectionTitle}>
              Up and running in three steps
            </Heading>
            <ol className={styles.stepList}>
              {steps.map((s) => (
                <li key={s.n} className={styles.stepCard}>
                  <span className={styles.stepNum}>{s.n}</span>
                  <div>
                    <strong>{s.title}</strong>
                    {'code' in s ? (
                      <pre className={styles.stepPre}>
                        <code>{s.code}</code>
                      </pre>
                    ) : (
                      <p>{s.text}</p>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className={styles.cta}>
          <div className="container">
            <Heading as="h2">Ready to wire your team&apos;s skills?</Heading>
            <p>
              Publish a repo with <code>skills/</code> and <code>agents/</code>, point
              ide-agents at it, and share one install flow.
            </p>
            <div className={styles.ctaButtons}>
              <a
                className="button button--primary button--lg"
                href={NPM_HREF}
                target="_blank"
                rel="noopener noreferrer">
                npm install ide-agents
              </a>
              <a
                className="button button--outline button--lg"
                href={IDE_AGENTS_GITHUB_URL}
                target="_blank"
                rel="noopener noreferrer">
                View on GitHub
              </a>
            </div>
          </div>
        </section>
      </main>
    </Layout>
  );
}
