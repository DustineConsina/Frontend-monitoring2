import Link from 'next/link'

export default function TenantAccessPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 to-blue-50 px-4 py-10">
      <section className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-lg sm:p-8">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-teal-700">PFDA tenant access</p>
        <h1 className="mt-2 text-2xl font-bold text-slate-900">View your complaint response</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          For your privacy, this email link does not open complaint details directly. Use your tenant QR code to securely access your requests.
        </p>
        <ol className="mt-5 list-decimal space-y-3 pl-5 text-sm leading-6 text-slate-700">
          <li>Scan your PFDA tenant QR code with your phone camera.</li>
          <li>Enter the 8-digit QR password provided by the PFDA administrator.</li>
          <li>Open “Your complaints and responses” to read the administration’s reply and current status.</li>
        </ol>
        <p className="mt-5 rounded-xl bg-amber-50 p-4 text-sm leading-5 text-amber-900">
          Keep your QR code and password private. Contact the PFDA administrator if you need help accessing them.
        </p>
        <Link href="/" className="mt-6 inline-flex min-h-11 items-center justify-center rounded-lg bg-teal-800 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-900">
          Return to PFDA
        </Link>
      </section>
    </main>
  )
}
