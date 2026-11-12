import { requireAdminSession } from "@/lib/auth";
import { AdminUnauthorizedDialog } from "@/components/AdminUnauthorizedDialog";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireAdminSession();

  if (!admin) {
    return <AdminUnauthorizedDialog />;
  }

  return <>{children}</>;
}
