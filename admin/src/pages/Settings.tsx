import { useEffect, useState } from "react";
import { Bell, Building2, Plus, Save, Shield, Trash2, User } from "lucide-react";
import { Card, CardHeader } from "../components/ui/Card";
import Toast, { type ToastState } from "../components/ui/Toast";
import { useAuth } from "../context/AuthContext";
import { apiRequest, ApiError } from "../lib/apiClient";

const TABS = [
  { id: "profile", label: "Profile", icon: User },
  { id: "company", label: "Company", icon: Building2 },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "security", label: "Security", icon: Shield },
] as const;
type TabId = (typeof TABS)[number]["id"];

type CompanySettings = {
  company_name: string; address: string; mobile_numbers: string[]; whatsapp_numbers: string[];
  website: string; email: string | null; gstin: string;
};
const emptyCompany: CompanySettings = { company_name: "Farm Craft", address: "", mobile_numbers: [""], whatsapp_numbers: [""], website: "", email: "", gstin: "" };

const cleanNumbers = (values: string[]) => values.map(v => v.trim()).filter(Boolean);
function NumberFields({ values, onChange }: { values: string[]; onChange: (v: string[]) => void }) {
  const update = (i: number, value: string) => onChange(values.map((v, n) => n === i ? value : v));
  return <div className="space-y-2">
    {values.map((value, i) => <div key={i} className="flex gap-2">
      <input value={value} onChange={e => update(i, e.target.value)} placeholder="+91 XXXXX XXXXX" className="min-w-0 flex-1 rounded-xl border border-black/10 bg-white px-3.5 py-2.5 text-sm focus:border-farm-green-600 focus:outline-none focus:ring-2 focus:ring-farm-green-100" />
      {values.length > 1 && <button type="button" onClick={() => onChange(values.filter((_, n) => n !== i))} className="rounded-xl border border-red-200 px-3 text-red-600 hover:bg-red-50" aria-label="Remove number"><Trash2 size={15}/></button>}
    </div>)}
    <button type="button" onClick={() => onChange([...values, ""])} className="inline-flex items-center gap-1.5 text-sm font-medium text-farm-green-700 hover:text-farm-green-800"><Plus size={15}/> Add new number</button>
  </div>;
}

export default function Settings() {
  const { admin, updateProfile } = useAuth();
  const [tab, setTab] = useState<TabId>("profile");
  const [saved, setSaved] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [company, setCompany] = useState<CompanySettings>(emptyCompany);
  const [profileMobile, setProfileMobile] = useState("");
  const [profileAddress, setProfileAddress] = useState("");
  const [profileName, setProfileName] = useState(admin?.name ?? "");
  const [profileEmail, setProfileEmail] = useState(admin?.email ?? "");

  useEffect(() => {
    setProfileName(admin?.name ?? "");
    setProfileEmail(admin?.email ?? "");
  }, [admin]);

  useEffect(() => {
    let active = true;
    apiRequest<CompanySettings>("/api/company", { auth: false }).then(data => {
      if (!active) return;
      setCompany({ ...emptyCompany, ...data, mobile_numbers: data.mobile_numbers?.length ? data.mobile_numbers : [""], whatsapp_numbers: data.whatsapp_numbers?.length ? data.whatsapp_numbers : [""] });
      setProfileMobile(data.mobile_numbers?.[0] || "");
      setProfileAddress(data.address || "");
    }).catch(() => setToast({ message: "Could not load company settings", variant: "error" })).finally(() => active && setLoading(false));
    return () => { active = false; };
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      // Admin Profile tab: name/email live on the admin's own user record,
      // not on company settings — save them through the real profile
      // endpoint (Admin Profile UI -> PATCH /api/auth/me -> users collection
      // -> updated response -> updated UI/session), then continue on to
      // persist the mobile/address fields that do belong to company settings.
      if (tab === "profile") {
        const nameChanged = profileName.trim() && profileName.trim() !== admin?.name;
        const emailChanged = profileEmail.trim() && profileEmail.trim() !== admin?.email;
        if (nameChanged || emailChanged) {
          await updateProfile({
            ...(nameChanged ? { name: profileName.trim() } : {}),
            ...(emailChanged ? { email: profileEmail.trim() } : {}),
          });
        }
      }

      const payload = { ...company, address: company.address || profileAddress, mobile_numbers: cleanNumbers(company.mobile_numbers.length ? company.mobile_numbers : [profileMobile]), whatsapp_numbers: cleanNumbers(company.whatsapp_numbers) };
      const data = await apiRequest<CompanySettings>("/api/company", { method: "PUT", body: { ...payload, email: payload.email?.trim() || null } });
      setCompany({ ...data, mobile_numbers: data.mobile_numbers.length ? data.mobile_numbers : [""], whatsapp_numbers: data.whatsapp_numbers.length ? data.whatsapp_numbers : [""] });
      setProfileMobile(data.mobile_numbers?.[0] || ""); setProfileAddress(data.address || "");
      setSaved(true); setToast({ message: "Settings saved successfully", variant: "success" }); setTimeout(() => setSaved(false), 1600);
    } catch (e) { setToast({ message: e instanceof ApiError ? e.message : e instanceof Error ? e.message : "Could not save settings", variant: "error" }); }
    finally { setSaving(false); }
  };

  return <div className="grid grid-cols-1 gap-5 animate-fade-in lg:grid-cols-4">
    <Card className="h-fit p-2 lg:col-span-1">{TABS.map(({ id, label, icon: Icon }) => <button key={id} onClick={() => setTab(id)} className={`flex w-full items-center gap-2.5 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-colors ${tab === id ? "bg-farm-green-50 text-farm-green-700" : "text-farm-charcoal/65 hover:bg-farm-mist"}`}><Icon size={16}/> {label}</button>)}</Card>
    <Card className="lg:col-span-3">
      {tab === "profile" && <><CardHeader title="Profile" subtitle="Admin profile and company contact details"/><div className="space-y-5 p-5">
        <div className="flex items-center gap-4"><div className="flex h-16 w-16 items-center justify-center rounded-full bg-farm-green-700 text-xl font-semibold text-white">{admin?.name?.charAt(0) ?? "A"}</div><div><p className="text-sm font-semibold text-farm-charcoal-deep">{admin?.name}</p><p className="text-xs text-farm-charcoal/50">{admin?.role}</p></div></div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2"><div><label className="mb-1.5 block text-sm font-medium">Full Name</label><input value={profileName} onChange={e => setProfileName(e.target.value)} className="w-full rounded-xl border border-black/10 bg-white px-3.5 py-2.5 text-sm"/></div><div><label className="mb-1.5 block text-sm font-medium">Email</label><input type="email" value={profileEmail} onChange={e => setProfileEmail(e.target.value)} className="w-full rounded-xl border border-black/10 bg-white px-3.5 py-2.5 text-sm"/></div></div>
        <div><label className="mb-1.5 block text-sm font-medium">Mobile Number</label><input value={profileMobile} onChange={e => {setProfileMobile(e.target.value); setCompany(c => ({...c,mobile_numbers:[e.target.value,...c.mobile_numbers.slice(1)]}));}} placeholder="+91 XXXXX XXXXX" className="w-full rounded-xl border border-black/10 bg-white px-3.5 py-2.5 text-sm"/></div>
        <div><label className="mb-1.5 block text-sm font-medium">Company Address</label><textarea value={profileAddress} onChange={e => {setProfileAddress(e.target.value); setCompany(c=>({...c,address:e.target.value}));}} rows={3} className="w-full rounded-xl border border-black/10 bg-white px-3.5 py-2.5 text-sm"/></div>
        <div><label className="mb-1.5 block text-sm font-medium">Additional Mobile Numbers</label><NumberFields values={company.mobile_numbers.slice(1)} onChange={v => setCompany(c=>({...c,mobile_numbers:[profileMobile,...v]}))}/></div>
      </div></>}
      {tab === "company" && <><CardHeader title="Company" subtitle="Company information shown on the customer website"/><div className="space-y-5 p-5">
        {loading ? <div className="text-sm text-farm-charcoal/50">Loading saved company details…</div> : <>
        <div><label className="mb-1.5 block text-sm font-medium">Company Name</label><input value={company.company_name} onChange={e=>setCompany(c=>({...c,company_name:e.target.value}))} className="w-full rounded-xl border border-black/10 bg-white px-3.5 py-2.5 text-sm"/></div>
        <div><label className="mb-1.5 block text-sm font-medium">Company Address</label><textarea value={company.address} onChange={e=>setCompany(c=>({...c,address:e.target.value}))} rows={3} className="w-full rounded-xl border border-black/10 bg-white px-3.5 py-2.5 text-sm"/></div>
        <div><label className="mb-1.5 block text-sm font-medium">Company Phone Numbers</label><NumberFields values={company.mobile_numbers} onChange={v=>setCompany(c=>({...c,mobile_numbers:v}))}/></div>
        <div><label className="mb-1.5 block text-sm font-medium">WhatsApp Numbers</label><NumberFields values={company.whatsapp_numbers} onChange={v=>setCompany(c=>({...c,whatsapp_numbers:v}))}/></div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2"><div><label className="mb-1.5 block text-sm font-medium">Website</label><input value={company.website} onChange={e=>setCompany(c=>({...c,website:e.target.value}))} placeholder="https://example.com" className="w-full rounded-xl border border-black/10 bg-white px-3.5 py-2.5 text-sm"/></div><div><label className="mb-1.5 block text-sm font-medium">Company Email</label><input type="email" value={company.email || ""} onChange={e=>setCompany(c=>({...c,email:e.target.value}))} placeholder="company@example.com" className="w-full rounded-xl border border-black/10 bg-white px-3.5 py-2.5 text-sm"/></div></div>
        <div><label className="mb-1.5 block text-sm font-medium">GSTIN</label><input value={company.gstin} onChange={e=>setCompany(c=>({...c,gstin:e.target.value}))} className="w-full rounded-xl border border-black/10 bg-white px-3.5 py-2.5 text-sm"/></div>
        </>}
      </div></>}
      {tab === "notifications" && <><CardHeader title="Notifications" subtitle="Choose what you'd like to be alerted about"/><div className="space-y-1 p-5">{["Purchase notifications","Stock alerts","Offer notifications"].map(item=><label key={item} className="flex items-center justify-between rounded-xl px-3 py-3 hover:bg-farm-mist/40"><span className="text-sm">{item}</span><input type="checkbox" defaultChecked className="h-4 w-4 accent-farm-green-700"/></label>)}</div></>}
      {tab === "security" && <><CardHeader title="Security" subtitle="Manage password and access"/><div className="space-y-4 p-5"><p className="text-sm text-farm-charcoal/60">Authentication remains unchanged. Existing admin login continues to use the current backend authentication.</p></div></>}
      <div className="flex justify-end border-t border-black/5 p-5"><button onClick={handleSave} disabled={saving || loading} className="flex items-center gap-2 rounded-xl bg-farm-green-700 px-5 py-2.5 text-sm font-semibold text-white shadow-card disabled:opacity-50"><Save size={16}/> {saving ? "Saving…" : saved ? "Saved!" : "Save Changes"}</button></div>
    </Card>
    {toast && <Toast {...toast} onClose={()=>setToast(null)}/>}</div>;
}
