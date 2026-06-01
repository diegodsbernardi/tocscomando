import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Shell } from "@/components/ui/Shell";
import { TopBar } from "@/components/ui/TopBar";
import { EmployeeAddForm } from "@/components/cadastros/EmployeeAddForm";
import { EmployeeRow } from "@/components/cadastros/EmployeeRow";
import { MotoboyForm } from "@/components/MotoboyForm";
import { MotoboyListItem } from "@/components/MotoboyListItem";
import { AreaForm } from "@/components/AreaForm";
import { AreaListItem } from "@/components/AreaListItem";
import { UserProfileRow, type Drawer as TeamDrawer } from "@/components/cadastros/UserProfileRow";
import { getCurrentProfile, roleLabel } from "@/lib/profile";

export const dynamic = "force-dynamic";

type Tab = "func" | "moto" | "bairro" | "equipe";

type TeamMember = {
  user_id: string;
  email: string;
  display_name: string | null;
  role: "admin" | "operator";
  default_drawer_id: string | null;
  default_drawer_name: string | null;
  created_at: string;
};

type Employee = {
  id: string;
  name: string;
  phone: string | null;
  centro_custo: "atendimento" | "cozinha";
  active: boolean;
};
type Motoboy = { id: string; name: string; phone: string | null; active: boolean };
type Area = { id: string; name: string; fee: number; active: boolean };

export default async function CadastrosPage({
  searchParams,
}: {
  searchParams: { tab?: Tab };
}) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const profile = await getCurrentProfile();
  const isAdmin = profile?.role === "admin";

  const requested = searchParams.tab;
  const tab: Tab =
    requested === "moto" || requested === "bairro"
      ? requested
      : requested === "equipe" && isAdmin
        ? "equipe"
        : "func";

  // Carrega membros da equipe (RPC team_members) apenas se admin
  let teamMembers: TeamMember[] = [];
  let drawersForTeam: TeamDrawer[] = [];
  if (isAdmin) {
    const [{ data: tm }, { data: dr }] = await Promise.all([
      supabase.rpc("team_members"),
      supabase.from("cash_drawers").select("id, name").eq("active", true).order("name"),
    ]);
    teamMembers = (tm || []) as TeamMember[];
    drawersForTeam = (dr || []) as TeamDrawer[];
  }

  const [{ data: emps }, { data: motos }, { data: areas }] = await Promise.all([
    supabase
      .from("employees")
      .select("id, name, phone, centro_custo, active")
      .order("active", { ascending: false })
      .order("name"),
    supabase
      .from("motoboys")
      .select("id, name, phone, active")
      .order("active", { ascending: false })
      .order("name"),
    supabase
      .from("delivery_areas")
      .select("id, name, fee, active")
      .order("active", { ascending: false })
      .order("fee")
      .order("name"),
  ]);

  const empList = (emps || []) as Employee[];
  const motoList = (motos || []) as Motoboy[];
  const areaList = (areas || []) as Area[];

  return (
    <Shell>
      <TopBar
        title="Cadastros"
        subtitle="a base que alimenta o app"
        role={roleLabel(profile)}
      />

      <div className="px-4">
        <div className="flex gap-2 reveal d2 overflow-x-auto">
          <TabLink href="?tab=func" label="Funcionários" active={tab === "func"} />
          <TabLink href="?tab=moto" label="Motoboys" active={tab === "moto"} />
          <TabLink href="?tab=bairro" label="Bairros" active={tab === "bairro"} />
          {isAdmin && <TabLink href="?tab=equipe" label="Equipe" active={tab === "equipe"} />}
        </div>

        <div className="mt-4 reveal d3">
          {tab === "func" && <FuncionariosPane list={empList} />}
          {tab === "moto" && <MotoboysPane list={motoList} />}
          {tab === "bairro" && <BairrosPane list={areaList} />}
          {tab === "equipe" && isAdmin && (
            <EquipePane members={teamMembers} drawers={drawersForTeam} currentUserId={profile!.user_id} />
          )}
        </div>
      </div>
    </Shell>
  );
}

function EquipePane({
  members,
  drawers,
  currentUserId,
}: {
  members: TeamMember[];
  drawers: TeamDrawer[];
  currentUserId: string;
}) {
  return (
    <div className="space-y-3">
      <p className="px-1 text-[13px] leading-snug text-muted">
        Quem usa o app. <b className="text-navy">Admin</b> vê tudo. <b className="text-navy">Operador</b> com caixa
        atribuído só vê o caixa dele.
      </p>
      {members.length === 0 ? (
        <p className="rounded-card bg-white p-6 text-center text-sm text-muted shadow-card">
          Ninguém cadastrado ainda. Quando alguém logar pela primeira vez, aparece aqui.
        </p>
      ) : (
        members.map((m) => (
          <UserProfileRow
            key={m.user_id}
            userId={m.user_id}
            email={m.email}
            initialName={m.display_name}
            initialRole={m.role}
            initialDrawerId={m.default_drawer_id}
            isSelf={m.user_id === currentUserId}
            drawers={drawers}
          />
        ))
      )}
    </div>
  );
}

function TabLink({ href, label, active }: { href: string; label: string; active: boolean }) {
  return (
    <Link
      href={href}
      className={`flex-1 rounded-xl border-[1.5px] py-2.5 text-center text-[13px] font-bold transition ${
        active
          ? "border-navy bg-navy text-white"
          : "border-line bg-white text-muted"
      }`}
    >
      {label}
    </Link>
  );
}

function FuncionariosPane({ list }: { list: Employee[] }) {
  const active = list.filter((e) => e.active);
  const inactive = list.filter((e) => !e.active);

  return (
    <div className="space-y-4">
      <EmployeeAddForm />
      <div>
        <h3 className="mb-2 px-1 text-[11px] font-bold uppercase tracking-wider text-muted">
          Ativos ({active.length})
        </h3>
        <div className="space-y-2">
          {active.map((e) => (
            <EmployeeRow
              key={e.id}
              id={e.id}
              initialName={e.name}
              initialPhone={e.phone}
              centro={e.centro_custo}
              active={e.active}
            />
          ))}
        </div>
      </div>
      {inactive.length > 0 && (
        <div>
          <h3 className="mb-2 px-1 text-[11px] font-bold uppercase tracking-wider text-muted">
            Inativos ({inactive.length})
          </h3>
          <div className="space-y-2">
            {inactive.map((e) => (
              <EmployeeRow
                key={e.id}
                id={e.id}
                initialName={e.name}
                initialPhone={e.phone}
                centro={e.centro_custo}
                active={e.active}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function MotoboysPane({ list }: { list: Motoboy[] }) {
  const active = list.filter((m) => m.active);
  const inactive = list.filter((m) => !m.active);

  return (
    <div className="space-y-4">
      <MotoboyForm />
      <div>
        <h3 className="mb-2 px-1 text-[11px] font-bold uppercase tracking-wider text-muted">
          Ativos ({active.length})
        </h3>
        <div className="space-y-2">
          {active.map((m) => (
            <MotoboyListItem
              key={m.id}
              id={m.id}
              initialName={m.name}
              initialPhone={m.phone}
              active={m.active}
            />
          ))}
        </div>
      </div>
      {inactive.length > 0 && (
        <div>
          <h3 className="mb-2 px-1 text-[11px] font-bold uppercase tracking-wider text-muted">
            Inativos ({inactive.length})
          </h3>
          <div className="space-y-2">
            {inactive.map((m) => (
              <MotoboyListItem
                key={m.id}
                id={m.id}
                initialName={m.name}
                initialPhone={m.phone}
                active={m.active}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function BairrosPane({ list }: { list: Area[] }) {
  const active = list.filter((a) => a.active);
  const inactive = list.filter((a) => !a.active);

  return (
    <div className="space-y-4">
      <AreaForm />
      <div>
        <h3 className="mb-2 px-1 text-[11px] font-bold uppercase tracking-wider text-muted">
          Ativos ({active.length})
        </h3>
        <div className="space-y-2">
          {active.map((a) => (
            <AreaListItem
              key={a.id}
              id={a.id}
              name={a.name}
              initialFee={Number(a.fee)}
              active={a.active}
            />
          ))}
        </div>
      </div>
      {inactive.length > 0 && (
        <div>
          <h3 className="mb-2 px-1 text-[11px] font-bold uppercase tracking-wider text-muted">
            Inativos ({inactive.length})
          </h3>
          <div className="space-y-2">
            {inactive.map((a) => (
              <AreaListItem
                key={a.id}
                id={a.id}
                name={a.name}
                initialFee={Number(a.fee)}
                active={a.active}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
