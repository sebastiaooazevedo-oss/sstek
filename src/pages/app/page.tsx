import AdminDashboard from "@/pages/app/components/AdminDashboard";
import ColaboradorDashboard from "@/pages/app/components/ColaboradorDashboard";
import SuperDashboard from "@/pages/app/components/SuperDashboard";
import { roleDescriptions, roleLabels } from "@/mocks/app";
import { useAppSession } from "@/pages/app/context";

export default function AppDashboard() {
  const session = useAppSession();
  const firstName = session.name.split(" ")[0];

  const today = new Date().toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
  });

  return (
    <div className="mx-auto max-w-[1400px]">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-foreground-400">
            <i className="ri-calendar-line"></i>
            {today}
          </p>
          <h1 className="mt-2 font-heading text-2xl font-extrabold tracking-tight text-foreground-950 md:text-3xl">
            Olá, {firstName}!
          </h1>
          <p className="mt-1.5 text-sm text-foreground-600">{roleDescriptions[session.role]}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary-100 px-3.5 py-2 text-xs font-semibold text-secondary-900">
            <i className="ri-shield-user-line"></i>
            {roleLabels[session.role]}
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-background-200 px-3.5 py-2 text-xs font-semibold text-foreground-700">
            <i className="ri-global-line"></i>
            {session.subdomain}.sstek.com
          </span>
        </div>
      </div>

      <div className="mt-7">
        {session.role === "super" && <SuperDashboard />}
        {session.role === "admin" && <AdminDashboard />}
        {session.role === "colaborador" && <ColaboradorDashboard />}
      </div>
    </div>
  );
}