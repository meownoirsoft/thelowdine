export const dynamic = "force-static";
import Privacy from '@/components/Privacy';

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-slate-900 text-amber-50 py-6 px-4">
      <div className="container mx-auto max-w-2xl">
        <Privacy />
      </div>
    </main>
  );
}
