import { useState } from "react";
import { PhoneCall, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import PhoneMaskedInput from "./PhoneMaskedInput";

interface CallbackDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function CallbackDialog({ open, onOpenChange }: CallbackDialogProps) {
  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    consent: false,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const submitMutation = trpc.contact.submit.useMutation({
    onSuccess: () => {
      toast.success("Заявка отправлена! Мы перезвоним вам в ближайшее время.");
      setFormData({ name: "", phone: "", consent: false });
      onOpenChange(false);
    },
    onError: () => {
      toast.error("Ошибка при отправке заявки. Попробуйте позже.");
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.consent) {
      toast.error("Необходимо согласие на обработку персональных данных");
      return;
    }
    if (!formData.name.trim() || !formData.phone.trim()) {
      toast.error("Заполните имя и телефон");
      return;
    }
    setIsSubmitting(true);
    try {
      await submitMutation.mutateAsync({
        name: formData.name,
        phone: formData.phone,
        message: "Обратный звонок",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-card border-border">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-[family-name:var(--font-heading)]">
            <PhoneCall className="w-5 h-5 text-primary" />
            Обратный звонок
          </DialogTitle>
          <DialogDescription>
            Оставьте ваши данные и мы перезвоним в ближайшее время
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <Input
            placeholder="Ваше имя"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            className="h-11 bg-background border-border/50 rounded-lg"
            required
          />
          <PhoneMaskedInput
            value={formData.phone}
            onChange={(phone) => setFormData({ ...formData, phone })}
            className="h-11 bg-background border-border/50 rounded-lg"
            required
          />
          <div className="flex items-start gap-3">
            <Checkbox
              id="callback-consent"
              checked={formData.consent}
              onCheckedChange={(checked) =>
                setFormData({ ...formData, consent: checked as boolean })
              }
              className="mt-1"
            />
            <label htmlFor="callback-consent" className="text-sm text-muted-foreground">
              Я согласен на обработку персональных данных
            </label>
          </div>
          <Button
            type="submit"
            className="w-full btn-gold rounded-lg font-semibold"
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              "Отправка..."
            ) : (
              <>
                <Send className="w-4 h-4 mr-2" />
                Заказать звонок
              </>
            )}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
