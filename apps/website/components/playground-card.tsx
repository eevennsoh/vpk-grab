import { Ellipsis } from "lucide-react";
import { PLAYGROUND_PROGRESS_PERCENT } from "@/lib/constants";
import styles from "./playground-card.module.css";

interface PlaygroundMenuItem {
  label: string;
  isDestructive?: boolean;
}

const PLAYGROUND_MENU_ITEMS: PlaygroundMenuItem[] = [
  { label: "Edit" },
  { label: "Duplicate" },
  { label: "Move to…" },
  { label: "Delete", isDestructive: true },
];

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
      <div className={styles.moreActions}>
        <button
          type="button"
          className={styles.moreButton}
          aria-label="More actions"
          aria-haspopup="menu"
        >
          <Ellipsis size={16} aria-hidden="true" />
        </button>
        <div className={styles.menu} role="menu" aria-label="Task actions">
          {PLAYGROUND_MENU_ITEMS.map((menuItem) => (
            <button
              key={menuItem.label}
              type="button"
              role="menuitem"
              className={menuItem.isDestructive ? styles.dangerMenuItem : styles.menuItem}
            >
              {menuItem.label}
            </button>
          ))}
        </div>
      </div>
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
