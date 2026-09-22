import type { SocialLink } from "@/lib/supabase/types";
import { platformLabel } from "@/lib/social-links";

export default function ProfileSocialLinks({ links }: { links: SocialLink[] }) {
  if (!links || links.length === 0) return null;

  return (
    <ul className="social-links" aria-label="Other accounts">
      {links.map((link, i) => (
        <li key={`${link.platform}-${i}`}>
          <span className="social-platform">{platformLabel(link.platform)}</span>
          <a href={link.url} target="_blank" rel="noopener noreferrer">
            @{link.handle}
          </a>
        </li>
      ))}
    </ul>
  );
}
