// One folding settings section. The + and − are real text, not a pseudo element, so every
// browser shows them the same way.
export default function Section({ title, children, save }: { title: string; children: React.ReactNode; save?: React.ReactNode }) {
  return (
    <details className="settings-group">
      <summary>
        <span className="settings-dot" aria-hidden="true" />
        <span className="settings-title">{title}</span>
        <span className="settings-sign settings-plus" aria-hidden="true">
          +
        </span>
        <span className="settings-sign settings-minus" aria-hidden="true">
          −
        </span>
      </summary>
      <div className="settings-body">
        {children}
        {save}
      </div>
    </details>
  );
}
