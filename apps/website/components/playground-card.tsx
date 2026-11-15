import { PLAYGROUND_PROGRESS_PERCENT } from "@/lib/constants";
import styles from "./playground-card.module.css";

export const PlaygroundCard = () => (
  <article className={styles.root}>
    <header className={styles.header}>
      <div className={styles.avatar} aria-hidden="true">
        MK
      </div>
      <div className={styles.titleGroup}>
        <h2 className={styles.title}>Redesign onboarding</h2>
        <span className={styles.meta}>Maya Kim · Due Friday</span>
      </div>
      <span className={styles.lozenge}>In progress</span>
    </header>
    <p className={styles.body}>
      Simplify the first-run flow to three steps and move workspace setup after the first project.
    </p>
    <div className={styles.progress}>
      <div className={styles.progressLabel}>
        <span>Progress</span>
        <span>{PLAYGROUND_PROGRESS_PERCENT}%</span>
      </div>
      <div className={styles.track}>
        <div className={styles.fill} style={{ width: `${PLAYGROUND_PROGRESS_PERCENT}%` }} />
      </div>
    </div>
    <footer className={styles.actions}>
      <button type="button" className={styles.secondaryButton}>
        Comment
      </button>
      <button type="button" className={styles.primaryButton}>
        Mark done
      </button>
    </footer>
  </article>
);

PlaygroundCard.displayName = "PlaygroundCard";
