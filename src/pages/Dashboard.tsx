import { useAuth } from "@/hooks/useAuth";
import AdminDashboard from "@/components/dashboard/AdminDashboard";
import BureauDashboard from "@/components/dashboard/bureau/BureauDashboard";

export default function Dashboard() {
  const { role } = useAuth();

  if (role === "bureau") return <BureauDashboard />;
  return <AdminDashboard />;
}
