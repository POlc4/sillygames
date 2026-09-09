import Link from "next/link";

// Page servie par le service worker quand le réseau manque (voir public/sw.js).
export default function OfflinePage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Hors ligne</h1>
      <p className="text-muted">
        Le réseau ne répond pas. Les parties ont besoin du serveur : réessayez une fois la connexion
        revenue.
      </p>
      <Link href="/" className="underline">
        Retour à l&apos;accueil
      </Link>
    </div>
  );
}
