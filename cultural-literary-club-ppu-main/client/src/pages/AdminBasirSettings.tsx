import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Link } from "wouter";
import { Bot, FileUp, Trash2, FileText, Loader2, Users, Gauge } from "lucide-react";
import { useRef } from "react";

const roleLabels: Record<string, string> = {
  user: "عضو",
  admin: "مسؤول",
  general_agent: "وكيل عام",
  tech_admin: "المدير التقني",
  supervisor: "مشرف",
  committee_head: "مشرف فريق",
};

export default function AdminBasirSettings() {
  const { user } = useAuth();
  const utils = trpc.useUtils();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: settings, isLoading: settingsLoading } =
    trpc.basir.getSettings.useQuery();
  const { data: pdfs = [], isLoading: pdfsLoading } =
    trpc.basir.listPdfs.useQuery();
  const { data: usageStats = [], isLoading: usageStatsLoading } =
    trpc.basir.getUsageStats.useQuery();

  const updateSettingsMutation = trpc.basir.updateSettings.useMutation({
    onSuccess: () => {
      utils.basir.getSettings.invalidate();
    },
  });

  const uploadPdfMutation = trpc.basir.uploadPdf.useMutation({
    onSuccess: () => {
      utils.basir.listPdfs.invalidate();
    },
  });

  const deletePdfMutation = trpc.basir.deletePdf.useMutation({
    onSuccess: () => {
      utils.basir.listPdfs.invalidate();
    },
  });

  if (!user || (user.role !== "admin" && user.role !== "general_agent" && user.role !== "tech_admin")) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-foreground mb-4">
            غير مصرح لك بالوصول إلى هذه الصفحة
          </h1>
          <Link href="/">
            <Button className="bg-accent text-accent-foreground hover:bg-accent/90">
              العودة إلى الرئيسية
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const handleToggle = (enabled: boolean) => {
    updateSettingsMutation.mutate({ enabled });
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== "application/pdf") {
      alert("يرجى اختيار ملف PDF فقط");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const base64Data = reader.result as string;
      uploadPdfMutation.mutate({
        fileName: file.name,
        base64Data,
        fileSize: file.size,
      });
    };
    reader.readAsDataURL(file);

    // Reset input so the same file can be re-selected
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleDeletePdf = (id: number) => {
    if (confirm("هل أنت متأكد من حذف هذا الملف؟")) {
      deletePdfMutation.mutate(id);
    }
  };

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return "غير معروف";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="min-h-screen bg-background">
      <section className="bg-gradient-to-b from-accent/10 to-background py-12 md:py-16">
        <div className="container">
          <div className="flex items-center gap-3 mb-2">
            <Bot className="w-8 h-8 text-accent" />
            <h1 className="text-4xl md:text-5xl font-bold text-foreground">
              إعدادات بصير
            </h1>
          </div>
          <p className="text-lg text-muted-foreground">
            التحكم في إعدادات المساعد الذكي بصير وملفات التغذية
          </p>
        </div>
      </section>

      <section className="py-8 md:py-12">
        <div className="container space-y-8 max-w-4xl">
          {/* Enable/Disable Card */}
          <Card>
            <CardHeader>
              <CardTitle>تفعيل / تعطيل بصير</CardTitle>
              <CardDescription>
                عند تعطيل بصير لن يظهر في شريط التنقل ولن يتمكن أي مستخدم من
                الوصول إليه
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Bot className="w-6 h-6 text-muted-foreground" />
                  <span className="font-medium">
                    {settings?.enabled ? "مفعّل" : "معطّل"}
                  </span>
                </div>
                <Switch
                  checked={settings?.enabled ?? false}
                  onCheckedChange={handleToggle}
                  disabled={
                    settingsLoading || updateSettingsMutation.isPending
                  }
                />
              </div>
            </CardContent>
          </Card>

          {/* PDF Upload Card */}
          <Card>
            <CardHeader>
              <CardTitle>ملفات التغذية (PDF)</CardTitle>
              <CardDescription>
                قم برفع ملفات PDF ليستخدمها بصير كمصدر أولي للإجابة عن أسئلة
                المستخدمين
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Upload button */}
              <div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,application/pdf"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <Button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadPdfMutation.isPending}
                  className="gap-2"
                >
                  {uploadPdfMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <FileUp className="w-4 h-4" />
                  )}
                  {uploadPdfMutation.isPending
                    ? "جاري الرفع..."
                    : "رفع ملف PDF"}
                </Button>
              </div>

              {/* PDF List */}
              {pdfsLoading ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
                  جاري تحميل الملفات...
                </div>
              ) : pdfs.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground border-2 border-dashed rounded-lg">
                  <FileText className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p>لا توجد ملفات PDF مرفوعة حالياً</p>
                  <p className="text-sm mt-1">
                    قم برفع ملفات لتغذية بصير بالمعلومات
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {pdfs.map((pdf) => (
                    <div
                      key={pdf.id}
                      className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-accent/5 transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <FileText className="w-8 h-8 text-red-500 shrink-0" />
                        <div className="min-w-0">
                          <a
                            href={pdf.fileUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-medium text-foreground hover:underline truncate block"
                          >
                            {pdf.fileName}
                          </a>
                          <p className="text-sm text-muted-foreground">
                            {formatFileSize(pdf.fileSize)} •{" "}
                            {pdf.createdAt
                              ? new Date(pdf.createdAt).toLocaleDateString(
                                  "ar",
                                )
                              : ""}
                          </p>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDeletePdf(pdf.id)}
                        disabled={deletePdfMutation.isPending}
                        className="text-destructive hover:text-destructive shrink-0"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
          {/* Member Usage Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Gauge className="w-5 h-5 text-accent" />
                استهلاك الأعضاء لحصة بصير
              </CardTitle>
              <CardDescription>
                عدد الأسئلة التي استهلكها كل عضو اليوم من حصته اليومية،
                والإجمالي الكلي منذ بداية استخدامه لبصير
              </CardDescription>
            </CardHeader>
            <CardContent>
              {usageStatsLoading ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
                  جاري تحميل بيانات الاستهلاك...
                </div>
              ) : usageStats.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground border-2 border-dashed rounded-lg">
                  <Users className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p>لا يوجد أي استهلاك مسجّل حتى الآن</p>
                  <p className="text-sm mt-1">
                    ستظهر هنا بيانات كل عضو بمجرد أن يبدأ باستخدام بصير
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-right text-muted-foreground">
                        <th className="py-2 px-3 font-medium">العضو</th>
                        <th className="py-2 px-3 font-medium">الدور</th>
                        <th className="py-2 px-3 font-medium">اليوم</th>
                        <th className="py-2 px-3 font-medium">الإجمالي</th>
                        <th className="py-2 px-3 font-medium">آخر استخدام</th>
                      </tr>
                    </thead>
                    <tbody>
                      {usageStats.map((s) => {
                        const pct = s.dailyLimit
                          ? Math.min(100, Math.round((s.todayUsed / s.dailyLimit) * 100))
                          : 0;
                        const barColor =
                          pct >= 100
                            ? "bg-destructive"
                            : pct >= 70
                              ? "bg-amber-500"
                              : "bg-accent";
                        return (
                          <tr
                            key={s.userId}
                            className="border-b last:border-0 hover:bg-accent/5"
                          >
                            <td className="py-3 px-3">
                              <div className="font-medium text-foreground">
                                {s.name}
                              </div>
                              {s.referenceNumber && (
                                <div className="text-xs text-muted-foreground">
                                  {s.referenceNumber}
                                </div>
                              )}
                            </td>
                            <td className="py-3 px-3">
                              <Badge
                                className={
                                  s.role === "tech_admin"
                                    ? "bg-rose-100 text-rose-700"
                                    : s.role === "general_agent"
                                    ? "bg-amber-100 text-amber-700"
                                    : s.role === "admin"
                                      ? "bg-purple-100 text-purple-700"
                                      : s.role === "supervisor"
                                        ? "bg-blue-100 text-blue-700"
                                        : "bg-gray-100 text-gray-600"
                                }
                              >
                                {roleLabels[s.role] || s.role}
                              </Badge>
                            </td>
                            <td className="py-3 px-3 min-w-[140px]">
                              <div className="flex items-center gap-2">
                                <span className="tabular-nums whitespace-nowrap">
                                  {s.todayUsed} / {s.dailyLimit}
                                </span>
                              </div>
                              <div className="w-full h-1.5 bg-muted rounded-full mt-1 overflow-hidden">
                                <div
                                  className={`h-full ${barColor} rounded-full`}
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                            </td>
                            <td className="py-3 px-3 tabular-nums">
                              {s.totalUsed}
                            </td>
                            <td className="py-3 px-3 text-muted-foreground text-xs">
                              {s.lastUsedAt
                                ? new Date(s.lastUsedAt).toLocaleString("ar")
                                : "—"}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  );
}
