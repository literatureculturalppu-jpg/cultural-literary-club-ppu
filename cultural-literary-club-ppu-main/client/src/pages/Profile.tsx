import { useAuth } from "@/_core/hooks/useAuth";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { UserRound, Clock, XCircle, UsersRound, CalendarCheck } from "lucide-react";
import { Link } from "wouter";

const YEAR_LABELS: Record<string, string> = {
  first: "الأولى",
  second: "الثانية",
  third: "الثالثة",
  fourth: "الرابعة",
  postgraduate: "دراسات عليا",
};

const ROLE_LABELS: Record<string, string> = {
  admin: "مسؤول",
  general_agent: "وكيل عام",
  tech_admin: "المدير التقني",
  supervisor: "مشرف",
  committee_head: "مشرف فريق",
  user: "مستخدم عادي",
};

const SUBSCRIPTION_STATUS_LABELS: Record<string, { label: string; className: string }> = {
  pending: { label: "بانتظار الموافقة", className: "bg-amber-100 text-amber-800" },
  approved: { label: "مقبول", className: "bg-green-100 text-green-800" },
  rejected: { label: "مرفوض", className: "bg-red-100 text-red-800" },
};

type EditableFormState = {
  name: string;
  arabicFullName: string;
  email: string;
  dateOfBirth: string;
  phoneNumber: string;
  whatsapp: string;
  college: string;
  department: string;
  specialization: string;
  academicYear: string;
  universityId: string;
  culturalExperience: string;
};

export default function Profile() {
  const { user } = useAuth();
  const [isEditing, setIsEditing] = useState(false);

  const buildFormState = (): EditableFormState => ({
    name: user?.name || "",
    arabicFullName: user?.arabicFullName || "",
    email: user?.email || "",
    dateOfBirth: user?.dateOfBirth ? new Date(user.dateOfBirth).toISOString().split("T")[0] : "",
    phoneNumber: user?.phoneNumber || "",
    whatsapp: user?.whatsapp || "",
    college: user?.college || "",
    department: user?.department || "",
    specialization: user?.specialization || "",
    academicYear: user?.academicYear || "",
    universityId: user?.universityId || "",
    culturalExperience: user?.culturalExperience || "",
  });

  const [formData, setFormData] = useState<EditableFormState>(buildFormState());

  // Keep the form in sync whenever the underlying user data (re)loads.
  useEffect(() => {
    if (user) setFormData(buildFormState());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const utils = trpc.useUtils();

  const { data: myRequest, refetch: refetchMyRequest } = trpc.profileEditRequests.getMine.useQuery(undefined, {
    enabled: Boolean(user),
  });
  const { data: myTeams, isLoading: teamsLoading } = trpc.users.getMyTeams.useQuery(undefined, {
    enabled: Boolean(user),
  });
  const { data: mySubscriptions, isLoading: subscriptionsLoading } = trpc.users.getMyActivitySubscriptions.useQuery(
    undefined,
    { enabled: Boolean(user) }
  );

  const createRequest = trpc.profileEditRequests.create.useMutation({
    onSuccess: () => {
      toast.success("تم إرسال طلب التعديل، بانتظار موافقة المسؤول");
      setIsEditing(false);
      refetchMyRequest();
      utils.profileEditRequests.getMine.invalidate();
    },
    onError: (error) => {
      toast.error(error.message || "حدث خطأ أثناء إرسال الطلب");
    },
  });

  if (!user) {
    return (
      <div className="container mx-auto px-4 py-12 text-center" dir="rtl">
        <h1 className="text-3xl font-bold mb-4">يرجى تسجيل الدخول</h1>
        <p className="text-muted-foreground">تحتاج إلى تسجيل الدخول لعرض ملفك الشخصي</p>
      </div>
    );
  }

  const isPending = myRequest?.status === "pending";
  const isRejected = myRequest?.status === "rejected";

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleCancelEdit = () => {
    setFormData(buildFormState());
    setIsEditing(false);
  };

  const handleSave = async () => {
    const original = buildFormState();
    const changes: Record<string, string | null> = {};

    (Object.keys(formData) as (keyof EditableFormState)[]).forEach((key) => {
      const newValue = formData[key]?.trim() ?? "";
      const oldValue = original[key]?.trim() ?? "";
      if (newValue !== oldValue) {
        changes[key] = newValue === "" ? null : newValue;
      }
    });

    if (Object.keys(changes).length === 0) {
      toast.info("لم يتم إجراء أي تعديل");
      return;
    }

    createRequest.mutate({ changes });
  };

  return (
    <div className="container mx-auto px-4 py-12" dir="rtl">
      <div className="max-w-2xl mx-auto space-y-8">
        {/* Avatar + Header */}
        <div className="flex items-center gap-4">
          <div className="w-20 h-20 rounded-full bg-accent flex items-center justify-center flex-shrink-0">
            <UserRound className="w-10 h-10 text-accent-foreground" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-right">
              {user.arabicFullName || user.name || "الملف الشخصي"}
            </h1>
            <p className="text-muted-foreground text-right">
              {ROLE_LABELS[user.role] || "مستخدم عادي"}
            </p>
          </div>
        </div>

        {/* Pending / rejected banners for the edit request workflow */}
        {isPending && (
          <Alert className="border-amber-300 bg-amber-50 text-amber-900">
            <Clock className="w-4 h-4" />
            <AlertDescription className="text-right w-full">
              لديك طلب تعديل بيانات قيد المراجعة من قبل المسؤول. لن تُطبَّق التغييرات إلا بعد الموافقة عليها.
            </AlertDescription>
          </Alert>
        )}
        {isRejected && myRequest && !isPending && (
          <Alert variant="destructive">
            <XCircle className="w-4 h-4" />
            <AlertDescription className="text-right w-full space-y-1">
              <p>تم رفض آخر طلب تعديل لبياناتك.</p>
              {myRequest.rejectionReason && (
                <p className="font-semibold">سبب الرفض: {myRequest.rejectionReason}</p>
              )}
            </AlertDescription>
          </Alert>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="text-right">معلومات الحساب</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {user.referenceNumber && (
                <div className="text-right p-3 bg-accent/10 rounded-lg">
                  <Label className="text-muted-foreground">الرقم المرجعي</Label>
                  <p className="text-lg font-bold tracking-widest">{user.referenceNumber}</p>
                </div>
              )}

              {!isEditing ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="text-right">
                      <Label className="text-muted-foreground">الاسم الرباعي</Label>
                      <p className="text-lg font-semibold">{user.arabicFullName || user.name || "غير محدد"}</p>
                    </div>
                    <div className="text-right">
                      <Label className="text-muted-foreground">البريد الإلكتروني</Label>
                      <p className="text-lg font-semibold">{user.email || "غير محدد"}</p>
                    </div>
                    <div className="text-right">
                      <Label className="text-muted-foreground">رقم الهاتف</Label>
                      <p className="text-lg font-semibold">{user.phoneNumber || "غير محدد"}</p>
                    </div>
                    <div className="text-right">
                      <Label className="text-muted-foreground">رقم الواتساب</Label>
                      <p className="text-lg font-semibold">{user.whatsapp || "غير محدد"}</p>
                    </div>
                    <div className="text-right">
                      <Label className="text-muted-foreground">الكلية</Label>
                      <p className="text-lg font-semibold">{user.college || "غير محدد"}</p>
                    </div>
                    <div className="text-right">
                      <Label className="text-muted-foreground">الدائرة</Label>
                      <p className="text-lg font-semibold">{user.department || "غير محدد"}</p>
                    </div>
                    <div className="text-right">
                      <Label className="text-muted-foreground">التخصص</Label>
                      <p className="text-lg font-semibold">{user.specialization || "غير محدد"}</p>
                    </div>
                    <div className="text-right">
                      <Label className="text-muted-foreground">السنة الجامعية</Label>
                      <p className="text-lg font-semibold">
                        {user.academicYear ? YEAR_LABELS[user.academicYear] || user.academicYear : "غير محدد"}
                      </p>
                    </div>
                    <div className="text-right">
                      <Label className="text-muted-foreground">الرقم الجامعي</Label>
                      <p className="text-lg font-semibold">{user.universityId || "غير محدد"}</p>
                    </div>
                    <div className="text-right">
                      <Label className="text-muted-foreground">تاريخ الميلاد</Label>
                      <p className="text-lg font-semibold">
                        {user.dateOfBirth ? new Date(user.dateOfBirth).toLocaleDateString("ar-EG") : "غير محدد"}
                      </p>
                    </div>
                  </div>
                  {user.culturalExperience && (
                    <div className="text-right">
                      <Label className="text-muted-foreground">الخبرات الثقافية</Label>
                      <p className="text-base leading-relaxed">{user.culturalExperience}</p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="arabicFullName" className="text-right block mb-2">الاسم الرباعي</Label>
                      <Input id="arabicFullName" name="arabicFullName" value={formData.arabicFullName} onChange={handleChange} className="text-right" dir="rtl" />
                    </div>
                    <div>
                      <Label htmlFor="email" className="text-right block mb-2">البريد الإلكتروني</Label>
                      <Input id="email" name="email" type="email" value={formData.email} onChange={handleChange} className="text-right" dir="rtl" />
                    </div>
                    <div>
                      <Label htmlFor="phoneNumber" className="text-right block mb-2">رقم الهاتف</Label>
                      <Input id="phoneNumber" name="phoneNumber" value={formData.phoneNumber} onChange={handleChange} className="text-right" dir="rtl" />
                    </div>
                    <div>
                      <Label htmlFor="whatsapp" className="text-right block mb-2">رقم الواتساب</Label>
                      <Input id="whatsapp" name="whatsapp" value={formData.whatsapp} onChange={handleChange} className="text-right" dir="rtl" />
                    </div>
                    <div>
                      <Label htmlFor="college" className="text-right block mb-2">الكلية</Label>
                      <Input id="college" name="college" value={formData.college} onChange={handleChange} className="text-right" dir="rtl" />
                    </div>
                    <div>
                      <Label htmlFor="department" className="text-right block mb-2">الدائرة</Label>
                      <Input id="department" name="department" value={formData.department} onChange={handleChange} className="text-right" dir="rtl" />
                    </div>
                    <div>
                      <Label htmlFor="specialization" className="text-right block mb-2">التخصص</Label>
                      <Input id="specialization" name="specialization" value={formData.specialization} onChange={handleChange} className="text-right" dir="rtl" />
                    </div>
                    <div>
                      <Label htmlFor="academicYear" className="text-right block mb-2">السنة الجامعية</Label>
                      <Select
                        value={formData.academicYear || undefined}
                        onValueChange={(value) => setFormData((prev) => ({ ...prev, academicYear: value }))}
                      >
                        <SelectTrigger id="academicYear" className="text-right" dir="rtl">
                          <SelectValue placeholder="اختر السنة الجامعية" />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(YEAR_LABELS).map(([value, label]) => (
                            <SelectItem key={value} value={value}>{label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="universityId" className="text-right block mb-2">الرقم الجامعي</Label>
                      <Input id="universityId" name="universityId" value={formData.universityId} onChange={handleChange} className="text-right" dir="rtl" />
                    </div>
                    <div>
                      <Label htmlFor="dateOfBirth" className="text-right block mb-2">تاريخ الميلاد</Label>
                      <Input id="dateOfBirth" name="dateOfBirth" type="date" value={formData.dateOfBirth} onChange={handleChange} className="text-right" />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="culturalExperience" className="text-right block mb-2">الخبرات الثقافية</Label>
                    <Textarea
                      id="culturalExperience"
                      name="culturalExperience"
                      value={formData.culturalExperience}
                      onChange={handleChange}
                      className="text-right"
                      dir="rtl"
                      rows={4}
                    />
                  </div>
                  <p className="text-sm text-muted-foreground text-right">
                    ملاحظة: لن يتم تطبيق أي تعديل مباشرة، سيتم إرسال طلبك إلى المسؤول للموافقة عليه أولاً.
                  </p>
                </div>
              )}

              <div className="flex gap-4 justify-start">
                {!isEditing ? (
                  <Button
                    onClick={() => setIsEditing(true)}
                    disabled={isPending}
                    className="bg-primary hover:bg-primary/90"
                  >
                    {isPending ? "طلب التعديل قيد المراجعة" : "تعديل البيانات"}
                  </Button>
                ) : (
                  <>
                    <Button
                      onClick={handleSave}
                      disabled={createRequest.isPending}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      {createRequest.isPending ? "جاري الإرسال..." : "إرسال طلب التعديل"}
                    </Button>
                    <Button onClick={handleCancelEdit} variant="outline" disabled={createRequest.isPending}>
                      إلغاء
                    </Button>
                  </>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Teams */}
        <Card>
          <CardHeader>
            <CardTitle className="text-right flex items-center gap-2 justify-end">
              الفرق التي أنتمي إليها
              <UsersRound className="w-5 h-5 text-accent" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            {teamsLoading ? (
              <p className="text-muted-foreground text-right">جاري التحميل...</p>
            ) : myTeams && myTeams.length > 0 ? (
              <div className="grid gap-3">
                {myTeams.map((team) => (
                  <Link key={team.id} href={`/teams/${team.id}`}>
                    <div className="p-4 rounded-lg border border-border hover:border-accent transition-colors cursor-pointer text-right">
                      <p className="font-semibold">{team.name}</p>
                      {team.description && (
                        <p className="text-sm text-muted-foreground mt-1">{team.description}</p>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-right">أنت لست منضماً إلى أي فريق حالياً</p>
            )}
          </CardContent>
        </Card>

        {/* Activities */}
        <Card>
          <CardHeader>
            <CardTitle className="text-right flex items-center gap-2 justify-end">
              الأنشطة التي سجلت فيها
              <CalendarCheck className="w-5 h-5 text-accent" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            {subscriptionsLoading ? (
              <p className="text-muted-foreground text-right">جاري التحميل...</p>
            ) : mySubscriptions && mySubscriptions.length > 0 ? (
              <div className="grid gap-3">
                {mySubscriptions.map((sub) => {
                  const statusInfo = SUBSCRIPTION_STATUS_LABELS[sub.status] || SUBSCRIPTION_STATUS_LABELS.pending;
                  return (
                    <Link key={sub.subscriptionId} href={`/activities/${sub.activityId}`}>
                      <div className="p-4 rounded-lg border border-border hover:border-accent transition-colors cursor-pointer">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <Badge className={statusInfo.className}>{statusInfo.label}</Badge>
                          <p className="font-semibold text-right flex-1">{sub.title}</p>
                        </div>
                        {sub.startDate && (
                          <p className="text-sm text-muted-foreground text-right mt-1">
                            {new Date(sub.startDate).toLocaleDateString("ar-EG")}
                            {sub.location ? ` - ${sub.location}` : ""}
                          </p>
                        )}
                      </div>
                    </Link>
                  );
                })}
              </div>
            ) : (
              <p className="text-muted-foreground text-right">لم تسجل في أي نشاط بعد</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
