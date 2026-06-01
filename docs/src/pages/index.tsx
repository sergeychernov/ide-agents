import clsx from 'clsx';
import Link from '@docusaurus/Link';
import Layout from '@theme/Layout';
import Heading from '@theme/Heading';
import GitHubRepoBadge from '@site/src/components/GitHubRepoBadge';
import titleRowStyles from '@site/src/components/repoTitleRow.module.css';
import styles from './index.module.css';

export default function Home() {
  return (
    <Layout
      title="ide-agents"
      description="Local admin for IDE agents and skills from git">
      <header className={clsx('hero hero--primary', styles.heroBanner)}>
        <div className="container">
          <div className={titleRowStyles.row}>
            <Heading as="h1" className="hero__title" style={{marginBottom: 0}}>
              ide-agents
            </Heading>
            <GitHubRepoBadge />
          </div>
          <p className="hero__subtitle">
            Manage Cursor skills and subagents from git — with symlinks, not copy-paste
          </p>
          <div className={styles.buttons}>
            <Link className="button button--secondary button--lg" to="/docs/intro">
              Get started
            </Link>
          </div>
        </div>
      </header>
    </Layout>
  );
}
