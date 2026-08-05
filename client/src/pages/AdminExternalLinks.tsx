import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useAuth } from "@/_core/hooks/useAuth";

export default function AdminExternalLinks() {
  const { user } = useAuth({ redirectOnUnauthenticated: true });
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  const { data: links, refetch } = trpc.externalLinks.list.useQuery();
  const createMutation = trpc.externalLinks.create.useMutation();
  const updateMutation = trpc.externalLinks.update.useMutation();
  const deleteMutation = trpc.externalLinks.delete.useMutation();

  const [formData, setFormData] = useState({
    type: "",
    title: "",
    url: "",
    icon: "",
    order: 0,
    isActive: true,
  });

  if (!user || (user.role !== "admin" && user.role !== "general_agent" && user.role !== "tech_admin")) {
    return (
      <div className="container mx-auto px-4 py-12 text-center">
        <h1 className="text-3xl font-bold mb-4">غير مصرح</h1>
        <p className="text-gray-600">تحتاج إلى صلاحيات الإدارة للوصول إلى هذه الصفحة</p>
      </div>
    );
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox"
        ? (e.target as HTMLInputElement).checked
        : type === "number"
        ? (value === "" ? 0 : Number(value))
        : value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      if (editingId) {
        await updateMutation.mutateAsync({
          id: editingId,
          ...formData,
        });
        toast.success("تم تحديث الرابط بنجاح");
      } else {
        await createMutation.mutateAsync(formData);
        toast.success("تم إضافة رابط جديد بنجاح");
      }

      setFormData({
        type: "",
        title: "",
        url: "",
        icon: "",
        order: 0,
        isActive: true,
      });
      setIsAdding(false);
      setEditingId(null);
      refetch();
    } catch (error: any) {
      toast.error(error?.message || "حدث خطأ أثناء العملية");
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("هل أنت متأكد من حذف هذا الرابط؟")) return;

    try {
      await deleteMutation.mutateAsync(id);
      toast.success("تم حذف الرابط بنجاح");
      refetch();
    } catch (error: any) {
      toast.error(error?.message || "حدث خطأ أثناء الحذف");
    }
  };

  const handleEdit = (link: any) => {
    setFormData({
      type: link.type,
      title: link.title,
      url: link.url,
      icon: link.icon || "",
      order: link.order,
      isActive: link.isActive,
    });
    setEditingId(link.id);
    setIsAdding(true);
  };

  return (
    <div className="container mx-auto px-4 py-12">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-4 text-right">إدارة الروابط الخارجية</h1>
        <Button
          onClick={() => {
            setIsAdding(!isAdding);
            if (isAdding) {
              setEditingId(null);
              setFormData({
                type: "",
                title: "",
                url: "",
                icon: "",
                order: 0,
                isActive: true,
              });
            }
          }}
          className="bg-primary hover:bg-primary/90"
        >
          {isAdding ? "إلغاء" : "إضافة رابط جديد"}
        </Button>
      </div>

      {/* Add/Edit Form */}
      {isAdding && (
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="text-right">
              {editingId ? "تعديل الرابط" : "إضافة رابط جديد"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="type" className="text-right block mb-2">
                    النوع
                  </Label>
                  <select
                    id="type"
                    name="type"
                    value={formData.type}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-right"
                    dir="rtl"
                    required
                  >
                    <option value="">اختر النوع</option>
                    <option value="social">وسائل تواصل</option>
                    <option value="admin">بيانات المسؤولين</option>
                    <option value="external">روابط خارجية</option>
                  </select>
                </div>
                <div>
                  <Label htmlFor="title" className="text-right block mb-2">
                    العنوان
                  </Label>
                  <Input
                    id="title"
                    name="title"
                    value={formData.title}
                    onChange={handleChange}
                    className="text-right"
                    dir="rtl"
                    required
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="url" className="text-right block mb-2">
                  الرابط
                </Label>
                <Input
                  id="url"
                  name="url"
                  type="url"
                  value={formData.url}
                  onChange={handleChange}
                  className="text-right"
                  dir="rtl"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="icon" className="text-right block mb-2">
                    الأيقونة
                  </Label>
                  <Input
                    id="icon"
                    name="icon"
                    value={formData.icon}
                    onChange={handleChange}
                    className="text-right"
                    dir="rtl"
                    placeholder="مثال: facebook, twitter"
                  />
                </div>
                <div>
                  <Label htmlFor="order" className="text-right block mb-2">
                    الترتيب
                  </Label>
                  <Input
                    id="order"
                    name="order"
                    type="number"
                    value={formData.order}
                    onChange={handleChange}
                    className="text-right"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <input
                  id="isActive"
                  name="isActive"
                  type="checkbox"
                  checked={formData.isActive}
                  onChange={handleChange}
                  className="w-4 h-4"
                />
                <Label htmlFor="isActive" className="cursor-pointer">
                  تفعيل الرابط
                </Label>
              </div>

              <div className="flex gap-4 justify-start">
                <Button
                  type="submit"
                  className="bg-green-600 hover:bg-green-700"
                  disabled={createMutation.isPending || updateMutation.isPending}
                >
                  {editingId ? "تحديث" : "إضافة"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsAdding(false);
                    setEditingId(null);
                  }}
                >
                  إلغاء
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Links List */}
      <div className="grid gap-4">
        {links && links.length > 0 ? (
          links.map((link) => (
            <Card key={link.id}>
              <CardContent className="pt-6">
                <div className="flex justify-between items-start">
                  <div className="flex-1 text-right">
                    <h3 className="font-bold text-lg">{link.title}</h3>
                    <p className="text-gray-600 text-sm">{link.type}</p>
                    <a
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline text-sm"
                    >
                      {link.url}
                    </a>
                    <p className="text-gray-500 text-xs mt-2">
                      الحالة: {link.isActive ? "مفعّل" : "معطّل"}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      onClick={() => handleEdit(link)}
                      variant="outline"
                      size="sm"
                    >
                      تعديل
                    </Button>
                    <Button
                      onClick={() => handleDelete(link.id)}
                      variant="destructive"
                      size="sm"
                      disabled={deleteMutation.isPending}
                    >
                      حذف
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        ) : (
          <Card>
            <CardContent className="pt-6 text-center text-gray-600">
              لا توجد روابط حالياً
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
