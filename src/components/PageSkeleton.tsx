// Shown the moment a page is opened while its data loads: the page's shape in quiet
// paper tones, so the screen never sits blank. No spinner.
export default function PageSkeleton({ rows = 2 }: { rows?: number }) {
  return (
    <div className="page" aria-busy="true" aria-label="Loading">
      <header className="hero">
        <div className="masthead">
          <span className="word" aria-hidden="true">
            hoshigo
          </span>
        </div>
        <div className="skel skel-title" />
      </header>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="skel-row">
          <div className="skel skel-line" />
          <div className="skel-covers">
            {Array.from({ length: 4 }, (_, j) => (
              <div key={j} className="skel skel-cover" />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
