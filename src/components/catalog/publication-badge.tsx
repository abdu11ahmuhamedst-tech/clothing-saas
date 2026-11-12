export function PublicationBadge({ published }: { published: boolean }) {
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${published ? "bg-green-50 text-green-800" : "bg-stone-100 text-stone-600"}`}>
    {published ? "Published" : "Draft"}
  </span>;
}
