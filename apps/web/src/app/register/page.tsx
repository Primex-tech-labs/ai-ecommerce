import { AuthForm } from "@/components/AuthForm";

export default function RegisterPage() {
  return (
    <main className="mx-auto w-full max-w-md space-y-6 py-10">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Create account</h1>
        <p className="text-slate-600">Track your orders and escrow activity.</p>
      </div>
      <AuthForm mode="register" />
    </main>
  );
}
