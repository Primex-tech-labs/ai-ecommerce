import { AuthForm } from "@/components/AuthForm";

export default function LoginPage() {
  return (
    <main className="mx-auto w-full max-w-md space-y-6 py-10">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Sign in</h1>
        <p className="text-slate-600">Access your orders and escrow history.</p>
      </div>
      <AuthForm mode="login" />
    </main>
  );
}
