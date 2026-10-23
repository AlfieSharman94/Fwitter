// Thumbnails of a post's images, so moderators see what was reported.
export function Media({ media }: { media?: { url: string }[] }) {
  if (!media || media.length === 0) return null;
  return (
    <div className="media">
      {media.map((m) => (
        <a key={m.url} href={m.url} target="_blank" rel="noreferrer">
          <img src={m.url} alt="" loading="lazy" />
        </a>
      ))}
    </div>
  );
}
