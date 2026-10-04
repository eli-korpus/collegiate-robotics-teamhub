import { Printer } from 'lucide-react';
import { Button, QRCode } from '@teamhub/ui';
import { runtime } from '@teamhub/sdk';
import { ProgramLogo } from './AuthLayout';

/** Printable one-page "How to join" with a QR code to the signup page (spec §5.2 step 15). */
export default function PublicHelp() {
  const c = runtime().config;
  const url = `${location.origin}${import.meta.env.BASE_URL}join`;
  return (
    <div className="mx-auto max-w-2xl bg-white p-10 text-black print:p-0">
      <div className="flex items-center gap-4">
        <ProgramLogo size={64} />
        <div>
          <h1 className="text-[28px] font-bold">Join {c.program.name} on TeamHub</h1>
          <p className="text-[15px] text-gray-600">Our team dashboard: calendar, tasks, attendance and more.</p>
        </div>
      </div>
      <div className="mt-10 flex flex-col items-center gap-8 sm:flex-row sm:items-start">
        <QRCode value={url} size={220} />
        <ol className="list-decimal space-y-3 pl-5 text-[16px]">
          <li>
            Scan the code or go to <strong className="break-all">{url}</strong>
          </li>
          <li>Enter your name, email and a password, and pick your team.</li>
          <li>Tell a captain or mentor you signed up. They'll approve you.</li>
          <li>Sign in and you're in!</li>
        </ol>
      </div>
      <p className="mt-10 text-[13px] text-gray-500">Forgot your password? Ask a mentor or admin for a reset link.</p>
      <Button className="no-print mt-8" icon={<Printer className="size-4" />} onClick={() => window.print()}>
        Print this page
      </Button>
    </div>
  );
}
